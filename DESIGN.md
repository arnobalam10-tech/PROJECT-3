# DESIGN.md — Visual System for This App (v2 — Modern SaaS)

**This replaces the earlier Swiss/Basel version entirely.** Based on direct user feedback, the
Swiss system didn't land — it read as too editorial/poster-like for a SaaS product. From this
point on, follow this document only. Several rules below are direct *inversions* of the old
system (rounded corners and soft shadows are now correct; colored status pills are now correct)
— don't blend the two systems.

## Reference direction

Modeled on modern SaaS dashboard products — see the four reference images provided (finance/
invoice dashboard UIs: rounded cards, soft elevation shadows, generous whitespace, clear
hierarchy, colorful but restrained status chips, avatar stacks, icon-rail sidebar nav, stat
tiles with trend indicators). Relay should look like a real, polished, modern SaaS product —
not a poster, not a default component-library starter.

## Color palette (confirmed — use exactly these, drop the old Swiss palette entirely)

```
Background:        #FFFFFF  (white — default page background everywhere)
Ink / primary text: #000000  (Black)
Primary accent:      #7E3BED  (Violet) — primary buttons, active nav state, links, focus rings,
                                the main "brand" color used for anything actionable/primary
Secondary accent:    #C6FF34  (Lime) — sparingly: success/positive signals, small highlight
                                chips, celebratory moments (e.g. "Approved"). Never a large
                                background fill — it's a spark of color, not a base color.
Neutral grays (derive as needed, keep it to a small tidy set):
  Surface:  #F7F7F9 (card backgrounds that sit on the white page background, subtle sections)
  Border:   #E5E5EA
  Muted text: #6E6E76
```

Do not reuse any Swiss-system hex value (#F4F1EA, #E32213, #8A867E, etc.) anywhere from here on.

## Typography

Clean modern sans-serif — Inter is a safe default; keep Archivo only if it's already wired up
and drop the Swiss-specific treatment (no forced lowercase branding, no aggressive negative
letter-spacing, no 0.92 line-height poster headlines). Standard sentence case. Clear, comfortable
hierarchy: page title > section header > body > caption/metadata, with generous line-height for
readability, not tightness for drama.

## Components — what "clean, modern SaaS" means concretely here

- **Sidebar nav:** icon rail (icon + label), rounded active-state background using the violet
  accent at low opacity, comfortable padding, clear separation from the content area.
- **Top bar:** search input, notification bell with an unread-count dot, user avatar. Generous
  spacing — nothing crammed together.
- **Cards:** white or light-gray-surface background, rounded corners (~12–16px radius), a soft
  low-opacity drop shadow (not a hard border-only look), generous internal padding. This is a
  direct reversal of the old "no shadows, no rounded corners" rule.
- **Stat tiles:** a large number, a short label, a small trend indicator (↑/↓ plus a percentage),
  optionally a tiny sparkline. Keep each tile visually uncluttered — one clear number as the
  hero of the tile.
- **Status indicators:** rounded pill/chip badges with a colored background + matching colored
  text — e.g. a soft green for Approved/Completed, amber/orange for Pending, violet or a clear
  warm color for anything needing the user's action now, gray for Rejected/Inactive. This
  reverses the old "text-label-only, no colored pills" rule.
- **Avatars:** circular, overlapping slightly when stacked (e.g. showing multiple workflow
  participants at a glance).
- **Tables/lists:** clear row separation (hairline divider or subtle alternating background),
  avatar+name for people columns, right-aligned numeric/status columns. At narrow widths,
  collapse to a card layout or allow horizontal scroll — never let columns compress until text
  overlaps or truncates unreadably.
- **Buttons:** rounded corners, solid violet fill for primary actions with white text, white
  background + border for secondary/ghost actions. Every interactive state (hover, active,
  disabled) must be visibly, actually different — re-verify this specifically, since a
  same-color hover bug already slipped through once.
- **Charts:** violet / lime / black / neutral-gray palette, soft gridlines are fine, rounded bar
  tops are fine — this is a reversal of the old bare-bars, no-gridlines rule.

## Hard rule: no overlapping or colliding elements, anywhere

Every screen, at every breakpoint you actually test, must have zero instances of text sitting on
top of other text or images, unexpectedly clipped/truncated labels, or elements visually
overlapping. This needs to be checked by actually looking at rendered screenshots, not inferred
from "the Tailwind classes look correct" — that reasoning has already produced a bug in this
project once (search silently swallowing errors) via the same kind of "should be fine" logic;
don't repeat that pattern here on something the user explicitly flagged as the core complaint.

## "No AI slop" — concretely avoid

- The default, unmodified shadcn/Tailwind starter look with no real customization.
- A generic purple-to-blue gradient hero with a vague abstract blob and no real content.
- Placeholder-sounding hero copy ("The all-in-one platform for X") that isn't specific to what
  Relay actually does.
- Inconsistent spacing between sections — pick a spacing scale (e.g. Tailwind's default scale)
  and apply it consistently rather than ad hoc per component.
- Icon usage that's purely decorative and mismatched in style across the app.
- Any component that looks copy-pasted without being adapted to its actual container (overflow,
  awkward wrapping, misaligned columns).

## Landing page — needs a real rebuild, this is the priority

The current landing page isn't working for the user. Rebuild it as an actual modern SaaS
marketing page with real substance:

1. **Hero** — a clear, specific headline stating what Relay is in plain language (not vague
   SaaS-speak), a supporting subheadline, a primary CTA ("Create your organization") and a
   secondary CTA ("Sign in"), and a **real visual mockup of the product** — a browser-frame or
   device-frame showing an actual (simplified, static) version of the dashboard, built from the
   app's real components/colors, not a stock illustration. This is the single most important
   element on the page.
2. **How it works** — the sequential workflow explained visually (reuse the Employee → Dept
   Head → Finance → Director example already in the spec), as a real step diagram, not a plain
   text list.
3. **Feature highlights** — 3–4 short callouts (e.g. "Sequential approvals," "Full audit trail,"
   "Multi-tenant by design," "Real-time notifications"), each with a small icon and one or two
   lines of copy.
4. **A second product mockup** — a static, real-component-based preview of a memo/workflow
   detail view (this is the "employee page" — what it looks like for someone acting on a memo
   day to day), giving visitors a genuine sense of using the app.
5. **Footer** — simple: product name, maybe a couple of links. Nothing elaborate needed.

Mockups should look like real product screenshots (built from the actual UI components/colors),
not illustrative graphics — that's what makes this read as a genuine SaaS product rather than a
template.
