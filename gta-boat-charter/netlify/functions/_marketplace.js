const DEFAULT_PLATFORM_FEE_BPS = Number(process.env.STRIPE_PLATFORM_FEE_BPS || 1200);
const DEFAULT_RESERVATION_MINUTES = Number(process.env.CHECKOUT_RESERVATION_MINUTES || 20);
const DEFAULT_BOAT_IMAGE =
  "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200&q=80";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function normalizeDateInput(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function normalizeSlotLabel(value) {
  if (!value || typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);

  if (
    startHour < 0 ||
    startHour > 23 ||
    endHour < 0 ||
    endHour > 23 ||
    startMinute < 0 ||
    startMinute > 59 ||
    endMinute < 0 ||
    endMinute > 59
  ) {
    return "";
  }

  return `${pad2(startHour)}:${pad2(startMinute)}-${pad2(endHour)}:${pad2(endMinute)}`;
}

function parseSlotRange(slot) {
  const normalized = normalizeSlotLabel(slot);
  if (!normalized) return null;

  const [startText, endText] = normalized.split("-");
  const [startHour, startMinute] = startText.split(":").map(Number);
  const [endHour, endMinute] = endText.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (endMinutes <= startMinutes) return null;

  return {
    normalized,
    startMinutes,
    endMinutes,
  };
}

function normalizeAvailabilityRules(rules = {}) {
  return {
    startHour: Number(rules?.startHour ?? 9),
    endHour: Number(rules?.endHour ?? 21),
    slotLength: Number(rules?.slotLength ?? 4),
    minHours: Number(rules?.minHours ?? rules?.slotLength ?? 4),
  };
}

function buildSlotsFromRules(rules = {}) {
  const normalized = normalizeAvailabilityRules(rules);
  const slotMinutes = normalized.slotLength * 60;
  const startMinutes = normalized.startHour * 60;
  const endMinutes = normalized.endHour * 60;
  const slots = [];

  if (slotMinutes <= 0 || endMinutes <= startMinutes) return slots;

  for (let current = startMinutes; current + slotMinutes <= endMinutes; current += slotMinutes) {
    slots.push(
      `${pad2(Math.floor(current / 60))}:${pad2(current % 60)}-${pad2(Math.floor((current + slotMinutes) / 60))}:${pad2(
        (current + slotMinutes) % 60
      )}`
    );
  }

  return slots;
}

function buildBookingKey(boatId, date, slot) {
  return `${boatId}__${normalizeDateInput(date)}__${normalizeSlotLabel(slot)}`;
}

function buildBookingReference(bookingKey, date) {
  const compactDate = String(date || "").replace(/-/g, "");
  const suffix = String(bookingKey || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-6)
    .toUpperCase();

  return `GTA-${compactDate || "BOOK"}-${suffix || "000000"}`;
}

function addMinutes(date, minutesToAdd) {
  return new Date(date.getTime() + minutesToAdd * 60 * 1000);
}

function isFutureSlot(dateText, slot) {
  const normalizedDate = normalizeDateInput(dateText);
  const parsed = parseSlotRange(slot);
  if (!normalizedDate || !parsed) return false;

  const [year, month, day] = normalizedDate.split("-").map(Number);
  const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  startDate.setMinutes(parsed.startMinutes);

  return startDate.getTime() > Date.now();
}

function getStripeConnectState(account) {
  return {
    accountId: account?.id || "",
    detailsSubmitted: Boolean(account?.details_submitted),
    chargesEnabled: Boolean(account?.charges_enabled),
    payoutsEnabled: Boolean(account?.payouts_enabled),
    onboardingComplete: Boolean(account?.details_submitted && account?.charges_enabled && account?.payouts_enabled),
    requirementsDue: Array.isArray(account?.requirements?.currently_due) ? account.requirements.currently_due : [],
    requirementsPastDue: Array.isArray(account?.requirements?.past_due) ? account.requirements.past_due : [],
    country: account?.country || "CA",
    defaultCurrency: account?.default_currency || "cad",
    type: account?.type || "express",
    updatedAt: new Date().toISOString(),
  };
}

async function syncOwnerStripeState({ db, userId, stripeState, admin }) {
  if (!userId) return;

  const payload = {
    stripeConnect: {
      ...stripeState,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("users").doc(userId).set(payload, { merge: true });

  const ownerBoats = await db.collection("boats").where("ownerId", "==", userId).get();

  if (ownerBoats.empty) return;

  const batch = db.batch();
  ownerBoats.docs.forEach((boatDoc) => {
    batch.set(
      boatDoc.ref,
      {
        ownerStripeAccountId: stripeState.accountId || "",
        ownerStripeReady: Boolean(stripeState.chargesEnabled && stripeState.payoutsEnabled),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
}

function validateCheckoutPayload({ boat, boatId, date, slot, passengerUser }) {
  const normalizedDate = normalizeDateInput(date);
  const normalizedSlot = normalizeSlotLabel(slot);

  if (!boat || !boat.exists) {
    return { ok: false, error: "Listing no longer exists." };
  }

  const boatData = boat.data();
  if (!boatData?.ownerId || boatData.ownerId === passengerUser?.uid) {
    return { ok: false, error: "Owners cannot book their own listing." };
  }

  const status = boatData?.status || "live";
  if (status !== "live" || boatData?.isDeleted) {
    return { ok: false, error: "This listing is not currently accepting bookings." };
  }

  if (!normalizedDate || !normalizedSlot) {
    return { ok: false, error: "Choose a valid date and slot before checkout." };
  }

  if (!isFutureSlot(normalizedDate, normalizedSlot)) {
    return { ok: false, error: "That slot is no longer in the future." };
  }

  const allowedSlots = buildSlotsFromRules(boatData?.availabilityRules || {});
  if (!allowedSlots.includes(normalizedSlot)) {
    return { ok: false, error: "That slot is not part of the listing's published availability." };
  }

  if (!boatData?.ownerStripeAccountId || boatData?.ownerStripeReady !== true) {
    return { ok: false, error: "Owner payouts are not ready yet for this listing." };
  }

  return {
    ok: true,
    boatData,
    normalizedDate,
    normalizedSlot,
    bookingKey: buildBookingKey(boatId, normalizedDate, normalizedSlot),
  };
}

async function reserveBookingCheckout({
  admin,
  db,
  boatId,
  date,
  slot,
  passengerUser,
  boatData,
}) {
  const bookingKey = buildBookingKey(boatId, date, slot);
  const bookingRef = db.collection("bookings").doc(bookingKey);
  const now = new Date();
  const reservedUntil = addMinutes(now, DEFAULT_RESERVATION_MINUTES);

  const transactionResult = await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(bookingRef);
    const currentData = currentSnapshot.exists ? currentSnapshot.data() : null;
    const normalizedSlot = normalizeSlotLabel(slot);
    const normalizedDate = normalizeDateInput(date);

    if (currentData?.status === "confirmed") {
      throw new Error("That slot was just booked. Please choose another time.");
    }

    const existingReservedUntil = currentData?.reservedUntil?.toDate?.() || null;
    const isActivePending =
      currentData?.status === "pending_payment" &&
      existingReservedUntil &&
      existingReservedUntil.getTime() > now.getTime();

    if (isActivePending && currentData.userId !== passengerUser.uid) {
      throw new Error("That slot is currently being checked out by another passenger.");
    }

    const bookingPayload = {
      boatId,
      boatName: boatData?.name || "Boat Charter",
      boatImageUrl: boatData?.imageUrl || DEFAULT_BOAT_IMAGE,
      ownerId: boatData?.ownerId || "",
      ownerName: boatData?.ownerName || "Owner",
      ownerEmail: boatData?.ownerEmail || "",
      ownerStripeAccountId: boatData?.ownerStripeAccountId || "",
      userId: passengerUser.uid,
      passengerName: passengerUser.name || passengerUser.displayName || "Passenger",
      passengerEmail: passengerUser.email || "",
      date: normalizedDate,
      slot: normalizedSlot,
      price: Number(boatData?.price || 0),
      currency: "cad",
      status: "pending_payment",
      bookingReference: buildBookingReference(bookingKey, normalizedDate),
      reservedUntil: admin.firestore.Timestamp.fromDate(reservedUntil),
      checkoutLastRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: currentData?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(bookingRef, bookingPayload, { merge: true });

    return {
      bookingKey,
      bookingPayload,
      existingSessionId: isActivePending ? currentData?.checkoutSessionId || "" : "",
      reservedUntil,
    };
  });

  return {
    ...transactionResult,
    bookingRef,
  };
}

function buildCheckoutMetadata({
  bookingKey,
  boatData,
  passengerUser,
  date,
  slot,
}) {
  return {
    bookingKey: String(bookingKey),
    boatId: String(boatData?.id || ""),
    boatName: String(boatData?.name || "Boat Charter"),
    date: String(date),
    slot: String(slot),
    passengerUserId: String(passengerUser?.uid || ""),
    ownerId: String(boatData?.ownerId || ""),
    ownerStripeAccountId: String(boatData?.ownerStripeAccountId || ""),
  };
}

function buildDestinationCharge({ amountCents, destinationAccountId }) {
  const applicationFeeAmount =
    DEFAULT_PLATFORM_FEE_BPS > 0 ? Math.round(amountCents * (DEFAULT_PLATFORM_FEE_BPS / 10000)) : 0;

  return {
    application_fee_amount: applicationFeeAmount,
    transfer_data: {
      destination: destinationAccountId,
    },
  };
}

async function finalizeBookingFromSession({ admin, db, session }) {
  const metadata = session?.metadata || {};
  const bookingKey = metadata.bookingKey;
  const bookingRef = db.collection("bookings").doc(bookingKey);

  if (!bookingKey) {
    throw new Error("Missing bookingKey in Checkout Session metadata.");
  }

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bookingRef);
    const currentData = snapshot.exists ? snapshot.data() : {};

    if (currentData?.status === "confirmed" && currentData?.checkoutSessionId === session.id) {
      return;
    }

    transaction.set(
      bookingRef,
      {
        status: "confirmed",
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent || "",
        stripePaymentStatus: session.payment_status || "",
        amountSubtotal: (session.amount_subtotal || session.amount_total || 0) / 100,
        amountTotal: (session.amount_total || 0) / 100,
        price: (session.amount_total || 0) / 100,
        currency: session.currency || "cad",
        customerEmail: session.customer_details?.email || session.customer_email || currentData?.customerEmail || "",
        bookingConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        reservedUntil: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const boatRef = db.collection("boats").doc(metadata.boatId);
    transaction.set(
      boatRef,
      {
        bookedSlots: {
          [metadata.date]: admin.firestore.FieldValue.arrayUnion(metadata.slot),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return bookingRef.id;
}

async function expireCheckoutReservation({ admin, db, bookingKey, checkoutSessionId }) {
  if (!bookingKey) return;

  const bookingRef = db.collection("bookings").doc(bookingKey);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bookingRef);
    if (!snapshot.exists) return;

    const booking = snapshot.data();
    if (booking.checkoutSessionId && checkoutSessionId && booking.checkoutSessionId !== checkoutSessionId) return;
    if (booking.status === "confirmed") return;

    transaction.set(
      bookingRef,
      {
        status: "expired",
        reservedUntil: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function failCheckoutReservation({ admin, db, bookingKey, checkoutSessionId, reason = "" }) {
  if (!bookingKey) return;

  const bookingRef = db.collection("bookings").doc(bookingKey);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bookingRef);
    if (!snapshot.exists) return;

    const booking = snapshot.data();
    if (booking.checkoutSessionId && checkoutSessionId && booking.checkoutSessionId !== checkoutSessionId) return;
    if (booking.status === "confirmed") return;

    transaction.set(
      bookingRef,
      {
        status: "payment_failed",
        failureReason: reason,
        reservedUntil: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

module.exports = {
  buildBookingKey,
  buildCheckoutMetadata,
  buildDestinationCharge,
  buildSlotsFromRules,
  DEFAULT_BOAT_IMAGE,
  finalizeBookingFromSession,
  getStripeConnectState,
  normalizeDateInput,
  normalizeSlotLabel,
  reserveBookingCheckout,
  syncOwnerStripeState,
  validateCheckoutPayload,
  expireCheckoutReservation,
  failCheckoutReservation,
};
