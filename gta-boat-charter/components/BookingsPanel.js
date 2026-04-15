import { Calendar, ChevronRight, MapPin } from "lucide-react";

import { DEFAULT_BOAT_IMAGE } from "../lib/marketplace/constants";
import { getStatusTone, getBookingSummary, formatStatusLabel } from "../lib/marketplace/format";

function statusClass(tone) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "slate") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function BookingsPanel({ bookings, onBack }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">My Bookings</h2>
          <p className="mt-1 text-slate-600">Track confirmations, pending payments, and upcoming charter details in one place.</p>
        </div>

        <button onClick={onBack} className="btn-secondary text-sm">
          Back to browse
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="mx-auto mb-4 h-14 w-14 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-900">No bookings yet</h3>
          <p className="mt-2 text-slate-500">Once you check out, your confirmation details will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => {
            const summary = getBookingSummary(booking);
            const tone = getStatusTone(booking.status);

            return (
              <div key={booking.id} className="card p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <img
                      src={booking.boatImageUrl || DEFAULT_BOAT_IMAGE}
                      alt={booking.boatName || "Boat charter"}
                      className="h-20 w-24 rounded-2xl object-cover shadow-sm"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-extrabold text-slate-950">{booking.boatName || "Boat Charter"}</h3>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(tone)}`}>
                          {formatStatusLabel(booking.status)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {summary.dateLabel}
                        </span>
                        <span>{summary.slotLabel}</span>
                        {booking.ownerName ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            Hosted by {booking.ownerName}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Reference {summary.reference}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 md:block md:text-right">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</div>
                      <div className="text-lg font-extrabold text-slate-950">{summary.amountLabel}</div>
                    </div>

                    <div className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                      Booking details <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
