export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function toLocalDateStr(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function minutes(hours, mins) {
  return hours * 60 + mins;
}

export function minutesToHHMM(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function normalizeAvailabilityRules(rules = {}) {
  const startHour = Number(rules?.startHour ?? 9);
  const endHour = Number(rules?.endHour ?? 21);
  const slotLength = Number(rules?.slotLength ?? 4);
  const minHours = Number(rules?.minHours ?? slotLength);

  return {
    startHour,
    endHour,
    slotLength,
    minHours,
  };
}

export function buildSlotsFromRules(rules = {}) {
  const normalized = normalizeAvailabilityRules(rules);
  const slotMinutes = normalized.slotLength * 60;
  const startMinutes = minutes(normalized.startHour, 0);
  const endMinutes = minutes(normalized.endHour, 0);
  const slots = [];

  if (slotMinutes <= 0 || endMinutes <= startMinutes) return slots;

  for (let current = startMinutes; current + slotMinutes <= endMinutes; current += slotMinutes) {
    slots.push(`${minutesToHHMM(current)}-${minutesToHHMM(current + slotMinutes)}`);
  }

  return slots;
}

export function normalizeDateInput(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toLocalDateStr(value);
}

export function normalizeSlotLabel(value) {
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

export function parseSlotRange(slot) {
  const normalized = normalizeSlotLabel(slot);
  if (!normalized) return null;

  const [startText, endText] = normalized.split("-");
  const [startHour, startMinute] = startText.split(":").map(Number);
  const [endHour, endMinute] = endText.split(":").map(Number);
  const startMinutes = minutes(startHour, startMinute);
  const endMinutes = minutes(endHour, endMinute);

  if (endMinutes <= startMinutes) return null;

  return {
    normalized,
    startMinutes,
    endMinutes,
  };
}

export function isFutureSlot(dateText, slot) {
  const normalizedDate = normalizeDateInput(dateText);
  const parsed = parseSlotRange(slot);
  if (!normalizedDate || !parsed) return false;

  const [year, month, day] = normalizedDate.split("-").map(Number);
  const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  startDate.setMinutes(parsed.startMinutes);
  return startDate.getTime() > Date.now();
}

export function validateAvailabilityRules(rules = {}) {
  const normalized = normalizeAvailabilityRules(rules);
  const errors = {};

  if (!Number.isInteger(normalized.startHour) || normalized.startHour < 0 || normalized.startHour > 23) {
    errors.startHour = "Choose a valid daily start time.";
  }

  if (!Number.isInteger(normalized.endHour) || normalized.endHour < 1 || normalized.endHour > 23) {
    errors.endHour = "Choose a valid daily end time.";
  }

  if (normalized.endHour <= normalized.startHour) {
    errors.endHour = "End time must be later than the start time.";
  }

  if (!Number.isFinite(normalized.slotLength) || normalized.slotLength < 1) {
    errors.slotLength = "Slot length must be at least 1 hour.";
  }

  if (
    Number.isFinite(normalized.slotLength) &&
    Number.isFinite(normalized.startHour) &&
    Number.isFinite(normalized.endHour) &&
    normalized.slotLength > normalized.endHour - normalized.startHour
  ) {
    errors.slotLength = "Slot length must fit inside the daily availability window.";
  }

  if (!Number.isFinite(normalized.minHours) || normalized.minHours < 1) {
    errors.minHours = "Minimum hours must be at least 1.";
  }

  if (normalized.minHours > normalized.slotLength) {
    errors.minHours = "Minimum hours cannot exceed the selectable slot length.";
  }

  if (buildSlotsFromRules(normalized).length === 0) {
    errors.slotLength = errors.slotLength || "Availability window does not produce any bookable slots.";
  }

  return errors;
}

export function validateBookingSelection({ boat, date, slot }) {
  const normalizedDate = normalizeDateInput(date);
  const normalizedSlot = normalizeSlotLabel(slot);

  if (!boat?.id) {
    return { ok: false, error: "Choose a valid listing before booking." };
  }

  if (!normalizedDate) {
    return { ok: false, error: "Choose a valid charter date." };
  }

  if (!normalizedSlot) {
    return { ok: false, error: "Choose a valid time slot." };
  }

  if (!isFutureSlot(normalizedDate, normalizedSlot)) {
    return { ok: false, error: "Selected slot is no longer available in the future." };
  }

  const allowedSlots = buildSlotsFromRules(boat?.availabilityRules || {});
  if (!allowedSlots.includes(normalizedSlot)) {
    return { ok: false, error: "Selected time slot is not part of this listing's availability." };
  }

  return {
    ok: true,
    normalizedDate,
    normalizedSlot,
    bookingKey: buildBookingKey(boat.id, normalizedDate, normalizedSlot),
  };
}

export function buildBookingKey(boatId, date, slot) {
  return `${boatId}__${normalizeDateInput(date)}__${normalizeSlotLabel(slot)}`;
}

export function buildBookingReference(booking) {
  const datePart = String(booking?.date || "").replace(/-/g, "");
  const base = String(booking?.id || booking?.bookingKey || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-6)
    .toUpperCase();

  return `GTA-${datePart || "BOOK"}-${base || "000000"}`;
}

export function isBookingHoldingSlot(booking, now = new Date()) {
  if (!booking?.slot) return false;

  if (booking.status === "confirmed" || booking.status === "processing") {
    return true;
  }

  if (booking.status === "pending_payment") {
    const expiresAt = booking.reservedUntil?.toDate?.() || (booking.reservedUntil ? new Date(booking.reservedUntil) : null);
    return expiresAt ? expiresAt.getTime() > now.getTime() : true;
  }

  return false;
}

export function getUnavailableSlotsForDate(bookings = [], now = new Date()) {
  return Array.from(
    new Set(
      bookings
        .filter((booking) => isBookingHoldingSlot(booking, now))
        .map((booking) => normalizeSlotLabel(booking.slot))
        .filter(Boolean)
    )
  );
}

export function isUpcomingBooking(booking, now = new Date()) {
  if (!booking?.date || !booking?.slot) return false;
  const parsed = parseSlotRange(booking.slot);
  if (!parsed) return false;

  const [year, month, day] = normalizeDateInput(booking.date).split("-").map(Number);
  const bookingDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  bookingDate.setMinutes(parsed.startMinutes);
  return bookingDate.getTime() > now.getTime();
}
