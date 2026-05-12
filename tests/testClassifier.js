/**
 * Unit tests for the query classifier.
 *
 * These run against the classifier module directly — no server, no API calls.
 * Useful for verifying edge cases around tiebreaking and keyword matching.
 *
 * Run with: node tests/testClassifier.js
 */

const { classify } = require('../app/services/classifier');

const tests = [
  // ── Availability vs Pricing tiebreaks ────────────────────────────
  {
    name: 'Mixed availability + pricing → availability wins',
    input: 'Is the villa available from April 20 to 24? What is the rate for 2 adults?',
    expected: 'pre_sales_availability'
  },
  {
    name: 'Availability question with dates mentioned',
    input: 'Are there any dates available in December for a 3-night stay?',
    expected: 'pre_sales_availability'
  },
  {
    name: 'Pure pricing question with no availability keywords',
    input: 'What is the per night rate for 4 guests? Any discount for a week-long stay?',
    expected: 'pre_sales_pricing'
  },
  {
    name: 'Booking inquiry leans availability',
    input: 'I want to book the villa for next weekend. Is it available?',
    expected: 'pre_sales_availability'
  },

  // ── Complaint detection ──────────────────────────────────────────
  {
    name: 'Clear complaint with strong language',
    input: 'The AC is not working and the pool was dirty. This is unacceptable.',
    expected: 'complaint'
  },
  {
    name: 'Complaint mixed with pricing keywords',
    input: 'The room is terrible and not worth the rate we paid. I want a refund.',
    expected: 'complaint'
  },
  {
    name: 'Subtle complaint — unhappy but no profanity',
    input: 'We are not happy with the cleanliness. There is a smell in the bathroom.',
    expected: 'complaint'
  },

  // ── Special requests ─────────────────────────────────────────────
  {
    name: 'Birthday arrangement request',
    input: 'Can you arrange a birthday cake and some decoration for my wife?',
    expected: 'special_request'
  },
  {
    name: 'Early check-in request',
    input: 'Is early check-in possible around 10am? We have a morning flight.',
    expected: 'special_request'
  },
  {
    name: 'Airport transfer request',
    input: 'Do you provide airport pickup? We land at 3pm.',
    expected: 'special_request'
  },

  // ── Post-sales check-in info ─────────────────────────────────────
  {
    name: 'WiFi password request',
    input: 'Hey, what is the wifi password?',
    expected: 'post_sales_checkin'
  },
  {
    name: 'Check-in time query',
    input: 'What time is check-in? We are driving from Mumbai.',
    expected: 'post_sales_checkin'
  },
  {
    name: 'Directions to property',
    input: 'Can you share the address and directions to reach the villa?',
    expected: 'post_sales_checkin'
  },

  // ── General enquiries ────────────────────────────────────────────
  {
    name: 'Pet policy question',
    input: 'Do you allow pets? We have a small dog.',
    expected: 'general_enquiry'
  },
  {
    name: 'Amenities question',
    input: 'Does the villa have a pool and kitchen facilities?',
    expected: 'general_enquiry'
  },

  // ── Edge cases ───────────────────────────────────────────────────
  {
    name: 'Very short message with no keywords → defaults to general_enquiry',
    input: 'Hello',
    expected: 'general_enquiry'
  },
  {
    name: 'Message with keywords from multiple categories → highest priority wins',
    input: 'The AC is broken and I want early check-in tomorrow. Is a refund possible?',
    expected: 'complaint'
  }
];

// ── Run the tests ──────────────────────────────────────────────────
console.log('='.repeat(60));
console.log('  Classifier Unit Tests');
console.log('='.repeat(60));
console.log();

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = classify(test.input);
  const ok = result.query_type === test.expected;

  if (ok) {
    console.log(`  ✓ ${test.name}`);
    passed++;
  } else {
    console.log(`  ✗ ${test.name}`);
    console.log(`    Expected: ${test.expected}`);
    console.log(`    Got:      ${result.query_type} (${result.keyword_hits} keyword hits)`);
    failed++;
  }
}

console.log();
console.log('='.repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${tests.length}`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
