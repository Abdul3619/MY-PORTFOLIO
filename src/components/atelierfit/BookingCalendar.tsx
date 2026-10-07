import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// A real month-view calendar for AtelierFit's booking step -- replacing the old horizontal strip of a
// handful of pre-set dates. Every date/slot here is driven by real server data (the booking window from
// /config, and already-booked slots from /availability, both fetched by the parent) rather than a fixed
// list, so a day that's fully booked or outside the shop's real booking window reads as genuinely
// unavailable, not just visually different.

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function BookingCalendar({
  windowStart,
  windowEnd,
  closedWeekdays,
  timeSlots,
  bookedSlots,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: {
  windowStart: string; // YYYY-MM-DD
  windowEnd: string; // YYYY-MM-DD
  closedWeekdays: number[];
  timeSlots: string[];
  bookedSlots: Record<string, string[]>;
  selectedDate: string | null;
  selectedTime: string | null;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
}) {
  const start = useMemo(() => new Date(windowStart + "T00:00:00"), [windowStart]);
  const end = useMemo(() => new Date(windowEnd + "T00:00:00"), [windowEnd]);
  const [viewMonth, setViewMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));

  const canGoPrev = monthKey(viewMonth) !== monthKey(start);
  const canGoNext = monthKey(viewMonth) !== monthKey(end);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const leadingBlanks = firstOfMonth.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const out: Array<{ date: Date; key: string } | null> = [];
    for (let i = 0; i < leadingBlanks; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      out.push({ date, key: toDateKey(date) });
    }
    return out;
  }, [viewMonth]);

  const slotsForSelected = selectedDate ? bookedSlots[selectedDate] || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => canGoPrev && setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          disabled={!canGoPrev}
          aria-label="Previous month"
          className="p-1.5 rounded-full glass-card-subtle disabled:opacity-30 hover:border-pink-400/50 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="font-serif font-semibold text-sm">
          {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button
          type="button"
          onClick={() => canGoNext && setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          disabled={!canGoNext}
          aria-label="Next month"
          className="p-1.5 rounded-full glass-card-subtle disabled:opacity-30 hover:border-pink-400/50 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-[10px] text-white/35 uppercase pb-1">{w}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />;
          const outOfWindow = cell.date < start || cell.date > end;
          const closed = closedWeekdays.includes(cell.date.getDay());
          const booked = bookedSlots[cell.key] || [];
          const fullyBooked = timeSlots.length > 0 && booked.length >= timeSlots.length;
          const disabled = outOfWindow || closed || fullyBooked;
          const selected = selectedDate === cell.key;
          return (
            <button
              key={cell.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(cell.key)}
              title={closed ? "Closed" : fullyBooked ? "Fully booked" : undefined}
              className={`aspect-square rounded-lg text-xs flex items-center justify-center transition-colors ${
                selected
                  ? "bg-[#D6397D] text-black font-semibold"
                  : disabled
                  ? "text-white/20 line-through"
                  : "text-white/80 glass-card-subtle hover:border-pink-400/50"
              }`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Time slot</div>
          <div className="grid grid-cols-3 gap-2">
            {timeSlots.map((t) => {
              const taken = slotsForSelected.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={taken}
                  onClick={() => onSelectTime(t)}
                  className={`py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    taken
                      ? "text-white/25 glass-card-subtle line-through cursor-not-allowed"
                      : selectedTime === t
                      ? "bg-[#D6397D] text-black"
                      : "glass-card-subtle text-white/70 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
