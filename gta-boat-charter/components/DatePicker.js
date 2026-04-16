"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buildSlotsFromRules, toLocalDateStr } from "../lib/marketplace/booking";

export default function DatePicker({ selectedDate, onSelectDate, rules }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const availableSlots = useMemo(() => buildSlotsFromRules(rules || {}), [rules]);

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const list = [];

    for (let index = 0; index < firstDay.getDay(); index += 1) {
      list.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      list.push(new Date(year, month, day));
    }

    return list;
  }, [currentMonth]);

  const monthName = currentMonth.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });

  const isDateAvailable = (date) => {
    if (!date || availableSlots.length === 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() >= today.getTime();
  };

  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return toLocalDateStr(date) === selectedDate;
  };

  return (
    <div className="rounded-3xl border border-sky-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          className="rounded-xl p-2.5 hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>

        <div className="font-semibold text-slate-900">{monthName}</div>

        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          className="rounded-xl p-2.5 hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:gap-2 sm:text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-11 sm:h-11" />;
          }

          const available = isDateAvailable(date);
          const selected = isSelected(date);

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => available && onSelectDate(toLocalDateStr(date))}
              disabled={!available}
              className={`h-11 rounded-2xl text-sm font-semibold transition sm:h-11 ${
                selected
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                  : available
                    ? "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-sky-50"
                    : "cursor-not-allowed bg-slate-50 text-slate-300"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
