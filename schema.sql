-- ============================================================
-- NISTULA UNIFIED MESSAGING PLATFORM — DATABASE SCHEMA
-- ============================================================
-- PostgreSQL 15+
--
-- This schema supports:
--   • One guest record per person, even if they message from multiple channels
--   • Every message (inbound + outbound) in a single table
--   • Conversations tied to guests and (optionally) to reservations
--   • Full AI audit trail: draft status, confidence scores, query classification
--
-- Naming conventions:
--   • snake_case everywhere
--   • Timestamps are TIMESTAMPTZ (timezone-aware)
--   • UUIDs for primary keys (no auto-increment leaking row counts)
--   • Foreign keys named explicitly for readability


-- ────────────────────────────────────────────────────────────
-- 1. GUESTS
-- ────────────────────────────────────────────────────────────
-- One row per real person. A guest who messages from both WhatsApp
-- and Airbnb still gets a single record here. Channel-specific
-- identifiers live in guest_channels (below).

CREATE TABLE guests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    notes           TEXT,                      -- internal notes from agents
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on name for quick lookups during guest merging
CREATE INDEX idx_guests_name ON guests (full_name);


-- ────────────────────────────────────────────────────────────
-- 2. GUEST CHANNELS
-- ────────────────────────────────────────────────────────────
-- Maps a guest to their identity on each channel. This is a separate
-- table (instead of columns like whatsapp_id, airbnb_id on guests)
-- so we can add new channels without touching the schema.
--
-- The UNIQUE constraint on (channel, channel_identifier) ensures
-- one identity per channel can only belong to one guest record.

CREATE TABLE guest_channels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id            UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    channel             VARCHAR(50) NOT NULL,
    channel_identifier  VARCHAR(255) NOT NULL,  -- phone number, OTA guest ID, IG handle, etc.
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (channel, channel_identifier)
);

CREATE INDEX idx_guest_channels_guest ON guest_channels (guest_id);


-- ────────────────────────────────────────────────────────────
-- 3. PROPERTIES
-- ────────────────────────────────────────────────────────────
-- Villa/property listings. The id is a human-readable slug (e.g. 'villa-b1')
-- rather than a UUID — makes logs and debugging much easier since property
-- IDs show up in every webhook payload.

CREATE TABLE properties (
    id              VARCHAR(50) PRIMARY KEY,    -- e.g. 'villa-b1'
    name            VARCHAR(255) NOT NULL,
    location        VARCHAR(255),
    bedrooms        INT,
    max_guests      INT,
    base_rate       NUMERIC(12, 2),             -- per night, in property currency
    currency        CHAR(3) NOT NULL DEFAULT 'INR',
    check_in_time   TIME,
    check_out_time  TIME,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 4. RESERVATIONS
-- ────────────────────────────────────────────────────────────
-- A booking ties a guest to a property for a date range.
-- booking_ref is the external-facing reference (e.g. 'NIS-2024-0891')
-- that guests and OTAs use. It's unique and indexed for fast lookups
-- from inbound webhook payloads.

CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_ref     VARCHAR(50) UNIQUE NOT NULL,
    guest_id        UUID NOT NULL REFERENCES guests(id),
    property_id     VARCHAR(50) NOT NULL REFERENCES properties(id),
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    num_guests      INT NOT NULL DEFAULT 1,
    total_amount    NUMERIC(12, 2),
    status          VARCHAR(30) NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_guest ON reservations (guest_id);
CREATE INDEX idx_reservations_property ON reservations (property_id);


-- ────────────────────────────────────────────────────────────
-- 5. CONVERSATIONS
-- ────────────────────────────────────────────────────────────
-- Groups messages into threads. A conversation belongs to one guest
-- and optionally links to a reservation (pre-sales conversations
-- won't have one yet).
--
-- The channel field records which channel started the conversation.
-- If a guest switches channels mid-conversation, we still keep it
-- as one thread — the per-message source field tracks where each
-- individual message came from.

CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id        UUID NOT NULL REFERENCES guests(id),
    reservation_id  UUID REFERENCES reservations(id),       -- nullable for pre-sales
    property_id     VARCHAR(50) REFERENCES properties(id),
    channel         VARCHAR(50) NOT NULL,                    -- channel that started the thread
    status          VARCHAR(30) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'resolved', 'escalated')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_guest ON conversations (guest_id);
CREATE INDEX idx_conversations_reservation ON conversations (reservation_id);
CREATE INDEX idx_conversations_status ON conversations (status);


-- ────────────────────────────────────────────────────────────
-- 6. MESSAGES
-- ────────────────────────────────────────────────────────────
-- Every message across every channel in one table. This is the core
-- of the platform — everything from a WhatsApp text to an Airbnb
-- inquiry to an agent's manual reply lives here.
--
-- Key design choices:
--
--   direction: 'inbound' (guest → us) or 'outbound' (us → guest)
--
--   sender_type: who wrote this message?
--     • 'guest'  — the guest themselves
--     • 'ai'     — Claude drafted it
--     • 'agent'  — a human agent wrote or edited it
--
--   draft_status: tracks the lifecycle of outbound messages
--     • 'ai_drafted'    — Claude generated it, waiting for review
--     • 'agent_edited'  — an agent modified the AI draft before sending
--     • 'auto_sent'     — sent automatically (high confidence, no review)
--     • NULL            — not applicable (inbound messages)
--
--   query_type + confidence_score: stored on inbound messages so we
--   can analyse classification accuracy over time and tune thresholds.
--
--   original_ai_draft: when an agent edits a draft, we keep the original
--   so we can compare what AI wrote vs what was actually sent. This is
--   invaluable for improving prompts.

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id),
    source_channel      VARCHAR(50) NOT NULL,                -- which channel this specific message came through
    direction           VARCHAR(10) NOT NULL
                            CHECK (direction IN ('inbound', 'outbound')),
    sender_type         VARCHAR(10) NOT NULL
                            CHECK (sender_type IN ('guest', 'ai', 'agent')),
    body                TEXT NOT NULL,

    -- AI classification (inbound messages)
    query_type          VARCHAR(50),                         -- e.g. 'pre_sales_availability', 'complaint'
    confidence_score    NUMERIC(3, 2),                       -- 0.00 to 1.00

    -- Outbound message lifecycle
    draft_status        VARCHAR(20)
                            CHECK (draft_status IN ('ai_drafted', 'agent_edited', 'auto_sent')),
    original_ai_draft   TEXT,                                -- preserved when agent edits a draft

    sent_at             TIMESTAMPTZ,                         -- when the message was actually delivered
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_direction ON messages (direction);
CREATE INDEX idx_messages_query_type ON messages (query_type);
CREATE INDEX idx_messages_created ON messages (created_at);


-- ============================================================
-- DESIGN DECISION COMMENTARY
-- ============================================================
--
-- THE HARDEST DECISION: Guest identity across channels
--
-- The thorniest problem in this schema is guest deduplication. A person
-- named "Rahul Sharma" who messages on WhatsApp and later books through
-- Booking.com should map to one guest record — but how do we know it's
-- the same person? Phone number matching works for WhatsApp-to-direct,
-- but Airbnb and Booking.com don't always share the guest's real phone
-- number until after booking.
--
-- I solved the schema side by splitting identity into two tables: guests
-- (the person) and guest_channels (their handle on each platform). This
-- means the app layer can merge guest records when it discovers two
-- channel identities belong to the same person — without any schema
-- changes. The UNIQUE constraint on (channel, channel_identifier)
-- prevents duplicate channel entries, and ON DELETE CASCADE keeps
-- things clean if a guest record is removed.
--
-- The alternative — columns like whatsapp_id, airbnb_id on the guests
-- table — is simpler but breaks every time a new channel is added. For
-- a platform that explicitly handles 5+ channels and will likely add
-- more, the junction table approach is worth the extra join.
--
-- What the schema does NOT solve is the actual matching logic (fuzzy
-- name matching, email correlation, phone normalisation). That's
-- application-layer work, and it's where the real complexity lives.
-- But the schema is ready for it.
-- ============================================================
