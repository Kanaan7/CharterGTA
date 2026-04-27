import { buildSlotsFromRules, normalizeAvailabilityRules, validateAvailabilityRules } from "./booking";
import { BOAT_TYPES, DEFAULT_BOAT_IMAGE, OWNER_LOCATIONS } from "./constants";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v", ".ogg"];

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

export function parseMediaUrlInput(value) {
  if (Array.isArray(value)) return sanitizeImageUrls(value);

  return sanitizeImageUrls(
    String(value || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
  );
}

export function inferMediaTypeFromUrl(url) {
  if (!isValidHttpUrl(url)) return "image";

  const normalized = url.toLowerCase();
  if (normalized.includes("/video/upload/")) return "video";
  if (VIDEO_EXTENSIONS.some((extension) => normalized.includes(extension))) return "video";
  if (IMAGE_EXTENSIONS.some((extension) => normalized.includes(extension))) return "image";
  return "image";
}

export function buildVideoPosterUrl(url) {
  if (!isValidHttpUrl(url)) return "";
  if (!url.includes("/video/upload/")) return "";

  const transformed = url.replace("/video/upload/", "/video/upload/so_0,f_jpg/");
  return transformed.replace(/\.[^./?]+(\?.*)?$/, ".jpg$1");
}

export function normalizeMediaItem(item, index = 0) {
  const source = typeof item === "string" ? { url: item } : item || {};
  const url = String(source.url || source.secure_url || "").trim();

  if (!isValidHttpUrl(url)) return null;

  const type = source.type === "video" || source.resourceType === "video" ? "video" : inferMediaTypeFromUrl(url);
  const thumbnailUrl =
    String(source.thumbnailUrl || source.posterUrl || "").trim() || (type === "video" ? buildVideoPosterUrl(url) : url);

  return {
    id: source.id || `${type}-${index}-${url}`,
    type,
    url,
    thumbnailUrl: isValidHttpUrl(thumbnailUrl) ? thumbnailUrl : type === "image" ? url : "",
  };
}

export function sanitizeMediaItems(items = []) {
  const seen = new Set();
  const normalized = [];

  items.forEach((item, index) => {
    const mediaItem = normalizeMediaItem(item, index);
    if (!mediaItem || seen.has(mediaItem.url)) return;
    seen.add(mediaItem.url);
    normalized.push(mediaItem);
  });

  return normalized;
}

export function getBoatGalleryMedia(boat) {
  const mediaItems = sanitizeMediaItems([
    ...(Array.isArray(boat?.mediaItems) ? boat.mediaItems : []),
    ...(Array.isArray(boat?.imageUrls) ? boat.imageUrls : []),
    boat?.imageUrl,
  ]);

  return mediaItems.length
    ? mediaItems
    : [
        {
          id: "fallback-image",
          type: "image",
          url: DEFAULT_BOAT_IMAGE,
          thumbnailUrl: DEFAULT_BOAT_IMAGE,
        },
      ];
}

export function getBoatCoverImage(boat) {
  const mediaItems = getBoatGalleryMedia(boat);
  const firstImage = mediaItems.find((item) => item.type === "image");
  const firstVideo = mediaItems.find((item) => item.type === "video" && item.thumbnailUrl);
  return firstImage?.url || firstVideo?.thumbnailUrl || DEFAULT_BOAT_IMAGE;
}

export function getBoatGalleryImages(boat) {
  const images = getBoatGalleryMedia(boat)
    .filter((item) => item.type === "image")
    .map((item) => item.url);

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

  const rawMediaUrlInput = String(formState?.mediaUrls || "").trim();
  if (rawMediaUrlInput) {
    const rawMediaUrls = rawMediaUrlInput.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    const validMediaUrls = parseMediaUrlInput(rawMediaUrlInput);
    if (rawMediaUrls.length !== validMediaUrls.length) {
      errors.mediaUrls = "Gallery URLs must start with http or https.";
    }
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

export function normalizeBoatPayload(formState, uploadedMedia = [], ownerProfile = {}, stripeConnect = {}) {
  const amenities = sanitizeAmenityList(formState?.amenities);
  const coverUrl = String(formState?.imageUrl || "").trim();
  const manualMediaUrls = parseMediaUrlInput(formState?.mediaUrls);
  const mediaItems = sanitizeMediaItems([
    ...(coverUrl ? [{ url: coverUrl }] : []),
    ...manualMediaUrls.map((url) => ({ url })),
    ...uploadedMedia,
  ]);
  const imageUrls = mediaItems.filter((item) => item.type === "image").map((item) => item.url);
  const coverItem =
    mediaItems.find((item) => item.url === coverUrl) ||
    mediaItems.find((item) => item.type === "image") ||
    mediaItems.find((item) => item.type === "video");
  const cover = coverItem?.type === "video" ? coverItem.thumbnailUrl || DEFAULT_BOAT_IMAGE : coverItem?.url || DEFAULT_BOAT_IMAGE;
  const rules = normalizeAvailabilityRules(formState);

  return {
    name: String(formState?.name || "").trim(),
    location: formState?.location || "Port Credit",
    type: formState?.type || "Sailboat",
    capacity: Number(formState?.capacity || 0),
    price: Number(formState?.price || 0),
    description: String(formState?.description || "").trim(),
    amenities,
    mediaItems,
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
