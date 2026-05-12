/**
 * Rule-based query classifier.
 *
 * Why not use Claude for this? Two reasons:
 * 1. Classification is fast and deterministic with keywords — no need for
 *    a round-trip to an LLM when a few regex checks do the job reliably.
 * 2. We want the query_type *before* calling Claude so we can include it
 *    in the prompt and tailor the tone / detail of the drafted reply.
 *
 * The approach: score each category by counting keyword matches,
 * then pick the highest-scoring one. Ties break in priority order
 * (complaints first, since missing one is worse than misclassifying
 * a general enquiry).
 */

const rules = [
  {
    type: 'complaint',
    keywords: [
      'not working', 'broken', 'dirty', 'unacceptable', 'unhappy',
      'not happy', 'disappointed', 'terrible', 'worst', 'disgusting',
      'refund', 'compensat', 'complain', 'horrible', 'awful', 'issue',
      'problem', 'damaged', 'filthy', 'noisy', 'loud', 'smell', 'stink'
    ],
    priority: 1
  },
  {
    type: 'special_request',
    keywords: [
      'early check-in', 'early checkin', 'late check-out', 'late checkout',
      'airport transfer', 'airport pickup', 'extra bed', 'baby cot',
      'cot', 'crib', 'birthday', 'anniversary', 'surprise', 'decoration',
      'decorate', 'flowers', 'cake', 'candle', 'special arrangement',
      'arrange', 'request'
    ],
    priority: 2
  },
  {
    type: 'post_sales_checkin',
    keywords: [
      'check-in', 'checkin', 'check in', 'check-out', 'checkout',
      'check out', 'wifi', 'wi-fi', 'password', 'directions', 'location',
      'address', 'how to reach', 'key', 'keys', 'parking', 'towels',
      'toiletries', 'caretaker', 'contact'
    ],
    priority: 3
  },
  {
    type: 'pre_sales_pricing',
    keywords: [
      'rate', 'rates', 'price', 'pricing', 'cost', 'how much',
      'charge', 'charges', 'tariff', 'per night', 'total cost',
      'budget', 'discount', 'offer', 'deal', 'package'
    ],
    priority: 4
  },
  {
    type: 'pre_sales_availability',
    keywords: [
      'available', 'availability', 'book', 'booking', 'reserve',
      'reservation', 'dates', 'vacant', 'open', 'free dates',
      'slot', 'slots'
    ],
    priority: 5
  },
  {
    type: 'general_enquiry',
    keywords: [
      'pet', 'pets', 'dog', 'pool', 'amenities', 'facilities',
      'kitchen', 'cook', 'allow', 'allowed', 'rules', 'policy',
      'children', 'kids', 'infant', 'parking', 'nearby', 'restaurant',
      'beach', 'distance'
    ],
    priority: 6
  }
];

/**
 * Classify a message string into one of the six query types.
 * Returns an object with the matched type and how many keywords hit,
 * which the confidence scorer uses later.
 */
function classify(messageText) {
  const text = messageText.toLowerCase();
  let bestMatch = { type: 'general_enquiry', hits: 0, priority: 99 };

  for (const rule of rules) {
    const hits = rule.keywords.filter(kw => text.includes(kw)).length;

    // Pick this category if it has more hits, or if tied, pick
    // the higher-priority one (lower number = higher priority)
    if (hits > bestMatch.hits || (hits === bestMatch.hits && hits > 0 && rule.priority < bestMatch.priority)) {
      bestMatch = { type: rule.type, hits, priority: rule.priority };
    }
  }

  return {
    query_type: bestMatch.type,
    keyword_hits: bestMatch.hits
  };
}

module.exports = { classify };
