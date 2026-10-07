# HustleHub Design System: single source of truth

> Generated with the ui-ux-pro-max skill (`search.py "campus student marketplace P2P nationwide" --design-system --variance 6 --motion 4 --density 5 --persist -p HustleHub`)
> and then **adapted by hand**. The generator suggested a purple Minimalism palette and swapped our fonts; we ignore both.
> What we adopted: the **Vibrant & Block-based** style direction (looked up with `-d style`), the dials, the UX rules and the pre-delivery checklist.
> What we kept from the existing product: the Eduvos palette, Playfair Display + Inter, and the light/dark themes.
> If a page needs different rules, add `design-system/hustlehub/pages/<page>.md`; it overrides this file.

**Dials:** Variance 6 (balanced, modern) · Motion 4 (standard) · Density 5 (standard)
**Direction:** youthful, bold, block-based. Big type, solid colour blocks, geometric shapes, strong contrast. Richer, not busier: one primary action per screen.

## Colour (tokens live in `src/app/globals.css` `@theme`; never hard-code hex in components)
| Token | Hex | Use |
|---|---|---|
| `navy` | `#16305E` | Headings, primary blocks, nav, text on light |
| `royal` | `#2352C4` | Links, primary buttons, active states, icon accents |
| `sand` (gold) | `#CFAE7E` | **Background only**: highlight blocks, badges, CTA fill with navy text. Fails AA as text on white |
| `mist` | `#F3F4F7` | Quiet surfaces, skeletons, chips |
| `ink` / `muted` | `#1B2233` / `#4A5468` | Body / secondary text |
| white | `#FFFFFF` | Cards |
Block pairings (all pass AA): white on navy 12.6:1 · white on royal 6.6:1 · navy on sand 6.0:1 · navy on white 12.6:1.
Dark theme: existing overrides in `globals.css` (surface `#121c31`, page `#0b1322`). `bg-navy`, `bg-royal`, `bg-sand` keep their brand colour in both themes.
Status colours stay pastel + dark text (amber/red/green 50-900 pairs); never use colour alone to carry meaning.

## Typography
Display: **Playfair Display** (headings only). Body/UI: **Inter**.
Scale: 12 (meta) · 14 (small) · 16 (body, **minimum for inputs so iOS never zooms**) · 18 · 20 · 24 · 32 · 40 (hero). Line-height 1.5 body, 1.15 headings.
Block-style rule: hero and section titles are large (32px+ on mobile hero is OK at 32-40); do not shrink to fit, wrap instead.

## Spacing, radius, elevation
- Spacing scale (4-pt): `1`=4, `2`=8, `3`=12, `4`=16, `6`=24, `8`=32, `12`=48, `16`=64. Page gutter 16px; section gap 32-48px; card padding 12-16px.
- Radius: `rounded-lg` 8 (inputs, buttons), `rounded-xl` 12 (cards, tiles), `rounded-2xl` 16 (sheets, hero blocks), `rounded-full` (chips, avatars, icon buttons).
- Elevation: cards use `border border-navy/10` + `shadow-sm`; sheets/modals `shadow-xl`. No heavy glow.

## Icons
**Unicons (Iconscout), line style only**, via `@iconscout/react-unicons` through the single wrapper `src/components/Icon.tsx`.
Sizes (token scale): `sm`=16 · `md`=20 · `lg`=24. Decorative icons are `aria-hidden` (default); a standalone icon needs `label`. Icon-only buttons need `aria-label` and a ≥44px hit area.
**No emoji or text glyphs (✓ × ← ★) as icons.** Add new icons to the map in `Icon.tsx`; do not import Unicons directly elsewhere.

## Layout and responsiveness
- Mobile first. Verify at 360, 375, 414, 768, 1024, 1440. No horizontal scroll. Content max width `max-w-6xl`.
- Tap targets ≥ 44×44px with ≥ 8px between them. Inputs ≥ 16px text.
- Fixed bars (header, bottom nav) respect safe areas (`env(safe-area-inset-*)`); page content has bottom padding equal to the bottom nav.
- Use `dvh` not `vh`. Every image has an `aspect-ratio` (or fixed box) so nothing shifts.

## Components
- **Buttons:** one **primary** per screen (royal fill, white text; on navy surfaces a sand fill with navy text). Secondary = 2px navy outline. Min height 44. Press feedback `active:scale-[.98]`; hover colour shift 150-200ms.
- **Listing card:** 4:3 real photo, price in navy bold, title (2 lines), campus · city label, trust badge, delivery icons; save button top right (44px). Whole card is one link.
- **Seller card:** avatar, business name + verified tick, trust badge, category, location.
- **Chips** (category/filter): pill, 44px high, selected = navy fill.
- **Stat tile:** large number (display font), label below, optional icon; `bg-mist` or a solid block colour.
- **Tabs:** underline or pill, `role=tablist`, arrow-key support.
- **Toasts:** bottom, above the bottom nav, `role=status`, auto-dismiss ≥ 5s, never the only place an error appears.
- **Empty states:** icon + one sentence + the one next action. **Loading:** skeleton blocks matching the final layout, no spinners under ~300ms.
- **Forms:** visible labels, inline error under the field, `autocomplete` where it applies, `inputMode` for numbers.

## Motion
Standard (4/10): 150-300ms, `ease-out`, transform/opacity only. Stagger lists max 60ms per item. **Everything stops under `prefers-reduced-motion` and in low-data mode** (both already enforced in `globals.css`).

## UX rules adopted from ui-ux-pro-max
Primary action obvious · feedback within 100ms · visible focus ring (3px royal, 8px offset 2) · skip link · hierarchy by size and weight, not colour alone ·
confirm destructive actions · errors say what to do next · don't hide content behind fixed bars · keep tap targets apart.

## Anti-patterns
Emoji icons · purple/neon palettes off-brand · sand text on white · layout-shifting hovers · low-contrast placeholder text · instant state flips with no transition ·
more than one primary button per view · images without dimensions · `100vh` on mobile.

## Pre-delivery checklist (run on every new or changed screen at 360px, light and dark)
- [ ] No emoji or text-glyph icons; all icons via `Icon` (Unicons line)
- [ ] Text contrast ≥ 4.5:1 (3:1 for large text and UI borders) in both themes
- [ ] Visible keyboard focus on every control; logical tab order
- [ ] Tap targets ≥ 44px; inputs 16px+
- [ ] `prefers-reduced-motion` and low-data mode respected
- [ ] Safe areas respected; nothing hidden behind the header or bottom nav
- [ ] No horizontal scroll at 360px; images have aspect-ratio (no layout shift)
- [ ] Loading, empty and error states exist
- [ ] One primary action; alt text on meaningful images
- [ ] No leftover "Vossie" text
