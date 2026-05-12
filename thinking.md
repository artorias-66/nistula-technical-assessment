# Part 3 — Thinking Question

**Scenario:** 3am. A guest at Villa B1 sends a WhatsApp message: *"There is no hot water and we have guests arriving for breakfast in 4 hours. This is unacceptable. I want a refund for tonight."*

---

## Question A — The Immediate Response

> Hi [Guest Name], I'm really sorry about the hot water — I understand how frustrating that is, especially at this hour. I've flagged this as urgent and our caretaker is being contacted right now. Someone will reach out to you shortly. Regarding the refund, I've passed your request to our team and they'll follow up directly. Please message again if you need anything in the meantime.

Empathetic but measured. It acknowledges the problem, sets an expectation (caretaker being contacted), and sidesteps the refund — that's a manager's decision, not the AI's. At 3am the goal is making the guest feel heard, not resolving billing.

## Question B — The System Design

The message gets classified as `complaint` and the pipeline forces an `escalate` action regardless of confidence score — this already works in the current codebase.

Beyond the reply:

1. **Page the on-call person** via SMS and push notification. The caretaker and ops manager both get pinged — email alone won't cut it at 3am.
2. **Start a 30-minute SLA timer.** If nobody acknowledges, re-page and widen the blast radius to a second manager.
3. **Log the full trail.** The inbound message, AI draft, escalation trigger, and every subsequent human action go into the `messages` table. The conversation status flips to `escalated`.
4. **Surface guest history** so whoever picks it up has full context without making the guest repeat themselves.

The key principle: at 3am, speed of human contact matters more than the quality of the AI draft.

## Question C — The Learning

Three hot water complaints at the same property in two months is a maintenance problem, not a messaging problem.

The system should run a periodic query: group complaints by `property_id` and keyword cluster, flag any property that crosses a threshold (say, 2+ similar complaints within a rolling 60-day window). When Villa B1 trips this, it alerts the property operations team — not guest-facing staff.

What I'd build: a batch job that scans recent complaint messages, extracts the subject (plumbing, AC, cleanliness), and tracks recurrence per property. When a pattern surfaces, it auto-creates a maintenance ticket before the next guest checks in. The fix for complaint #4 is a plumber visit after complaint #2 — not a better auto-reply after complaint #3.
