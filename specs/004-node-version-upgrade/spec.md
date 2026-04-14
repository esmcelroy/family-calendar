# Feature Specification: Node.js Version Pinning & Upgrade to v22 LTS

**Feature Branch**: `004-node-version-upgrade`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: Pin Node.js to version 22 LTS and upgrade runtime toolchain configuration

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Runs on Node 22 LTS (Priority: P1)

A developer clones the repo and runs `npm install && npm run dev` on Node 22 LTS without warnings, deprecation errors, or version mismatch messages. The `.nvmrc` (or Volta config) automatically selects the correct version.

**Why this priority**: Node 20 reaches end-of-life in April 2026. Running on EOL runtime is a security and operational risk.

**Independent Test**: `node --version` shows `v22.x.x`. `npm run dev` starts successfully. `npm run build` completes without errors.

**Acceptance Scenarios**:

1. **Given** a developer has nvm or Volta installed, **When** they enter the project directory, **Then** the runtime automatically switches to the pinned Node 22 version.
2. **Given** Node 22 is active, **When** `npm install` and `npm run build` are run, **Then** both complete without errors or engine warnings.
3. **Given** a developer uses a Node version outside the supported range, **When** they attempt `npm install`, **Then** npm prints a clear engine warning identifying the required version.

---

### User Story 2 - Version is Consistent Across All Environments (Priority: P2)

The Node version used by a developer locally, in CI/CD, and in any deployment environment is the same—preventing "works on my machine" failures.

**Why this priority**: Version drift between environments is a leading cause of hard-to-diagnose build and test failures.

**Independent Test**: Confirm the pinned version in `.nvmrc` (or `volta.node` in `package.json`) matches the version installed in the GitHub Actions workflow.

**Acceptance Scenarios**:

1. **Given** the project's version config files, **When** read from any environment (local, CI, review), **Then** they all reference the same Node major version.
2. **Given** the `package.json` `engines` field is set, **When** a contributor installs an incompatible version, **Then** they receive an actionable error.

---

### Edge Cases

- What if a contributor uses a Node version manager other than nvm (e.g., asdf, Volta, fnm)? The `.nvmrc` file and `engines` field in `package.json` provide version guidance regardless of version manager.
- What if the project requires a native module that has not been compiled for Node 22? No native modules are currently used; if one is added later it must be Node 22-compatible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST declare a `.nvmrc` file at the repository root pinning the major Node version to 22.
- **FR-002**: The `package.json` `engines` field MUST specify `"node": ">=22"` (or a precise 22.x LTS version).
- **FR-003**: All npm scripts (`dev`, `build`, `lint`, `preview`) MUST execute without errors on Node 22 LTS.
- **FR-004**: The project MUST NOT use any API that is deprecated or removed in Node 22 without a documented replacement.
- **FR-005**: Documentation (README or contributing guide) MUST reference the required Node version and how to install it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run build` completes successfully on Node 22 LTS with zero errors and zero engine warnings.
- **SC-002**: `npm run dev` starts the dev server successfully on Node 22 LTS.
- **SC-003**: The `.nvmrc` file exists at the repository root and contains a Node 22.x version string.
- **SC-004**: `node --version` in CI reads `v22.x.x` and matches the pinned version.

## Assumptions

- The project currently uses no native addons that require recompilation for Node 22.
- Vite and all current dependencies are compatible with Node 22; any incompatible transitive dependency will be identified and updated as part of this feature.
- Only the runtime version is in scope — no changes to deployment infrastructure or containerization are required.
