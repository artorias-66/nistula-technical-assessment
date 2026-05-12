/**
 * Property context data used to ground Claude's responses.
 * In production this would come from a database — here we use
 * a static object that mirrors the property listing details.
 */

const properties = {
  'villa-b1': {
    name: 'Villa B1',
    location: 'Assagao, North Goa',
    bedrooms: 3,
    maxGuests: 6,
    privatePool: true,
    checkIn: '2:00 PM',
    checkOut: '11:00 AM',
    baseRate: 18000,
    baseRateGuests: 4,
    extraGuestCharge: 2000,
    currency: 'INR',
    wifiPassword: 'Nistula@2024',
    caretaker: 'Available 8 AM to 10 PM',
    chefOnCall: 'Yes, pre-booking required',
    cancellation: 'Free cancellation up to 7 days before check-in',
    // Hard-coded availability window for the assessment scenario
    availability: [
      { from: '2026-04-20', to: '2026-04-24', status: 'available' }
    ]
  }
};

/**
 * Look up a property by its ID.
 * Returns null when the property isn't in our records so the caller
 * can decide how to handle the miss.
 */
function getPropertyContext(propertyId) {
  return properties[propertyId] || null;
}

/**
 * Build a concise text block that we inject into the Claude prompt
 * so the model has all the factual details it needs to draft a reply.
 */
function formatPropertyForPrompt(property) {
  if (!property) return 'No property information available.';

  return [
    `Property: ${property.name}, ${property.location}`,
    `Bedrooms: ${property.bedrooms} | Max guests: ${property.maxGuests} | Private pool: ${property.privatePool ? 'Yes' : 'No'}`,
    `Check-in: ${property.checkIn} | Check-out: ${property.checkOut}`,
    `Base rate: ${property.currency} ${property.baseRate.toLocaleString('en-IN')} per night (up to ${property.baseRateGuests} guests)`,
    `Extra guest charge: ${property.currency} ${property.extraGuestCharge.toLocaleString('en-IN')} per night per person`,
    `WiFi password: ${property.wifiPassword}`,
    `Caretaker: ${property.caretaker}`,
    `Chef on call: ${property.chefOnCall}`,
    `Cancellation policy: ${property.cancellation}`,
    `Availability April 20-24: Available`
  ].join('\n');
}

module.exports = { getPropertyContext, formatPropertyForPrompt };
