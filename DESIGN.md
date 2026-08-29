# DESIGN.md — Visual System for This App

This app uses the Swiss/Basel style design system in full — see the `swiss-style-design` skill
for the canonical rules (exact hex codes, type rules, grid). This file adapts those rules
specifically to a data-dense workflow application, since the skill's examples lean toward
posters/decks/social graphics.

**Consult the `frontend-design` skill and the `swiss-style-design` skill before building any
component.** Do not improvise a generic "clean minimal" SaaS look — the specificity is the
point.

## Quick reference (from the skill — do not deviate)

```
Background #F4F1EA · Surface #FFFFFF · Border/ink #111111
Accent (Swiss red, ONE per composition) #E32213 · soft tint #F9DCD8
Text on primary #FFFFFF · Heading #111111 · Body #4A463E · Muted #8A867E
Chart series order: #111111, #E32213, #8A867E, #DAD5C8
Font: Archivo everywhere. Headlines ~15-22% of height, lowercase, letter-spacing -0.02 to -0.04em,
line-height 0.92. Metadata: small uppercase, tracked out.
Grid: visible 3-column grid, thin warm-gray vertical rules. 3px black rule top of every
composition with uppercase metadata (name left / number right).
NEVER: rounded corners, shadows, gradients, icons, photos, any 3rd hue, centered body text.
```

## Adapting the system to an application UI

A dashboard/inbox is not a poster — it needs density and legibility. Apply the system as
structure and restraint, not literal poster-scale headlines everywhere:

- **App shell:** 3px solid black top bar across every page, carrying the org name/logo
  (left, small uppercase tracked-out) and the current page name or breadcrumb (right). Sidebar
  or nav uses hairline warm-gray vertical rules to separate sections, not shadows or pills.
- **Page headings** (e.g. "inbox", "memo details") can use the large lowercase Archivo
  headline treatment — but scaled down from poster-scale to something like 28–40px, still
  lowercase, still tight negative letter-spacing, still near-black. This is the one place per
  page that gets "headline" treatment.
- **Tables/lists (inbox, my memos, audit log, etc.):** solid black hairline row dividers, no
  zebra-striping in a third color, no rounded row cards. Column headers are small uppercase
  tracked-out metadata style, muted gray.
- **Status indicators:** render as small uppercase tracked-out labels (metadata style), not
  colored pill badges — since we only get one red per composition. Use near-black for neutral/
  in-progress statuses, muted gray (`#8A867E`) for completed/inactive, and reserve the single
  red accent specifically for **whatever currently requires the viewing user's action** (e.g. a
  memo in their inbox awaiting their decision, or an "Urgent" priority marker on the item that
  needs attention right now). This directly satisfies the PRD's UI requirement that "current
  workflow state and required action should be visually obvious" — red *is* the "act now"
  signal in this system, used sparingly and consistently, never decoratively.
- **Buttons:** square corners, solid black fill for primary actions with white text, or
  black-outlined ghost buttons for secondary actions. The one exception: a destructive action
  like "Reject" may use the red accent on that button specifically — but if a page already has
  a red accent elsewhere (e.g. an urgent-priority tag), don't double up; fall back to a black
  outlined button with red-colored text label instead, to preserve the one-accent rule per
  screen as closely as practical. Use judgment here — the point is restraint, not a rigid
  count.
- **Forms** (memo creation, profile, admin): 3-column grid where it fits (e.g. metadata fields
  laid out across columns with hairline dividers), single-column stacking on mobile. Inputs are
  square-cornered, black-outlined, no drop shadows or glow on focus — use a solid black
  2px focus outline instead.
- **Charts (reporting/dashboard):** exactly as the skill specifies — solid black bars, one red
  "key" series (e.g. "pending" or "urgent" counts), 4px black baseline, no gridlines, plain
  numeral labels.
- **Timeline (memo details page):** a vertical hairline rule with square black event markers;
  the current/pending step gets the red marker, completed steps get black, future steps get
  muted gray outline-only markers. This is a natural, high-value use of the "one red accent
  marks the key thing" rule.
- **Empty states / section breaks (e.g. "no memos in your inbox"):** may use the full
  black-background + giant white numeral/word treatment sparingly (e.g. a "0" or short phrase),
  but don't overuse this — it's a strong, occasional device, not a default empty-state pattern
  for a dense app.

## Strictly avoid (repeating the skill's rules in an app context)

- Rounded corners anywhere — cards, buttons, inputs, avatars (use square crops), modals.
- Drop shadows, glows, blur-based elevation. Use hairline black/gray borders to separate
  surfaces instead.
- Gradients, including subtle ones on buttons or backgrounds.
- Icon libraries as decoration. If something needs a visual marker (status, priority), use
  type, a rule, or a geometric shape (square/dot) in the palette — not a pictographic icon set.
  Functional icons that are genuinely load-bearing for usability (e.g. a close "×" on a modal)
  are fine as typographic characters, not imported icon-font glyphs.
- A third hue anywhere, including in charts, avatars, or category tags — reuse black/gray/red
  tints only.
