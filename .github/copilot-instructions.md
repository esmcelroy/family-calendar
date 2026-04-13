# Copilot Instructions

## Tooling Overview

### Spec & Feature Design — speckit
Use **speckit** agents for building specs and feature descriptions before implementation begins. Specs live in `specs/`. Always produce or consult a spec before starting non-trivial feature work.

#### speckit agent workflow

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `speckit.specify` | Turn a natural-language description into a structured feature spec (`spec.md`) |
| 2 | `speckit.clarify` | Identify underspecified areas and resolve up to 5 targeted ambiguities |
| 3 | `speckit.plan` | Produce technical design artifacts: `research.md`, `data-model.md`, contracts, `quickstart.md` |
| 4 | `speckit.tasks` | Break the plan into a dependency-ordered `tasks.md` |
| 5 | `speckit.implement` | Execute tasks from `tasks.md` one by one |
| – | `speckit.analyze` | Cross-artifact consistency check (non-destructive, run any time) |
| – | `speckit.checklist` | Generate a custom feature checklist |
| – | `speckit.constitution` | Create/update the project constitution and keep templates in sync |
| – | `speckit.taskstoissues` | Convert `tasks.md` entries into GitHub Issues |

#### Key principles
- Specs describe **what** users need and **why** — never **how** to implement
- Written for non-technical stakeholders; no framework/language details in specs
- Success criteria must be measurable, technology-agnostic, and user-focused
- Maximum 3 `[NEEDS CLARIFICATION]` markers per spec; make informed guesses otherwise

### Local Work Tracking — beads (`bd`)
Use **beads (`bd`)** for all local issue and task tracking during a session.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

- Do NOT use markdown TODO lists, TodoWrite, or TaskCreate for tracking
- Use `bd remember` for persistent knowledge instead of MEMORY.md files

### Cloud Issue Sync — GitHub Issues
Use **GitHub Issues** for cloud-synced, shareable issue tracking.

- File issues for bugs, features, and follow-up work that need to be visible beyond the local session
- Link GitHub issues to beads entries where appropriate
- Use `gh issue create`, `gh issue list`, etc. for CLI-based interaction

## Supporting Agent Personas

Five specialist personas are available as agents and prompts. Invoke them at key points in the development workflow — after implementation, before a PR, or when investigating a specific concern.

### Persona Overview

| Agent | When to Use |
|-------|------------|
| `ux-reviewer` | After building or changing a UI feature — validate against the welcoming/organized/playful design direction |
| `a11y-auditor` | Before shipping any feature — verify WCAG 2.1 AA compliance and multi-generational usability |
| `code-reviewer` | After implementation — review TypeScript quality, React patterns, and `useKV` usage |
| `qa-tester` | After a spec exists — generate Vitest test cases mapped to success criteria and PRD edge cases |
| `design-guardian` | When touching components — enforce color tokens, typography scale, spacing, Phosphor icons, and animation timing |

### When to Invoke Each Persona

```
speckit.specify → speckit.plan → speckit.tasks → speckit.implement
                                                        ↓
                                              code-reviewer (post-implement)
                                              design-guardian (post-implement)
                                              qa-tester (alongside/after implement)
                                              ux-reviewer (after visual work)
                                              a11y-auditor (before ship)
```

### Key Rules for Personas

- `design-guardian`: icons must come from `@phosphor-icons/react` only — not Lucide or Heroicons
- `a11y-auditor`: color coding must never be the *sole* differentiator — labels must accompany color
- `code-reviewer`: `useKV` is the source of truth for persistent state; do not duplicate with `useState`
- `qa-tester`: always cover the 6 PRD edge case categories (empty states, date boundaries, long text, overlapping events, past events, no-members fallback)
- `ux-reviewer`: all touch targets must be ≥44×44px; animations stay in the 200–300ms window

## Development Workflow

### Test-Driven Development
This project follows a TDD workflow using **Vitest** and **React Testing Library**.

#### The red-green-refactor cycle
1. **Red** — write a failing test that describes the expected behaviour before writing any implementation
2. **Green** — write the minimum code needed to make the test pass
3. **Refactor** — clean up the implementation while keeping all tests green
4. Do not mark work done until tests pass and coverage gates are met

#### Test commands
```bash
npm test                # run all tests
npm run test:coverage   # run tests with coverage report
npm run lint            # lint source files
```

#### Coverage thresholds
- `src/lib/` utilities: **70% line coverage**, **60% branch coverage** (minimum)
- Coverage is enforced in CI — the suite must exit 0 before a PR can merge

#### What to test
- **Unit tests**: every function in `src/lib/` (e.g. `calendar.ts`, `utils.ts`) must have at least one unit test
- **Component tests**: render components with known props/events and assert on visible output and callbacks
- **Mocking**: mock `localStorage` and browser-only APIs in the test environment; do not access real storage from tests
- **Assets**: CSS/asset imports must be handled (ignored or mocked) by the test config — never let them break the suite

#### Conventions
- Test files live alongside the source file: `src/lib/calendar.test.ts` for `src/lib/calendar.ts`
- Tests use accessible queries (`getByRole`, `getByLabelText`) rather than implementation selectors
- New utility functions and components require tests written **before** the implementation (not after)

### Session Completion
Work is **not complete** until committed and pushed. Before ending a session:

1. File GitHub issues for any remaining/follow-up work
2. Run quality gates (tests, linters, build)
3. Close or update beads issues
4. Push everything:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   ```
5. Verify `git status` shows "up to date with origin"
