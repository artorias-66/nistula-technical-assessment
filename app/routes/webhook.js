const express = require('express');
const { normalise } = require('../services/normalizer');
const { classify } = require('../services/classifier');
const { draftReply } = require('../services/aiHandler');
const { computeConfidence, decideAction } = require('../services/confidence');

const router = express.Router();

/**
 * POST /webhook/message
 *
 * Main entry point for inbound guest messages. Runs the full pipeline:
 * validate → normalise → classify → draft reply → score confidence → respond.
 */
router.post('/message', async (req, res) => {
  try {
    // 1. Normalise the raw payload into our unified schema
    const normalised = normalise(req.body);

    // 2. Classify the query type
    const { query_type, keyword_hits } = classify(normalised.message_text);
    normalised.query_type = query_type;

    // 3. Draft a reply using Claude
    const draftedReply = await draftReply(normalised);

    // 4. Compute confidence and decide on an action
    const confidence = computeConfidence({
      queryType: query_type,
      keywordHits: keyword_hits,
      hasPropertyContext: normalised.property_id !== null
    });
    const action = decideAction(confidence, query_type);

    // 5. Send back the response
    return res.status(200).json({
      message_id: normalised.message_id,
      query_type,
      drafted_reply: draftedReply,
      confidence_score: confidence,
      action
    });
  } catch (err) {
    // Surface validation errors as 400, everything else as 500
    if (err.message.includes('must include') || err.message.includes('Unknown source')) {
      return res.status(400).json({ error: err.message });
    }

    console.error('Webhook processing failed:', err.message);
    return res.status(500).json({
      error: 'Failed to process the message. Please try again.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
