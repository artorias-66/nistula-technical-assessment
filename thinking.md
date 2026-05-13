# Part 3 — Thinking Question

**Scenario:** 3am. A guest at Villa B1 sends a WhatsApp message: *"There is no hot water and we have guests arriving for breakfast in 4 hours. This is unacceptable. I want a refund for tonight."*

---

## Question A — The Immediate Response

> Hi [Guest Name], I'm really sorry about the hot water — I understand how frustrating that is, especially at this hour. I've flagged this as urgent and our caretaker is being contacted right now to get this sorted before your guests arrive. Regarding the refund, I've noted your request and our team will follow up with you directly. Please don't hesitate to message again if you need anything.

The tone is empathetic but doesn't over-promise. It validates the frustration, creates a clear next action (caretaker being contacted), and deflects the refund — that's a manager call, not the AI's. At 3am the priority is making the guest feel heard and assured that a human is on the way.

## Question B — The System Design

The message gets classified as `complaint` and the pipeline forces `escalate` regardless of confidence score — this is already built into the codebase.

Beyond the reply:

1. **Page the on-call person** via SMS and push notification. Both the property caretaker and the ops manager get alerted — email alone won't cut it at 3am.
2. **Start a 30-minute SLA timer.** If nobody acknowledges, re-escalate to a second manager. If still no response at 60 minutes, trigger a fallback (e.g. an automated follow-up to the guest promising morning resolution).
3. **Log everything.** Inbound message, AI draft, escalation trigger, acknowledgement timestamps, and every subsequent action go into the `messages` table. The conversation status flips to `escalated`.
4. **Surface guest context** — booking dates, past interactions, previous complaints — so whoever picks it up can respond without asking the guest to repeat themselves.

Core principle: at 3am, speed of human contact matters more than the quality of the AI draft.

## Question C — The Learning

Three hot water complaints at the same property in two months is a maintenance problem, not a messaging problem.

The system should aggregate complaints by `property_id` and issue category, flagging any property that crosses a threshold (e.g. 2+ similar complaints in a 60-day window). When Villa B1 trips this, it alerts the property ops team — not guest-facing staff — and auto-creates a preventive maintenance ticket.

Longer term, I'd build a **property health score**: a composite metric tracking complaint frequency, category distribution, and resolution times per property. Properties trending downward get surfaced in a dashboard before guests ever need to complain. The fix for complaint #4 is a plumber visit after complaint #2 — not a better auto-reply after complaint #3.
