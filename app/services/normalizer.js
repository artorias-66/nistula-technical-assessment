const { v4: uuidv4 } = require('uuid');

/**
 * Normalise an inbound webhook payload into our unified message schema.
 *
 * Different channels send data in slightly different shapes — the normaliser
 * makes sure the rest of the pipeline always works with the same structure.
 * Right now the webhook payload is already fairly clean, but this layer
 * lets us absorb future channel quirks (e.g. Booking.com sending guest name
 * in a "customer" field, or Airbnb nesting the message inside a thread object)
 * without touching downstream code.
 */
function normalise(payload) {
  // Validate that we got the bare minimum fields
  if (!payload.message || !payload.source) {
    throw new Error('Payload must include at least "message" and "source"');
  }

  const allowedSources = ['whatsapp', 'booking_com', 'airbnb', 'instagram', 'direct'];
  const source = payload.source.toLowerCase().trim();

  if (!allowedSources.includes(source)) {
    throw new Error(`Unknown source channel: "${payload.source}". Expected one of: ${allowedSources.join(', ')}`);
  }

  return {
    message_id: uuidv4(),
    source,
    guest_name: (payload.guest_name || 'Guest').trim(),
    message_text: payload.message.trim(),
    timestamp: payload.timestamp || new Date().toISOString(),
    booking_ref: payload.booking_ref || null,
    property_id: payload.property_id || null,
    // query_type gets filled in by the classifier in the next step
    query_type: null
  };
}

module.exports = { normalise };
