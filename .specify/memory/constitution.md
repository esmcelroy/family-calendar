<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump type: MINOR (material expansion of Principle IV; adds optional server-backed
mode as a conditional to the existing local-first default — no existing mode removed)

Modified principles:
  - Principle IV: Local-First Data Persistence — conditional server-backed mode added;
    local-first default and localStorage fallback requirement retained verbatim.
    Abstraction-layer requirement strengthened to explicitly support backend swapping.

Added sections: None
Removed sections: None

Templates reviewed:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate present and
     generic; Principle IV check will now flag server-backed work and require the
     DATABASE_URL conditional to be documented. No template text change needed.
  ✅ .specify/templates/spec-template.md — No constitution references; unchanged.
  ✅ .specify/templates/tasks-template.md — Unchanged; task structure is neutral.
  ✅ .specify/templates/checklist-template.md — Unchanged.

Follow-up TODOs:
  - spec 011 Constitution Note should be updated to reference v1.1.0 as the
    version that unblocks it (editorial only, not a blocker).
-->

# Family Calendar Constitution

## Core Principles

### I. Component-Driven Architecture

The UI MUST be composed of discrete, reusable components. `shadcn/ui` is the
canonical component foundation; custom components MUST extend or compose from
it rather than building raw from scratch. Every component MUST have a single,
clear responsibility. Shared logic MUST be extracted into custom hooks under
`src/hooks/`. Components MUST NOT contain business logic that belongs in a
hook or utility.

**Rationale**: Consistency, maintainability, and design-system alignment are
non-negotiable in a consumer-facing family app where multiple contributors
will touch the codebase.

### II. TypeScript Strictness

All source files MUST be TypeScript. The use of `any` is FORBIDDEN without
an explicit inline suppression comment explaining why no type-safe alternative
exists. Shared domain types MUST live in `src/lib/types.ts`. Type assertions
(`as`) MUST only be used when TypeScript's inference is provably insufficient
— not as a shortcut.

**Rationale**: A fully typed codebase prevents entire categories of runtime
bugs and improves IDE-assisted development across contributors of varying
experience levels.

### III. Accessibility First

Every interactive element MUST be keyboard-navigable and focusable.
Color contrast MUST meet WCAG 2.1 AA minimums (4.5:1 for normal text,
3:1 for large text). Family member color coding MUST NOT be the sole
means of conveying information — labels or patterns MUST supplement color.
All dialog and modal components MUST trap focus and support Escape-to-close.

**Rationale**: The app serves multiple generations — from young children to
grandparents — and MUST not exclude users with visual or motor impairments.

### IV. Local-First Data Persistence (Default Mode)

**Local-first is the default and MUST be the mandatory baseline deployment mode.**
When no server backend is configured, all application state MUST persist
client-side using `localStorage` as the primary store. This mode requires no
server, no database, and no user accounts, and MUST remain fully functional
with zero additional configuration.

**Optional server-backed mode**: When an explicit environment configuration is
provided (e.g., a `DATABASE_URL` environment variable), the app MAY switch to
a server-backed persistence layer (e.g., PostgreSQL) to support multi-device
synchronization and user authentication. This mode is strictly opt-in for
self-hosted deployments and MUST NOT degrade, remove, or depend on disabling
the local-first mode.

**In both modes**, data MUST be (de)serialized through a dedicated abstraction
layer in `src/lib/` that hides the underlying store. Raw `JSON.parse` or
`localStorage.setItem` MUST NOT be scattered across components. The abstraction
layer MUST be designed to support backend swapping without changes outside the
`src/lib/` utilities.

State MUST be initialized with sensible defaults and gracefully handle
corrupted or missing storage entries in local mode.

**Rationale**: The PRD defines the base product as a Light Application
with no required external integrations. Local-first eliminates infrastructure
cost and privacy concerns for the common household use-case. The optional
server-backed mode extends the product for technically inclined families
who want multi-device sync and shared accounts on their own infrastructure,
without affecting any user who does not opt in.

### V. Simplicity & YAGNI

Features MUST be implemented to the PRD specification exactly — no speculative
additions. Abstractions MUST NOT be created unless they are used in two or
more places. Dependencies MUST NOT be added without explicit feature need;
prefer utilities already present in the stack (`date-fns` via the existing
`calendar` utility, Radix primitives, Tailwind utilities) over new third-party
packages.

**Rationale**: Over-engineering a Light Application increases maintenance
burden, bundle size, and friction for future contributors without delivering
user value.

## Technology Stack

- **Language**: TypeScript (strict mode)
- **Framework**: React 18+ with function components and hooks only; class
  components are FORBIDDEN
- **Build tool**: Vite
- **Styling**: Tailwind CSS; inline `style` props MUST NOT be used for
  layout or theming — use Tailwind utility classes or CSS variables defined
  in `src/styles/theme.css`
- **Component library**: shadcn/ui (Radix UI primitives + Tailwind)
- **Icons**: Phosphor Icons (`@phosphor-icons/react`); do NOT mix
  icon libraries
- **Form handling**: React Hook Form + Zod for validation when forms involve
  more than two fields
- **Runtime environment**: Browser only (no SSR, no Node.js runtime code in
  `src/`)

## Quality & Development Standards

- All new components MUST be co-located in the appropriate directory:
  generic UI → `src/components/ui/`, feature-level → `src/components/`
- PRD-defined edge cases (empty states, date boundaries, overlapping events,
  long text truncation, past-event muting) MUST be handled before a feature
  is considered complete
- Responsive layout MUST support mobile and desktop viewports; the `use-mobile`
  hook in `src/hooks/` is the canonical viewport detection mechanism
- Commits MUST be scoped and descriptive (e.g., `feat(calendar): add month
  navigation`, `fix(event-dialog): validate empty title`)
- No `console.log` statements in production code paths; use structured error
  boundaries (`src/ErrorFallback.tsx`) for runtime error surfacing

## Governance

This constitution supersedes all other development practices and conventions
for the Family Calendar project. Amendments require:

1. A documented rationale explaining what changed and why
2. A version bump following semantic versioning:
   - **MAJOR**: Backward-incompatible removal or redefinition of a principle
   - **MINOR**: New principle, section added, or material expansion of guidance
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements
3. A Sync Impact Report (as an HTML comment at the top of this file) listing
   all affected templates and whether they were updated
4. All dependent templates in `.specify/templates/` MUST be reviewed for
   consistency after any amendment

All feature plans (`plan.md`) MUST include a Constitution Check gate that
verifies compliance with the active principles before implementation begins.

**Version**: 1.1.0 | **Ratified**: 2026-04-13 | **Last Amended**: 2026-04-13
