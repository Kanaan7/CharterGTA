const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { boatName, boatId, date, slot, price, userId, ownerEmail, ownerId } = JSON.parse(event.body);

    if (!boatId || !date || !slot || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `${boatName} Charter`,
              description: `Booking for ${date} at ${slot}`,
            },
            unit_amount: Math.round(Number(price) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking-cancelled`,
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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
