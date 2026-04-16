import { Eye, ImageIcon, PencilLine, ShieldCheck } from "lucide-react";

import { HOURS, OWNER_LOCATIONS, BOAT_TYPES } from "../lib/marketplace/constants";
import { buildSlotsFromRules } from "../lib/marketplace/booking";
import { formatPrice } from "../lib/marketplace/format";
import { getBoatCoverImage, getListingStatus } from "../lib/marketplace/listings";
import OwnerPayoutCard from "./OwnerPayoutCard";

function listingStatusClass(status) {
  if (status === "live") return "badge badge-emerald";
  if (status === "archived") return "badge";
  return "badge badge-amber";
}

export default function BoatListingForm({
  mode = "create",
  form,
  validationErrors,
  selectedFiles,
  uploading,
  stripeConnect,
  ownerListings,
  onChange,
  onFilesChange,
  onSubmit,
  onCancel,
  onConnectStripe,
  onRefreshStripe,
  onManageStripe,
  onEditListing,
  onViewListing,
}) {
  const slotPreview = buildSlotsFromRules(form);
  const isEdit = mode === "edit";

  return (
    <div className="mobile-section-gap space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mobile-heading-tight text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            {isEdit ? "Edit listing" : "List your boat"}
          </h2>
          <p className="mobile-subtle-copy mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">
            {isEdit
              ? "Tighten listing details, availability, and payout readiness before guests book."
              : "Build a production-style listing with strong validation, clear availability, and secure payouts."}
          </p>
        </div>

        <button onClick={onCancel} className="btn btn-ghost sm:w-auto">
          {isEdit ? "Back to listing" : "Back"}
        </button>
      </div>

      <OwnerPayoutCard
        stripeConnect={stripeConnect}
        loading={uploading}
        onConnect={onConnectStripe}
        onRefresh={onRefreshStripe}
        onManage={onManageStripe}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)] xl:gap-6">
        <div className="card p-5 sm:p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label">Boat name</label>
              <input
                className={`input ${validationErrors.name ? "input-error" : ""}`}
                value={form.name}
                placeholder="e.g., Sea Ray 440 Flybridge"
                onChange={(event) => onChange("name", event.target.value)}
              />
              {validationErrors.name ? <p className="field-error">{validationErrors.name}</p> : null}
            </div>

            <div>
              <label className="label">Harbour</label>
              <select className="select" value={form.location} onChange={(event) => onChange("location", event.target.value)}>
                {OWNER_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              {validationErrors.location ? <p className="field-error">{validationErrors.location}</p> : null}
            </div>

            <div>
              <label className="label">Boat type</label>
              <select className="select" value={form.type} onChange={(event) => onChange("type", event.target.value)}>
                {BOAT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {validationErrors.type ? <p className="field-error">{validationErrors.type}</p> : null}
            </div>

            <div>
              <label className="label">Capacity</label>
              <input
                type="number"
                min="1"
                className="input"
                value={form.capacity}
                onChange={(event) => onChange("capacity", Number(event.target.value))}
              />
              <p className="help">Maximum guests allowed on this charter.</p>
              {validationErrors.capacity ? <p className="field-error">{validationErrors.capacity}</p> : null}
            </div>

            <div>
              <label className="label">Charter price</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input"
                value={form.price}
                onChange={(event) => onChange("price", Number(event.target.value))}
              />
              <p className="help">Charged securely through Stripe Checkout for the selected slot.</p>
              {validationErrors.price ? <p className="field-error">{validationErrors.price}</p> : null}
            </div>

            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                rows={5}
                className="textarea"
                value={form.description}
                placeholder="Describe the experience, route, captain expectations, and what makes this charter worth booking."
                onChange={(event) => onChange("description", event.target.value)}
              />
              {validationErrors.description ? <p className="field-error">{validationErrors.description}</p> : null}
            </div>

            <div className="md:col-span-2">
              <label className="label">Amenities</label>
              <input
                className="input"
                value={form.amenities}
                placeholder="Bluetooth audio, cooler, swim ladder, onboard washroom"
                onChange={(event) => onChange("amenities", event.target.value)}
              />
              <p className="help">Separate amenities with commas. Clear amenities make listings feel more trustworthy.</p>
              {validationErrors.amenities ? <p className="field-error">{validationErrors.amenities}</p> : null}
            </div>

            <div>
              <label className="label">Listing status</label>
              <select className="select" value={form.status} onChange={(event) => onChange("status", event.target.value)}>
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="archived">Archived</option>
              </select>
              <p className="help">Live listings appear in the marketplace. Drafts stay hidden until you are ready.</p>
            </div>

            <div>
              <label className="label">Cover image URL</label>
              <input
                className="input"
                value={form.imageUrl}
                placeholder="https://..."
                onChange={(event) => onChange("imageUrl", event.target.value)}
              />
              {validationErrors.imageUrl ? <p className="field-error">{validationErrors.imageUrl}</p> : null}
            </div>
          </div>

          <div className="divider my-6 sm:my-7" />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Start time</label>
              <select className="select" value={form.startHour} onChange={(event) => onChange("startHour", Number(event.target.value))}>
                {HOURS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
              {validationErrors.startHour ? <p className="field-error">{validationErrors.startHour}</p> : null}
            </div>

            <div>
              <label className="label">End time</label>
              <select className="select" value={form.endHour} onChange={(event) => onChange("endHour", Number(event.target.value))}>
                {HOURS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
              {validationErrors.endHour ? <p className="field-error">{validationErrors.endHour}</p> : null}
            </div>

            <div>
              <label className="label">Slot length (hours)</label>
              <input
                type="number"
                min="1"
                className="input"
                value={form.slotLength}
                onChange={(event) => onChange("slotLength", Number(event.target.value))}
              />
              {validationErrors.slotLength ? <p className="field-error">{validationErrors.slotLength}</p> : null}
            </div>

            <div>
              <label className="label">Minimum hours</label>
              <input
                type="number"
                min="1"
                className="input"
                value={form.minHours}
                onChange={(event) => onChange("minHours", Number(event.target.value))}
              />
              <p className="help">Keep this aligned with the slot length until you support multi-slot bookings.</p>
              {validationErrors.minHours ? <p className="field-error">{validationErrors.minHours}</p> : null}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Published slots
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {slotPreview.length ? (
                slotPreview.map((slot) => (
                  <span key={slot} className="badge badge-blue">
                    {slot}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Update availability to generate bookable slots.</span>
              )}
            </div>
          </div>

          <div className="divider my-6 sm:my-7" />

          <div>
            <label className="label">Photos and videos</label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="file-input"
              onChange={(event) => onFilesChange(Array.from(event.target.files || []))}
            />
            <p className="help">Upload polished photos or short walkthrough videos to make the listing feel more premium.</p>
            {selectedFiles.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                {selectedFiles.map((file) => (
                  <span key={`${file.name}-${file.size}`} className="badge">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row">
            <button onClick={onSubmit} disabled={uploading} className="btn btn-primary flex-1">
              {uploading ? "Saving..." : isEdit ? "Save changes" : "Publish listing"}
            </button>
            <button onClick={onCancel} disabled={uploading} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Preview</div>
                <h3 className="mt-1 text-xl font-extrabold text-slate-950">Listing card</h3>
              </div>
              <span className={listingStatusClass(form.status)}>{getListingStatus(form)}</span>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <img src={getBoatCoverImage(form)} alt={form.name || "Boat preview"} className="h-40 w-full object-cover sm:h-48" />
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-extrabold text-slate-950 sm:text-lg">{form.name || "Your boat name"}</div>
                    <div className="mt-1 text-sm text-slate-600">{form.location}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white sm:text-sm">
                    {formatPrice(form.price)}
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                  {form.description || "Your description preview will appear here as you type."}
                </p>
              </div>
            </div>

            {!stripeConnect?.onboardingComplete && form.status === "live" ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Guests can see a live listing, but booking stays disabled until Stripe onboarding is complete.
              </div>
            ) : null}
          </div>

          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Owner dashboard</div>
                <h3 className="mt-1 text-xl font-extrabold text-slate-950">Your listings</h3>
              </div>
              <div className="badge badge-blue">{ownerListings.length} total</div>
            </div>

            {ownerListings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Your live and draft listings will appear here once you save them.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {ownerListings.slice(0, 5).map((listing) => (
                  <div key={listing.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-900">{listing.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {listing.location} - {formatPrice(listing.price)}
                        </div>
                      </div>
                      <span className={listingStatusClass(getListingStatus(listing))}>{getListingStatus(listing)}</span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={() => onViewListing(listing)} className="btn-ghost justify-start sm:justify-center">
                        <Eye className="h-4 w-4" /> View
                      </button>
                      <button type="button" onClick={() => onEditListing(listing)} className="btn-ghost justify-start sm:justify-center">
                        <PencilLine className="h-4 w-4" /> Edit
                      </button>
                    </div>
                  </div>
                ))}

                {ownerListings.length > 5 ? (
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    + {ownerListings.length - 5} more listings
                  </div>
                ) : null}
              </div>
            )}

            {!isEdit ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Drafts are useful while you finish photos or Stripe onboarding. Flip to live once the listing feels ready.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
