import { buildSlotsFromRules, normalizeAvailabilityRules, validateAvailabilityRules } from "./booking";
import { BOAT_TYPES, DEFAULT_BOAT_IMAGE, OWNER_LOCATIONS } from "./constants";

export function sanitizeAmenityList(value) {
  const rawValues = Array.isArray(value) ? value : String(value || "").split(",");

  return Array.from(
    new Set(
      rawValues
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 16)
    )
  );
}

export function isValidHttpUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeImageUrls(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => isValidHttpUrl(value))
    )
  );
}

export function getBoatCoverImage(boat) {
  const candidateImages = sanitizeImageUrls([
    boat?.imageUrl,
    ...(Array.isArray(boat?.imageUrls) ? boat.imageUrls : []),
  ]);

  return candidateImages[0] || DEFAULT_BOAT_IMAGE;
}

export function getBoatGalleryImages(boat) {
  const images = sanitizeImageUrls([
    ...(Array.isArray(boat?.imageUrls) ? boat.imageUrls : []),
    boat?.imageUrl,
  ]);

  return images.length ? images : [DEFAULT_BOAT_IMAGE];
}

export function getListingStatus(boat) {
  if (boat?.isDeleted) return "archived";
  return boat?.status || "live";
}

export function isBoatVisibleToMarketplace(boat) {
  return getListingStatus(boat) === "live" && !boat?.isDeleted;
}

export function canBoatAcceptBookings(boat) {
  return isBoatVisibleToMarketplace(boat) && Boolean(boat?.ownerStripeReady);
}

export function validateBoatForm(formState) {
  const errors = {};
  const rules = normalizeAvailabilityRules(formState);
  const availabilityErrors = validateAvailabilityRules(rules);

  if (!String(formState?.name || "").trim() || String(formState.name).trim().length < 4) {
    errors.name = "Boat name should be at least 4 characters.";
  }

  if (!OWNER_LOCATIONS.includes(formState?.location)) {
    errors.location = "Choose a supported harbour.";
  }

  if (!BOAT_TYPES.includes(formState?.type)) {
    errors.type = "Choose a valid boat type.";
  }

  if (!Number.isFinite(Number(formState?.capacity)) || Number(formState.capacity) < 1) {
    errors.capacity = "Capacity must be at least 1 guest.";
  }

  if (!Number.isFinite(Number(formState?.price)) || Number(formState.price) < 50) {
    errors.price = "Set a realistic charter price of at least $50.";
  }

  if (!String(formState?.description || "").trim() || String(formState.description).trim().length < 30) {
    errors.description = "Description should be at least 30 characters so guests know what to expect.";
  }

  if (formState?.imageUrl && !isValidHttpUrl(formState.imageUrl)) {
    errors.imageUrl = "Enter a valid image URL that starts with http or https.";
  }

  if (formState?.status && !["draft", "live", "archived"].includes(formState.status)) {
    errors.status = "Choose a valid listing status.";
  }

  const amenities = sanitizeAmenityList(formState?.amenities);
  if (amenities.length === 0) {
    errors.amenities = "Add at least one amenity so guests know what is included.";
  }

  Object.assign(errors, availabilityErrors);

  return errors;
}

export function normalizeBoatPayload(formState, uploadedImageUrls = [], ownerProfile = {}, stripeConnect = {}) {
  const amenities = sanitizeAmenityList(formState?.amenities);
  const imageUrls = sanitizeImageUrls([...uploadedImageUrls, formState?.imageUrl]);
  const cover = imageUrls[0] || DEFAULT_BOAT_IMAGE;
  const rules = normalizeAvailabilityRules(formState);

  return {
    name: String(formState?.name || "").trim(),
    location: formState?.location || "Port Credit",
    type: formState?.type || "Sailboat",
    capacity: Number(formState?.capacity || 0),
    price: Number(formState?.price || 0),
    description: String(formState?.description || "").trim(),
    amenities,
    imageUrls,
    imageUrl: cover,
    status: formState?.status || "live",
    availabilityRules: rules,
    bookingDurationHours: rules.slotLength,
    bookableSlots: buildSlotsFromRules(rules),
    ownerId: ownerProfile?.uid || "",
    ownerName: ownerProfile?.displayName || ownerProfile?.name || "Owner",
    ownerEmail: ownerProfile?.email || "",
    ownerStripeAccountId: stripeConnect?.accountId || "",
    ownerStripeReady: Boolean(stripeConnect?.chargesEnabled && stripeConnect?.payoutsEnabled),
  };
}
