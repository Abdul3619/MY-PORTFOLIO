// Cal.com integration: lets the assistant check Abdulwahab's real availability for a 15-minute call and book it
// directly, instead of only ever collecting a lead for him to follow up on later.
//
// Security notes
// * CAL_COM_API_KEY is read from the server environment only, and is never sent to the client/visitor.
// * The model never talks to Cal.com directly -- it only reaches these two functions through the
//   check_availability/book_call tools in route.ts, which validate and shape everything the model gives them
//   before it gets here.

const CAL_API_BASE = 'https://api.cal.com/v2';

const env = (key: string) => (process.env[key] || '').trim();

function username() {
  return env('CAL_COM_USERNAME') || 'abdulwahab-abdullahi-3619';
}

function eventSlug() {
  return env('CAL_COM_EVENT_SLUG') || '15min';
}

export function calComConfigured() {
  return Boolean(env('CAL_COM_API_KEY'));
}

export interface CalSlot {
  startIso: string;
  label: string;
}

// Returns up to `maxSlots` upcoming open slots for the 15-minute event type, over the next `daysAhead` days, as
// plain ISO timestamps plus a human-readable label the model can read out directly to the visitor. Africa/Lagos
// is Abdulwahab's own timezone, so slot labels are shown in it regardless of where the visitor is -- the model is
// told in its tool description to say plainly that times are in his timezone.
export async function getAvailableSlots(daysAhead = 7, maxSlots = 8): Promise<CalSlot[]> {
  const apiKey = env('CAL_COM_API_KEY');
  if (!apiKey) throw new Error('CAL_COM_API_KEY is not set');

  const start = new Date();
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
    eventTypeSlug: eventSlug(),
    username: username(),
    timeZone: 'Africa/Lagos',
  });

  const res = await fetch(`${CAL_API_BASE}/slots?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'cal-api-version': '2024-09-04',
    },
  });

  if (!res.ok) {
    throw new Error(`Cal.com slots request failed: ${res.status}`);
  }

  const body = (await res.json()) as { status?: string; data?: Record<string, Array<{ start: string }>> };
  const byDate = body?.data ?? {};

  const slots: CalSlot[] = [];
  const dates = Object.keys(byDate).sort();
  for (const date of dates) {
    for (const entry of byDate[date] ?? []) {
      if (!entry?.start) continue;
      const when = new Date(entry.start);
      if (Number.isNaN(when.getTime())) continue;
      const label = when.toLocaleString('en-GB', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      slots.push({ startIso: entry.start, label: `${label} (Lagos time)` });
      if (slots.length >= maxSlots) return slots;
    }
  }
  return slots;
}

export type BookingResult = 'ok' | 'slot_unavailable' | 'invalid_input' | 'error';

export interface BookingInput {
  name: string;
  email: string;
  startIso: string;
  note?: string;
}

// Creates a real booking on Abdulwahab's calendar. Validates everything defensively here, on top of whatever the
// model already checked, since this is the last point before a real external side effect happens.
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const apiKey = env('CAL_COM_API_KEY');
  if (!apiKey) throw new Error('CAL_COM_API_KEY is not set');

  const name = (input.name || '').trim().slice(0, 200);
  const email = (input.email || '').trim().slice(0, 320);
  const startIso = (input.startIso || '').trim();
  const note = (input.note || '').trim().slice(0, 1000);

  if (!name) return 'invalid_input';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'invalid_input';
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60_000) return 'invalid_input';

  const res = await fetch(`${CAL_API_BASE}/bookings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'cal-api-version': '2026-02-25',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      start: start.toISOString(),
      attendee: { name, email, timeZone: 'Africa/Lagos' },
      eventTypeSlug: eventSlug(),
      username: username(),
      ...(note ? { metadata: { note } } : {}),
    }),
  });

  if (res.status === 201) return 'ok';
  if (res.status === 400 || res.status === 409) return 'slot_unavailable';
  console.error('Cal.com booking failed:', res.status, await res.text().catch(() => ''));
  return 'error';
}
