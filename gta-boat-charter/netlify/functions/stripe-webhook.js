const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` }),
    };
  }

  // Handle the event
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    // Extract booking metadata
    const { boatId, boatName, date, slot, userId, ownerEmail } = session.metadata;

    try {
      // Create booking in Firestore
      await db.collection('bookings').add({
        boatId,
        boatName,
        date,
        slot,
        userId,
        ownerEmail,
        price: session.amount_total / 100,
        status: 'confirmed',
        paymentId: session.payment_intent,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update boat availability (remove the booked slot)
      const boatRef = db.collection('boats').doc(boatId);
      const boatDoc = await boatRef.get();
      
      if (boatDoc.exists) {
        const boatData = boatDoc.data();
        const updatedAvailability = boatData.availability.map(avail => {
          if (avail.date === date) {
            return {
              ...avail,
              slots: avail.slots.filter(s => s !== slot),
            };
          }
          return avail;
        });

        await boatRef.update({ availability: updatedAvailability });
      }

      // TODO: Send confirmation emails to user and owner

      console.log('Booking created successfully');
    } catch (error) {
      console.error('Error creating booking:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create booking' }),
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};