import { buildBookingReference, normalizeSlotLabel, parseSlotRange } from "./booking";

export function formatPrice(value) {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: safe % 1 === 0 ? 0 : 2,
    }).format(safe);
  } catch {
    return `$${safe.toFixed(2)}`;
  }
}

export function formatMoneyWithCurrency(value, currency = "cad") {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const normalizedCurrency = String(currency || "cad").toUpperCase();

  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: safe % 1 === 0 ? 0 : 2,
    }).format(safe);
  } catch {
    return `${formatPrice(safe)} ${normalizedCurrency}`;
  }
}

export function formatDateLabel(dateText) {
  if (!dateText) return "TBD";

  const [year, month, day] = String(dateText).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);

  if (Number.isNaN(date.getTime())) return dateText;

  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatSlotLabel(slot) {
  const parsed = parseSlotRange(slot);
  if (!parsed) return slot || "TBD";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });

  const startDate = new Date(2024, 0, 1, 0, 0, 0, 0);
  const endDate = new Date(2024, 0, 1, 0, 0, 0, 0);
  startDate.setMinutes(parsed.startMinutes);
  endDate.setMinutes(parsed.endMinutes);

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

export function formatConversationTime(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatStatusLabel(status) {
  switch (status) {
    case "live":
      return "Live";
    case "confirmed":
      return "Confirmed";
    case "pending_payment":
      return "Awaiting payment";
    case "processing":
      return "Processing";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "payment_failed":
      return "Payment failed";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

export function getStatusTone(status) {
  switch (status) {
    case "confirmed":
    case "live":
      return "emerald";
    case "pending_payment":
    case "processing":
      return "amber";
    case "cancelled":
    case "expired":
    case "payment_failed":
    case "archived":
      return "slate";
    default:
      return "blue";
  }
}

export function getBookingSummary(booking) {
  return {
    reference: buildBookingReference(booking),
    dateLabel: formatDateLabel(booking?.date),
    slotLabel: formatSlotLabel(normalizeSlotLabel(booking?.slot)),
    amountLabel: formatMoneyWithCurrency(booking?.price, booking?.currency),
  };
}
