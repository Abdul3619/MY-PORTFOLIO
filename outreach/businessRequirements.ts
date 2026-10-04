// What a website for THIS kind of business should, at minimum, have -- beyond the generic technical
// checklist (viewport, HTTPS, a title, a way to be contacted at all) that already applies to every site.
// This is deliberately a small, honest set of items that are genuinely expected for each business type --
// not a maximal "best practice" wishlist -- so a flagged item is something the business owner would
// immediately recognize as missing, not a nitpick.
//
// Grouping by business type rather than by the exact category string the user searched: "hairdresser",
// "barber", "salon" and "spa" all share the same real requirements (a service list, a way to book), so one
// group covers all of them instead of four near-duplicate entries.

import type { CrawlEvidence } from './types.js';

type RequirementCheck = {
  /** Shown in the review-queue "Issues" line and handed to Gemini as a plain-language fact. */
  label: string;
  /** Returns true when this requirement IS satisfied -- i.e. nothing to flag. */
  satisfied: (evidence: CrawlEvidence) => boolean;
};

const GROUPS: Record<string, RequirementCheck[]> = {
  food: [
    { label: 'a visible menu (with items, ideally with prices)', satisfied: (e) => e.hasMenuMention },
    { label: 'opening hours', satisfied: (e) => e.hasHoursInfo },
    { label: 'a physical address customers can find', satisfied: (e) => e.hasAddressInfo },
  ],
  personal_care: [
    { label: 'a list of services offered, with prices', satisfied: (e) => e.hasPricingInfo },
    { label: 'a way to book or request an appointment', satisfied: (e) => e.hasBookingMention || e.hasOnlinePayment },
    { label: 'opening hours', satisfied: (e) => e.hasHoursInfo },
  ],
  medical: [
    { label: 'a way to book or request an appointment', satisfied: (e) => e.hasBookingMention },
    { label: 'opening hours', satisfied: (e) => e.hasHoursInfo },
    { label: 'a physical address', satisfied: (e) => e.hasAddressInfo },
  ],
  professional_services: [
    { label: 'a clear description of the services offered', satisfied: (e) => e.wordCount >= 150 },
    { label: 'a direct way to make contact (phone, email, or a contact form)', satisfied: (e) => e.emails.length > 0 || e.phones.length > 0 },
  ],
  trades: [
    { label: 'a phone number (most customers call a tradesperson, they don’t email)', satisfied: (e) => e.phones.length > 0 },
    { label: 'a clear "get a quote" or "contact us" action', satisfied: (e) => e.hasClearCallToAction },
  ],
  hotel: [
    { label: 'a way to check availability or book a room online', satisfied: (e) => e.hasBookingMention || e.hasOnlinePayment },
    { label: 'room rates or pricing', satisfied: (e) => e.hasPricingInfo },
    { label: 'a physical address or location', satisfied: (e) => e.hasAddressInfo },
  ],
  fashion_creative: [
    { label: 'a portfolio or gallery of actual work', satisfied: (e) => e.hasPortfolioMention || e.imageCount >= 4 },
    { label: 'a way to place an order or get in touch', satisfied: (e) => e.emails.length > 0 || e.phones.length > 0 || e.hasClearCallToAction },
  ],
  retail: [
    { label: 'products shown with prices', satisfied: (e) => e.hasPricingInfo },
    { label: 'a way to buy or order online, or at least a clear way to ask about an item', satisfied: (e) => e.hasOnlinePayment || e.hasClearCallToAction },
  ],
  fitness: [
    { label: 'class schedule, membership info, or pricing', satisfied: (e) => e.hasPricingInfo || e.hasHoursInfo },
    { label: 'a way to join or inquire', satisfied: (e) => e.hasClearCallToAction || e.emails.length > 0 || e.phones.length > 0 },
  ],
};

// Maps the exact category strings the search tool already resolves against OSM (see overpass.ts's
// CATEGORY_TAGS) onto one of the requirement groups above. Deliberately the same vocabulary the user
// already searches with, so this never needs its own separate category list to keep in sync.
const CATEGORY_TO_GROUP: Record<string, keyof typeof GROUPS> = {
  restaurant: 'food', restaurants: 'food', cafe: 'food', cafes: 'food', bakery: 'food', bakeries: 'food',
  'hair salon': 'personal_care', 'hair salons': 'personal_care', hairdresser: 'personal_care', hairdressers: 'personal_care',
  barber: 'personal_care', barbers: 'personal_care', barbershop: 'personal_care', barbershops: 'personal_care',
  salon: 'personal_care', salons: 'personal_care', 'beauty salon': 'personal_care', 'beauty salons': 'personal_care',
  beautician: 'personal_care', beauticians: 'personal_care', spa: 'personal_care', spas: 'personal_care',
  'nail salon': 'personal_care', 'nail salons': 'personal_care',
  dentist: 'medical', dentists: 'medical', clinic: 'medical', clinics: 'medical',
  lawyer: 'professional_services', lawyers: 'professional_services', accountant: 'professional_services', accountants: 'professional_services',
  plumber: 'trades', plumbers: 'trades', electrician: 'trades', electricians: 'trades',
  'car repair': 'trades', mechanic: 'trades', mechanics: 'trades',
  hotel: 'hotel', hotels: 'hotel',
  tailor: 'fashion_creative', tailors: 'fashion_creative', 'fashion designer': 'fashion_creative', 'fashion designers': 'fashion_creative',
  photographer: 'fashion_creative', photographers: 'fashion_creative',
  boutique: 'retail', boutiques: 'retail', florist: 'retail', florists: 'retail',
  gym: 'fitness', gyms: 'fitness',
};

/** Finds the requirement group for a free-typed category, same substring-matching leniency as the search
 * tool itself -- "beauty salon services" should still land on personal_care. Returns null for a category
 * with no defined requirements (an unrecognized or very generic category), in which case no business-type
 * requirements are checked -- only the generic technical ones apply. */
function resolveGroup(category: string | null | undefined): RequirementCheck[] | null {
  if (!category) return null;
  const key = category.trim().toLowerCase();
  if (CATEGORY_TO_GROUP[key]) return GROUPS[CATEGORY_TO_GROUP[key]];
  for (const [k, group] of Object.entries(CATEGORY_TO_GROUP)) {
    if (key.includes(k)) return GROUPS[group];
  }
  return null;
}

/** Returns the plain-language list of things that are genuinely expected for this business type but are
 * missing from the site -- e.g. a hair salon with no booking link, a restaurant with no visible menu. Empty
 * when the category isn't recognized, or when the site already covers everything checked. */
export function getMissingCompulsoryItems(category: string | null | undefined, evidence: CrawlEvidence): string[] {
  const checks = resolveGroup(category);
  if (!checks) return [];
  return checks.filter((c) => !c.satisfied(evidence)).map((c) => c.label);
}
