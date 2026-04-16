export const LOCATIONS = ["All Locations", "Port Credit", "Toronto Harbour", "Hamilton Harbour"];

export const OWNER_LOCATIONS = LOCATIONS.filter((location) => location !== "All Locations");

export const BOAT_TYPES = ["Sailboat", "Motor Yacht", "Speedboat", "Pontoon", "Catamaran"];

export const HOURS = [
  { value: 0, label: "12:00 AM" },
  { value: 1, label: "1:00 AM" },
  { value: 2, label: "2:00 AM" },
  { value: 3, label: "3:00 AM" },
  { value: 4, label: "4:00 AM" },
  { value: 5, label: "5:00 AM" },
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 10, label: "10:00 AM" },
  { value: 11, label: "11:00 AM" },
  { value: 12, label: "12:00 PM" },
  { value: 13, label: "1:00 PM" },
  { value: 14, label: "2:00 PM" },
  { value: 15, label: "3:00 PM" },
  { value: 16, label: "4:00 PM" },
  { value: 17, label: "5:00 PM" },
  { value: 18, label: "6:00 PM" },
  { value: 19, label: "7:00 PM" },
  { value: 20, label: "8:00 PM" },
  { value: 21, label: "9:00 PM" },
  { value: 22, label: "10:00 PM" },
  { value: 23, label: "11:00 PM" },
];

export const DEFAULT_BOAT_IMAGE =
  "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200&q=80";

export const LISTING_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "live", label: "Live" },
  { value: "archived", label: "Archived" },
];

export function createBoatFormState(overrides = {}) {
  return {
    name: "",
    location: "Port Credit",
    type: "Sailboat",
    capacity: 4,
    price: 200,
    description: "",
    amenities: "",
    imageUrl: "",
    mediaItems: [],
    status: "live",
    startHour: 9,
    endHour: 21,
    slotLength: 4,
    minHours: 4,
    ...overrides,
  };
}
