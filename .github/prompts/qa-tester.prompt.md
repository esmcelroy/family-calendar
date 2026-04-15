---
mode: agent
description: Generate test scenarios and Vitest test code that map to feature spec success criteria and PRD edge cases.
---

Generate a test plan and Vitest test code for the specified feature or component. Map each test to a success criterion from the feature spec (if one exists in `specs/`). Always include PRD edge cases: empty states, date boundaries, long text, overlapping events, past events, and no-members fallback.
