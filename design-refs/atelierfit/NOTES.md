# AtelierFit visual reference set — received 2026-10-03

12 reference images, saved here permanently so they can be reopened and compared against live screenshots
screen-by-screen during the build, however long that takes. No code should change based on these without
re-reading the matching file here first.

**Important distinction to keep in mind while building:** every image shows TWO layered things —
(1) a photorealistic marketing shot: a floating 3D phone, smoky magenta/gold ribbons, glass cubes/orbs, a
reflective floor. That part is presentation, not app UI — it belongs in a hero/marketing shot (see the earlier
Rotato research), not literally rendered inside the live web app.
(2) the actual screen content rendered on the phone's display. That's the real UI spec to replicate in code.
Every note below is about (2) only.

**Brand-name drift across the set — needs the user's call, not mine:** file 01 says "Atelier", files
02/04/07/08/11 say "Velora", file 10 says "Vedora+". These are AI-generation variance, not a deliberate naming
decision — do not silently pick one. The already-confirmed app name is "AtelierFit" (website: "Atelier Noir").
Flag this rather than building any of these wordmarks as-is.

---

## Shared design system across all 12

- **Background:** near-black (reads close to #0A0A0C / #0B0A0A), never flat -- always has a soft magenta/violet
  glow bleeding in from one or more corners.
- **Cards:** glassmorphic -- translucent dark fill, thin 1px light border (~10-15% white), large corner radius
  (~20-24px), soft drop shadow, sometimes a faint inner glow in the brand color at the edge.
- **Typography:** serif display face for headings and the wordmark (elegant, high-contrast strokes -- reads like
  Playfair Display / Canela / similar editorial serif), clean sans-serif for body copy, labels, and buttons.
- **Primary gradient:** magenta → violet/purple, occasionally warming to rose-gold (file 01 specifically leans
  warmer/gold than the others, which are more blue-violet-magenta).
- **The AI Copilot orb** -- the single most repeated motif. A small circular avatar made of swirling light
  trails/plasma, usually with a simple face (two dot eyes, sometimes a smile), almost always top-right of the
  screen, frequently paired with a speech-bubble suggestion and/or an audio waveform. Appears in 10 of 12
  screens in some form. This is effectively the brand's mascot/assistant -- worth treating as a first-class,
  reusable component rather than a one-off decoration.
- **Progress stepper:** a row of numbered circles connected by a line (e.g. "Measurements → Design Review →
  Fabric & Details → Order → Delivery"), shown at the bottom of flow screens, current step highlighted/starred.
- **Bottom tab bar:** present on most screens but NOT identical across them -- it's contextual to which part of
  the journey you're in (Home/Explore/Measurements/Orders/Profile on browsing screens; Details/Chat/Delivery/
  Share on an active-order screen). Not a single fixed global nav.
- **Cards pattern:** icon in a soft rounded badge + title + one line of supporting text + a right-aligned
  chevron or text link ("View Details →", "Change", "Explore →").
- **Real fashion photography** is used throughout (Featured Collection banner, Couture Inspiration carousel,
  Digital Wardrobe thumbnails) -- this concept assumes a real photo library that doesn't exist yet. Directly
  relevant to the gallery backend already built: this is more reason the gallery stays empty/honest until real
  photos exist, rather than trying to recreate this exact photographic look with stock images.

---

## Per-screen breakdown

### 01 -- Onboarding / Welcome (`01-onboarding-welcome.png`)
Logo: triangle "A" monogram. "Welcome to **Atelier**" (serif, gradient text on "Atelier"). Tagline: "Your AI
tailoring companion for a wardrobe that understands you." Large hero orb: concentric swirling light rings around
a central 4-point sparkle/star, more ornate than the small copilot orb elsewhere -- this is the "splash screen"
version of the same motif, scaled up. Two pill buttons stacked: "Continue with Google" (dark glass, real Google
"G" icon, arrow right) and "Explore as Guest" (outlined glass pill, arrow right). Small Face ID icon + "Your
privacy matters. We never share your data." micro-copy at the very bottom.

### 02 -- Payment & Order Confirmation (`02-payment-order-confirmation.png`)
Header: wordmark + back arrow, right-aligned pill "Your Style. Perfected by AI". Copilot orb with a live
suggestion bubble ("Your order is ready! Shall we proceed?") + waveform. Product summary card: thumbnail, name,
collection line, 3 tag chips, price, "Premium Custom Tailoring" badge, green "Measurements Verified — 100%
accurate" check pill. Three-column meta row (Appointment Date / Estimated Delivery / Tailor Studio), each with
icon + value + action link. Payment section: lock icon header, glossy card-brand mockup (holographic Visa card
with masked number + name), Apple Pay / Google Pay / Pay with Card buttons alongside. Deposit breakdown: 3 stat
tiles (today's deposit / final payment / % paid progress bar). Loyalty section: points earned + a %-off-next-
order perk. Full-width gradient CTA pill "Confirm & Pay →" + secure-payment microcopy. Bottom 5-step progress
tracker, "Order" step current.
*Note: real payment UI here would be Paystack-first (NGN), not these US card-network mockups -- translate the
layout/behavior, not the specific payment brand assets.*

### 03 -- Home dashboard, "Good morning, Sarah" (`03-home-dashboard-sarah.png`)
Greeting + small orb ("Ready to help" + waveform) top-right. 4 square quick-action tiles (Book Outfit / Scan
Measurements / Browse Styles / Track Order), icon-over-label. Full-bleed "Featured Collection" photo card with
overline label, title, one-line description, pill CTA, and a "1/4" page indicator (carousel). Two-column row:
an "Upcoming Appointment" card (photo thumbnail + date/time/location + View Details) and an "AI Recommendation"
card (4 circular fabric swatches with names). A floating glass "Start Booking" pill sits above a calendar widget
peeking up from the very bottom edge (month grid + time-slot pills) -- reads like a bottom sheet mid-transition.
Bottom tab bar: Home / Explore / Measurements / Orders / Profile.

### 04 -- AI Design Review & Personalization (`04-ai-design-review-personalization.png`)
Title + subtitle explaining the AI already analyzed measurements/preferences. Top-right circular ring gauge
"98% AI CONFIDENCE". Left: vertical strip of small thumbnail variants. Center: large garment image on a
mannequin with a soft glowing halo ring behind it, labeled "Your Design Preview". Right: "Detected Measurements"
list (Bust/Waist/Hips/Shoulder/Height) with a "Perfect Fit" checkmark + "Edit Design" link. Below: "Recommended
Fabrics" row of 4 swatch cards, each with a one-word quality tag ("Most Popular", "Warm", "Lightweight",
"Luxury") and a + button. "Embroidery & Details" card (a real embroidery close-up photo + Customize link) next
to an "Occasion" card (5 circular icon toggles: Wedding/Evening/Business/Casual/Other). "Delivery Timeline" card
(icon-timeline + day estimate + Express tag) next to "Estimated Price" card (price + View Breakdown). Small
copilot orb bottom-right with a tip bubble. Bottom gradient CTA "Continue to Finalize →", step tracker showing
"Design Review" current.

### 05 -- Home dashboard, "Good Morning, Alex" (`05-home-dashboard-alex.png`)
A second home-screen variant. Tiny triangle logo top-left, orb "AI Assistant" pill top-right. 4 quick-action
tiles (New Order / AI Measure / Book Fitting / Track Order), each with a one-line subtitle under the label this
time (not just icon+label like screen 03). "Couture Inspiration" horizontal carousel (Men's Couture / Women's
Couture photo cards) with pagination dots + "Explore All" link -- this is the clearest unisex-categorization
precedent in the whole set: two parallel tracks, same visual treatment, differentiated only by label and photo.
"Upcoming Appointment" banner card. "Recent Orders" list -- 3 rows on a connecting vertical timeline dot/line,
each with thumbnail/title/order#/status/date/chevron. "Your Measurement Profile" card with a confidence badge.
Bottom tab bar: Home / Explore / Orders / AI / Profile.

### 06 -- AI Measurement capture (`06-ai-measurement-capture.png`)
"AI Measurement — Precision Fit • Powered by AI" header. Center: a photo of a person with glowing measurement
point-markers and thin connecting lines to labeled pill callouts (Neck, Shoulders, Chest, Waist, Hips, Sleeve
Length, Inseam, Height). Right side: stacked "detected" status chips with checkmarks (Shoulder detected / Height
detected / Posture aligned). A circular "Analyzing..." orb with a brain icon and a swirling ring, plus an
"AI Confidence 98%" ring gauge beneath it. Bottom: a 4-step numbered progress (Booking done, Measurements
current, Review, Payment). "AI Voice Assistant" bar: mic orb + live instruction text ("Stand naturally. Turn
slightly to your left.") + waveform. Large gradient CTA "📷 Capture Measurements →". Footer tagline.

### 07 -- Book Your Tailoring Appointment (`07-booking-appointment.png`)
"Step 3 of 5" dot progress at the very top. Copilot orb "Here to help" top-right. "AI Style Summary" card
(garment thumbnail + name + 3 tag chips + description + Edit Style link). "Select Date" calendar card (month
grid, several dates visually marked as available). "Choose Time Slot" row of time pills with a "Real-time
availability" indicator. Two-column: "Your Tailor" card (circular headshot, name, title, star rating + review
count, availability dot) and "Estimated Completion" card (date, working-day count, itemized deposit breakdown
with a total). Bottom gradient CTA "Reserve Appointment →". Bottom tab bar: Home/Explore/Measurements/Orders/
Profile.

### 08 -- Delivery & AI Concierge (`08-delivery-ai-concierge.png`)
Copilot orb with a reassurance message ("almost complete... here to help"). Order summary card (thumbnail, name,
3 attribute tags, "Ready for Delivery" badge, order#) alongside a live countdown timer ("Est. Delivery
HH:MM:SS"). "Live Courier" card: an actual map with a glowing route line, courier avatar/name/rating/status,
distance remaining, destination pin -- a real live-tracking map, not a static illustration. Below it, a compact
3-stage mini-progress (Pickup done → In Transit → Home Delivery ETA). Two cards: "Pickup from Tailor" (Schedule
Pickup link) and "Home Delivery" (today, free, checked). "Digital Garment Care" card (View Care Guide link).
"Your AI Concierge" card with a proactive styling suggestion bubble + Get Styling Tips link. Row of 4 icon
buttons: Contact Tailor / WhatsApp / Voice Assistant / Share Order. Bottom gradient CTA "Complete Order ✓".
Bottom tab bar: Details/Chat/Delivery(active)/Share.

### 09 -- AI Measurement Studio, analyzing state (`09-ai-measurement-studio-analyzing.png`)
A second measurement-capture variant, "Step 3 of 5" dot progress. Full-body photo inside a glass-bordered frame
with corner brackets (like a camera viewfinder), glowing point markers connected to floating labeled pills
(Shoulders detected / Chest detected / Waist detected / Sleeve estimated). Small copilot orb top-right. Below
the frame: "AI is analyzing your body" heading + 4 status chips, each icon + label + either a checkmark
("Complete") or a spinner ("Estimating") -- a clean micro-pattern for live per-field analysis state. Bottom
gradient CTA "Next →".

### 10 -- AI Design Studio from inspiration photo (`10-ai-design-studio-inspiration.png`)
Header pill "Style • Fit • Fabric — Perfected by AI". Copilot orb showing live progress ("Analyzing your
inspiration... 92%" + a progress bar inside the orb itself). Main card: the user's own "Uploaded" inspiration
photo next to "Your Design / AI suggested from your inspiration" with 4 editable attribute pills (Collar,
Sleeve, Embroidery, Fabric), each with a pencil/edit icon -- this is the most directly relevant screen to a
future "describe or upload what you want, AI drafts the design spec" feature. Three stat tiles: Confidence Score
(ring gauge), Tailoring Time (hours), Live Price Range (a range, not a fixed number, explicitly tied to
"selected details"). "Recommended Fabrics" row of 5 swatches with price deltas (+$120 etc.) and one marked
Featured/selected. "AI Reasoning" card: a paragraph explaining *why* the AI made these choices, plus a checklist
of match percentages (Style match, Occasion fit, Fabric compatibility, Color harmony, Overall confidence) --
the most "explain your work" UI in the whole set. Bottom gradient CTA "Continue to Measurements →".

### 11 -- Live Order Tracking (`11-live-order-tracking.png`)
Copilot orb with an encouraging status message. Two-column: "Your Master Tailor" card (photo, name, years of
experience, "Live at Workshop" status, a quoted line from them) and a "Watch Live" video-thumbnail card with a
live viewer count. "Order Progress": a vertical timeline list of 8 stages, each with an icon, label, and either
a timestamp (completed), a highlighted in-progress state, or an estimated date (upcoming) -- a proper
multi-stage production tracker, more granular than the order-status dropdown AtelierFit currently has.
"Pickup Countdown" card with a DD:HH:MM countdown and an "On Time" badge. "Chat with AI Copilot" bar (mic + chat
icons). Bottom tab bar: Details/Chat(active)/Voice Call/Share.

### 12 -- Wardrobe & Style Archive (`12-wardrobe-style-archive.png`)
Copilot orb with a proactive, context-aware outfit suggestion ("based on your style, season and upcoming
events..."). "Your Digital Wardrobe" card: a count ("48 Tailored Pieces") + horizontal scroll of past garment
photos, each labeled with name + season/year. "Your Body Measurements" card: a wireframe mannequin silhouette
icon + key measurements + a confidence badge. Two cards: "Reorder Your Favorites" (Reorder Now link) and
"Seasonal Style Recommendations" (small photo thumbnails + Explore link). "Maintenance Reminders" card (a list
of care tasks with dates). "Favorite Fabrics" card (circular swatches with heart/favorite icons). "Design New
Outfit" CTA card (Create Now button). A row of 4 small feature badges at the very bottom (Style Profile Updated,
AI Learning Personalized to You, Sustainable Smart Choices, Luxury Grade Premium Quality). Bottom tab bar:
Details/Chat/Wardrobe(active)/Delivery/Share.

---

## Open questions for the user (not guessed, not acted on)

1. **Brand name**: "Atelier" / "Velora" / "Vedora+" all appear -- which is intended, or does "AtelierFit" (the
   already-confirmed name) simply replace all of them in the real build?
2. **Scope check**: this set describes a far larger app than AtelierFit currently is -- a wardrobe archive,
   live courier tracking with a real map, a tailor-assignment system with ratings, a loyalty/points program, a
   "live workshop" video feed. Worth confirming which of these are must-haves for the real launch versus
   long-term direction, so the build order matches what matters most first.
