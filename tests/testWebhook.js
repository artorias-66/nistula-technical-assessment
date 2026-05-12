/**
 * Quick integration test — fires 5 different payloads at the webhook
 * to verify the full pipeline: normalise → classify → AI draft → confidence.
 *
 * Run with: npm test  (server must be running in another terminal)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const testPayloads = [
  {
    name: 'Availability check (WhatsApp)',
    payload: {
      source: 'whatsapp',
      guest_name: 'Rahul Sharma',
      message: 'Is the villa available from April 20 to 24? What is the rate for 2 adults?',
      timestamp: '2026-05-05T10:30:00Z',
      booking_ref: 'NIS-2024-0891',
      property_id: 'villa-b1'
    }
  },
  {
    name: 'Check-in info (Airbnb)',
    payload: {
      source: 'airbnb',
      guest_name: 'Priya Nair',
      message: 'Hi! We are arriving tomorrow. What time is check-in and can you share the WiFi password?',
      timestamp: '2026-05-06T14:00:00Z',
      booking_ref: 'NIS-2024-1102',
      property_id: 'villa-b1'
    }
  },
  {
    name: 'Complaint (Booking.com)',
    payload: {
      source: 'booking_com',
      guest_name: 'James Peterson',
      message: 'The AC is not working in the master bedroom and the pool was dirty when we arrived. This is unacceptable for the price we paid.',
      timestamp: '2026-05-07T22:15:00Z',
      booking_ref: 'NIS-2024-0934',
      property_id: 'villa-b1'
    }
  },
  {
    name: 'Special request (Instagram)',
    payload: {
      source: 'instagram',
      guest_name: 'Meera Kapoor',
      message: 'Hey! It is my husband\'s birthday during our stay. Can you arrange a cake and some room decoration? Also is early check-in possible around 10am?',
      timestamp: '2026-05-08T09:00:00Z',
      booking_ref: null,
      property_id: 'villa-b1'
    }
  },
  {
    name: 'General enquiry (Direct)',
    payload: {
      source: 'direct',
      guest_name: 'Amit Desai',
      message: 'Do you allow pets? We have a small Labrador. Also is the villa close to the beach?',
      timestamp: '2026-05-09T11:30:00Z',
      booking_ref: null,
      property_id: 'villa-b1'
    }
  }
];

// Pause between requests so we don't blow past the API rate limit
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('  Nistula Webhook — Integration Tests');
  console.log('='.repeat(60));
  console.log();

  let passed = 0;

  for (let i = 0; i < testPayloads.length; i++) {
    const test = testPayloads[i];

    // Wait between requests to respect the rate limit (30k tokens/min)
    if (i > 0) {
      console.log('  ⏳ Waiting 15s before next request (rate limit)...\n');
      await sleep(15000);
    }

    console.log(`▶ ${test.name}`);
    console.log('-'.repeat(50));

    try {
      const response = await fetch(`${BASE_URL}/webhook/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`  Query type  : ${data.query_type}`);
        console.log(`  Confidence  : ${data.confidence_score}`);
        console.log(`  Action      : ${data.action}`);
        console.log(`  Draft reply : ${data.drafted_reply.substring(0, 150)}...`);
        console.log(`  ✓ PASSED`);
        passed++;
      } else {
        console.log(`  ✗ FAILED — ${response.status}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.log(`  ✗ ERROR — ${err.message}`);
    }

    console.log();
  }

  console.log('='.repeat(60));
  console.log(`  Results: ${passed}/${testPayloads.length} passed`);
  console.log('='.repeat(60));
}

runTests();
