const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const {
      boatName,
      boatId,
      date,
      slot,
      price,
      userId,
      ownerEmail,
      ownerId,
    } = JSON.parse(event.body || "{}");

    if (!boatId || !date || !slot || !price || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing NEXT_PUBLIC_APP_URL env var" }) };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `${boatName || "Boat"} Charter`,
              description: `Booking for ${date} at ${slot}`,
            },
            unit_amount: Math.round(Number(price) * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/booking-cancelled`,
      metadata: {
        boatId: String(boatId),
        boatName: String(boatName || ""),
        date: String(date),
        slot: String(slot),
        userId: String(userId),
        ownerEmail: String(ownerEmail || ""),
        ownerId: String(ownerId || ""),
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
