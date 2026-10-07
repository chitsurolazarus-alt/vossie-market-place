# UI audit: responsive and mobile (Stage 2)

Run with `node --env-file=.env.local scripts/responsive-audit.mjs` against `next start` (port 3111).
It signs in as a buyer, a seller, an admin and a mentor and visits **35 routes** at **360, 375, 414, 768, 1024 and 1440px**, in **light and dark**.
Per page it checks: horizontal scroll, clipped text, inputs under 16px (iOS zoom), images with no reserved box (layout shift),
content hidden behind the fixed bottom bar, and (≤414px) tap targets under 44px. Screenshots go to `shots/audit*` (git-ignored).

**Before: 80 issue instances in 4 groups. After: 0.**

| Route(s) | Issue | Width | Fix | Before → after |
|---|---|---|---|---|
| Every page (35 routes) | **Horizontal scroll.** The desktop nav and header actions appeared at `md` (768px) and were wider than the screen (`scrollWidth` 814–891 > 768) | 768 | Desktop nav now starts at `lg` (1024px). The bottom nav, bottom padding and toast offset follow the same breakpoint (`Header`, `BottomNav`, `layout`, `Toast`) | 35 pages overflowing → 0 |
| `/sell` | Hub-post link only 28px tall | 375, 414 | Link is a `min-h-11` flex row | 28px → 44px |
| `/admin/audit` | Audit flagged 118–134px of content "under the bar" | ≤768 | **False positive.** The text was a collapsed `<details>` block that still reports a box. The audit now skips collapsed details; no page change needed | flagged → clean |
| `/browse` (found while fixing) | The new category chip scroller made the results column as wide as all chips (`scrollWidth` 1524 > 768), because a grid child needs `min-w-0` | 768, 1440 | `min-w-0` on the results section, so the chips scroll inside their own strip | 1524px → 768px |

## Fixed without a scanner hit (checked by reading the code)
| Area | Issue | Fix |
|---|---|---|
| Whole app | No `viewport-fit=cover`, so `env(safe-area-inset-*)` is always 0 on iPhones in standalone mode | `viewportFit: "cover"` in `layout.tsx` |
| Header | Notch would overlap the sticky header | `pt-[env(safe-area-inset-top)]` |
| Bottom nav + page | Home-indicator area overlapped the nav, and page padding was a fixed `pb-24` | Nav has `pb-[env(safe-area-inset-bottom)]`; `main` has `pb-[calc(5rem+env(safe-area-inset-bottom))]` |
| Browse filter sheet | `max-h-[88vh]` (the iOS toolbar hides part of it) | `88dvh`, safe-area bottom padding, drag handle, scroll lock already present |
| All inputs | Must be ≥16px so iOS never zooms | `inputCls` is `text-base`; audit found 0 violations |
| Images | Must reserve space | Listing cards use a fixed `aspect-[4/3]` well; audit found 0 images without a box |
| Icons / emoji | Emoji and text glyphs (✓ × ← 🎓) used as icons, inconsistent sizes | One `Icon` component, Unicons line style, sizes 16/20/24 (see `design-system/hustlehub/MASTER.md`) |

## Not covered
Real iPhone/Android devices (the audit uses Chrome mobile emulation), screen readers, and any route that needs data the demo accounts do not have
(for example an open dispute).
