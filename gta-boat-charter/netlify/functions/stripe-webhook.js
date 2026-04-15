const { getFirebaseAdmin } = require("./_firebaseAdmin");
const { getStripe } = require("./_stripe");
const {
  expireCheckoutReservation,
  finalizeBookingFromSession,
  getStripeConnectState,
  syncOwnerStripeState,
} = require("./_marketplace");

exports.handler = async (event) => {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return { statusCode: 500, body: "Missing STRIPE_WEBHOOK_SECRET" };
  }

  const signature =
    event.headers?.["stripe-signature"] ||
    event.headers?.["Stripe-Signature"] ||
    event.headers?.["STRIPE-SIGNATURE"];

  if (!signature) {
    return { statusCode: 400, body: "Missing stripe-signature header" };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = stripeEvent.data.object;
        await finalizeBookingFromSession({ admin, db, session });
        break;
      }

      case "checkout.session.expired": {
        const session = stripeEvent.data.object;
        await expireCheckoutReservation({
          admin,
          db,
          bookingKey: session?.metadata?.bookingKey,
          checkoutSessionId: session?.id,
        });
        break;
      }

      case "account.updated": {
        const account = stripeEvent.data.object;
        const userId = account?.metadata?.userId;
        if (userId) {
          await syncOwnerStripeState({
            db,
            userId,
            stripeState: getStripeConnectState(account),
            admin,
          });
        }
        break;
      }

      default:
        break;
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error("stripe-webhook handler error:", error);
    return { statusCode: 500, body: "Webhook processing failed" };
  }
};
