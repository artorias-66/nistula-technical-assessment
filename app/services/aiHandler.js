const Anthropic = require('@anthropic-ai/sdk');
const { getPropertyContext, formatPropertyForPrompt } = require('../data/propertyContext');

const client = new Anthropic();   // reads ANTHROPIC_API_KEY from env automatically

/**
 * Build the system prompt that tells Claude who it is and how to behave.
 * The tone is warm-but-professional — matching what a good hospitality
 * brand would actually send to guests.
 */
function buildSystemPrompt(property, queryType) {
  const propertyBlock = formatPropertyForPrompt(property);

  return `You are a guest communications assistant for Nistula, a premium villa rental company in Goa, India.

Your job is to draft a reply to a guest message. Be warm, helpful, and concise — never robotic. Use the guest's first name. Keep the reply under 120 words unless the question genuinely needs more detail.

PROPERTY DETAILS (use these as the single source of truth — do NOT make up information):
${propertyBlock}

QUERY TYPE: ${queryType}

GUIDELINES:
- For availability questions: confirm dates and mention the rate clearly.
- For pricing questions: break down the total (nights × rate + extra guest charges if applicable).
- For check-in questions: give the specific detail they asked for (WiFi, directions, etc.).
- For special requests: be positive but mention if pre-booking is needed.
- For complaints: be empathetic, apologise sincerely, and assure them someone will follow up immediately. Do NOT offer refunds or compensation — that's for a manager to decide.
- For general enquiries: answer factually from the property details above.

Do NOT use emojis excessively. One or two are fine if they feel natural.
Do NOT start with "Dear" — keep it conversational.
Do NOT include any subject line or email headers.`;
}

/**
 * Send the guest message to Claude and get a drafted reply.
 * Returns just the text content of the response.
 */
async function draftReply(normalisedMessage) {
  const property = getPropertyContext(normalisedMessage.property_id);
  const systemPrompt = buildSystemPrompt(property, normalisedMessage.query_type);

  const userPrompt = `Guest "${normalisedMessage.guest_name}" sent this via ${normalisedMessage.source}:

"${normalisedMessage.message_text}"

${normalisedMessage.booking_ref ? `Booking reference: ${normalisedMessage.booking_ref}` : 'No booking reference provided.'}

Draft a reply to send back to the guest.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  });

  // Claude returns an array of content blocks — grab the text from the first one
  const reply = response.content[0]?.text || '';
  return reply.trim();
}

module.exports = { draftReply };
