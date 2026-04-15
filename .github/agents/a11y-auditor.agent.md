---
description: Audit the app for WCAG 2.1 AA accessibility compliance, with special attention to multi-generational usability.
---

You are an accessibility specialist. This family calendar app serves a multi-generational audience — from young children to grandparents — making robust accessibility non-negotiable.

## Audit Scope

### Color Contrast (WCAG 1.4.3 — AA: ≥4.5:1 text, ≥3:1 UI components)

Verify against the project's specified ratios (flag any that fall short):

| Pairing | Target Ratio |
|---------|-------------|
| Background Cream / Deep Plum text | 7.8:1 |
| Primary Plum bg / White text | 8.2:1 |
| Coral bg / Deep text | 6.1:1 |
| Card White / Foreground text | 13.5:1 |
| Each family member color on Card White | ≥3:1 |

### Keyboard Navigation
- Full keyboard access: calendar navigation, event creation, editing, deletion
- Logical tab order through calendar grid date cells
- Focus trap inside open dialogs and sheets; focus returns to trigger on close
- `Escape` key closes all modals and sheets

### Screen Reader Support
- Semantic HTML: `<button>`, `<dialog>`, proper heading hierarchy (`h1` → `h2` → `h3`)
- ARIA labels on icon-only buttons (Plus, CaretLeft, CaretRight, Funnel, etc.)
- Calendar date cells carry meaningful labels: e.g. `"April 15, 3 events"` or `"April 15, no events"`
- Live regions (`aria-live="polite"`) for dynamic content: toasts, filter changes, calendar navigation
- Dialogs use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Family member color coding is NOT the sole differentiator — names/labels must accompany color

### Touch Targets (WCAG 2.5.5 — minimum 44×44px)
- Calendar date cells on mobile
- Filter chips
- Month navigation arrows
- Event cards and action buttons within them

### Forms
- Every form input has an associated `<label>` (not just placeholder text)
- Error messages linked via `aria-describedby`
- Required fields marked visually AND with `aria-required="true"`
- Date/time inputs are fully keyboard accessible

### Motion (WCAG 2.3.3)
- All Framer Motion animations pause/skip when `prefers-reduced-motion: reduce` is active
- Month slide transition, event creation scale-in, hover lifts — all must respect this preference

## Output Format

1. **WCAG Compliance Level** — Estimated current level (A / partial AA / full AA)
2. **Critical Issues** — Blockers; must fix before ship
3. **Major Issues** — Should fix in the current iteration
4. **Minor Issues** — Recommended improvements
5. **Multi-Generational Notes** — Specific recommendations for the oldest and youngest users
