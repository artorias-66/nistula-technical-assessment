/**
 * Confidence scoring for drafted replies.
 *
 * The score (0–1) reflects how much we trust the AI draft to go out
 * without a human looking at it. It's built from three independent signals:
 *
 * 1. CLASSIFICATION CLARITY (40% weight)
 *    How cleanly did the message map to a query type? More keyword hits
 *    means we understood the intent better, so the prompt we sent to
 *    Claude was more targeted. 0 hits → 0.3 base, 1 hit → 0.6, 2 → 0.8,
 *    3+ → 1.0.
 *
 * 2. PROPERTY CONTEXT AVAILABLE (30% weight)
 *    Did we have property details to ground the response? Without them
 *    Claude is guessing — the reply might be charming but factually wrong.
 *    Known property → 1.0, unknown → 0.3.
 *
 * 3. QUERY COMPLEXITY (30% weight)
 *    Some types are inherently safer to auto-reply. Availability and
 *    check-in info are factual lookups. Complaints and special requests
 *    need human judgement.
 *    - pre_sales_availability, post_sales_checkin → 1.0
 *    - pre_sales_pricing, general_enquiry        → 0.8
 *    - special_request                           → 0.5
 *    - complaint                                 → 0.2
 *
 * Final score = weighted sum, clamped to [0, 1].
 *
 * Complaints are ALWAYS escalated regardless of score — it's a
 * business rule, not a confidence question.
 */

const WEIGHTS = {
  classification: 0.4,
  context: 0.3,
  complexity: 0.3
};

const COMPLEXITY_SCORES = {
  pre_sales_availability: 1.0,
  post_sales_checkin: 1.0,
  pre_sales_pricing: 0.8,
  general_enquiry: 0.8,
  special_request: 0.5,
  complaint: 0.2
};

function classificationScore(keywordHits) {
  if (keywordHits >= 3) return 1.0;
  if (keywordHits === 2) return 0.8;
  if (keywordHits === 1) return 0.6;
  return 0.3;
}

function computeConfidence({ queryType, keywordHits, hasPropertyContext }) {
  const classScore = classificationScore(keywordHits);
  const contextScore = hasPropertyContext ? 1.0 : 0.3;
  const complexityScore = COMPLEXITY_SCORES[queryType] ?? 0.5;

  const raw = (
    WEIGHTS.classification * classScore +
    WEIGHTS.context * contextScore +
    WEIGHTS.complexity * complexityScore
  );

  // Round to two decimal places for clean output
  return Math.round(Math.min(Math.max(raw, 0), 1) * 100) / 100;
}

/**
 * Decide what action to take based on the confidence score and query type.
 * Complaints always escalate — we don't risk auto-sending a tone-deaf
 * response to an angry guest.
 */
function decideAction(confidence, queryType) {
  if (queryType === 'complaint') return 'escalate';
  if (confidence >= 0.85) return 'auto_send';
  if (confidence >= 0.60) return 'agent_review';
  return 'escalate';
}

module.exports = { computeConfidence, decideAction };
