# Agent Instructions for Sadoku

These technical guidelines apply to the entire repository. Agents MUST follow
them when making changes.

## 1. Quality Control (Highest Priority)

- Use `.github/workflows/test.yml` as the source of truth for required checks.
  Run the checks relevant to the changed code before submitting it.
- Immediately before creating a pull request, re-read
  `.github/workflows/test.yml` and run every check from its primary test job in
  the same order, even when a check does not appear related to the files
  changed. Do not rely on checks run earlier during implementation: the final
  committed tree is what must be verified. Run any additional platform-specific
  job that is supported by the current environment.
- Do not create the pull request until those final checks pass. If a required
  check cannot run because of an environment limitation, identify the limitation
  before attempting to create the pull request and clearly report the unverified
  check; never describe an incomplete or failed check as successful.
- Use `Makefile` as the entry point for Go, release, and npm tasks. Keep
  `package.json` scripts limited to npm and Node tooling.
- Use `make deps` to install npm dependencies from the lockfiles. When using
  `npm install` directly, install the protocol tooling in `src/proto/` and the preview client in
  `src/preview/`.
- Keep `src/proto/package-lock.json` and
  `src/preview/package-lock.json` consistent with dependency changes.
- Add or update focused tests for application behavior changes. Do not rely only
  on a successful build.
- Keep test additions proportional to the change. Changes limited to preview
  sample data or seed values do not need dedicated automated tests unless the
  user explicitly requests them. Validate them with shell syntax checks and the
  existing CLI instead of adding tests that mirror the sample values. Changes to
  seed control flow or error handling may still need focused tests.
- GitHub Actions workflow changes are an exception to the focused-test
  requirement: do not add or expand automated tests for workflow configuration
  or embedded workflow scripts unless the user explicitly requests them. Use
  formatting, workflow linting, and existing required CI checks to validate
  these changes.

## 2. Production Go Backend

- The production server and CLI are implemented in Go. `src/server/cmd/sadoku/main.go` is
  the executable entry point and delegates to `src/server/internal/server/app.go`.
- Keep native code under the corresponding `src/server/internal/server/` boundaries: `cli/`,
  `http/` and `http/api/`, `session/`, `storage/`, `db/`, and `usecase/`.
- Use Go's standard library for runtime facilities. Keep domain operations as
  functions and plain data with explicit persistence ports.
- Run `make build-client` before Go builds or tests; `src/server/internal/preview/assets.go`
  embeds the generated client. Never commit client build outputs.
- Validate Go changes with `make check-go-format`, `make lint-go`, `make vet`, and `make test-server`.
  For proxy changes, use `make check-proxy-format`, `make lint-proxy`, and
  `make test-proxy`. Install the golangci-lint version pinned in
  `.golangci-lint-version`; keep local and CI lint checks on the same version.
  Co-locate Go tests as `*_test.go` and preserve existing protocol contracts.
- Keep `go.mod` and `go.sum` consistent. SQLite uses `mattn/go-sqlite3` and
  requires `CGO_ENABLED=1` and a C compiler. Build release binaries on their
  target OS/architecture; cross-compilation requires a target C toolchain.
- `src/server/internal/server/db/migrations/legacy.json` preserves the exact original migration
  statements and checksums; treat it as append-only. Never rewrite an applied
  statement or checksum during migration to Go.
- Add new database migrations to `src/server/internal/server/db/migrations/current.json`. For
  constraints SQLite cannot add with ALTER TABLE, use a transactional table
  rebuild with the original table name, IDs, foreign keys, defaults, and indexes
  preserved. Follow `src/server/internal/server/db/migrations/README.md`; verify fresh/upgrade
  schema equality, repeat execution, rollback, and related-data preservation.
  Document explicit backfill policies for missing historical metadata; never
  infer unknown original text from the current document.
- Generate Go and TypeScript RPC bindings together using
  `make proto-generate`.
- Keep routing and API adaptation under `http/`, session preparation under
  `session/`, persistence under `storage/` and `db/`, and shared business rules
  and persistence ports under `usecase/`.
- Keep command dispatch and browser launching under `cli/`. The executable entry
  point stays thin and delegates application composition to `app.go`.
- Preserve existing HTTP paths, status codes, and response fields. When changing
  a contract, update server tests, client conversions, and a behavioral client
  or integration test in the same change.
- Serve dynamic data with `Cache-Control: no-store`; use `204 No Content` for
  successful deletes that return no resource.
- Write persistent configuration and files atomically, finishing a temporary
  file in the destination directory before renaming it into place. Clean up
  temporary files on failure and never truncate the previous file first.
- For remote Markdown, use complete URLs only for fetching. Use the existing
  source resolver to strip queries and fragments from persistent identities.
- Preserve loopback binding by default, escaped Markdown HTML, local Mermaid
  assets, safe file paths, and strict request validation.
- Do not reintroduce the removed TypeScript server or tests against it.

## 3. Repository Tooling

- Build, source installation, and notice tools use Go under `src/server/internal/tooling/`,
  with the entry point `src/server/cmd/sadoku-tools/`. Stable release validation, testing,
  attestation, note generation, and publication belong to the Release workflow.
- Keep tooling tests beside the implementation as `*_test.go`. Tests may execute
  scripts under `scripts/`; the inline GitHub JavaScript action test uses Node.
- Keep release validation and approval gates when changing those tools.
- Use Prettier for generated TypeScript bindings and the Node action test.

## 4. Preview Client and Generated Assets

- Follow the existing React and TypeScript patterns in `src/preview/`.
- Keep browser-side `fetch`, HTTP status handling, response types, and
  response-to-model conversion in `src/preview/api/`; UI components and pages
  must not call application endpoints directly.
- Manage server-backed preview state through the existing React Query hooks.
  Reuse query keys and invalidation helpers instead of creating independent
  component-local caches. Validate untrusted response fields at the API boundary
  when they affect rendering, routing, configuration, or discriminated model
  state.
- Extract stateful and behavioral frontend logic into focused custom hooks when
  practical, keeping components primarily responsible for rendering and wiring
  user interactions. Model each meaningful hook state as a discriminated union
  whenever possible so consumers must handle loading, success, empty, and error
  states explicitly instead of interpreting combinations of booleans and
  optional values.
- Build preview UI with Chakra UI components and existing Sadoku semantic
  tokens. Reuse components under `src/preview/components/ui/` before introducing
  a new dialog, notification, or common control implementation.
- For appearance changes, first choose Chakra's built-in `variant`,
  `colorPalette`, `size`, and `textStyle`. Prefer the nearest suitable built-in
  style over an exact visual match implemented with custom CSS, recipes, or
  one-off color tokens. For example, try `surface` for a more visible neutral
  button before overriding an `outline` border. Keep related controls on a
  common toolkit size, and use `textStyle="label"` for settings labels.
- When controls look different in size, compare their rendered dimensions, text
  and icon sizes, label widths, padding, and contrast in both themes before
  changing a shared size. Distinguish actual size differences from perceived
  differences caused by color or contrast.
- Add an override only for a concrete product requirement that cannot be met
  with the toolkit's existing API. Explain the unmet requirement and why the
  built-in options are insufficient in the pull request. If a new reusable color
  is necessary, define it in `src/preview/theme.ts` as a semantic token with
  both light and dark values; do not hard-code theme-specific colors in feature
  components. Remove unused overrides and tokens when returning to a built-in
  style.
- Let parent `Stack` or `Flex` components own spacing between UI sections with
  fixed `gap` values. Avoid combining that gap with child `mt`, `mb`, or `my`
  spacing, and remove wrappers used only to add such margins. Render optional
  badges and replies as optional children so gaps occur only between present
  items; do not branch on their presence to adjust margins or padding or reserve
  an empty badge row. Keep container padding consistent.
- Distinguish spacing around a control from padding inside it. Requests for
  space around badges should normally change the containing layout's gap, rather
  than the badges' internal padding or text size.
- Prefer toolkit-provided layout hooks, such as `useElementRect`, before adding
  custom measurement logic. Reserve the actual height of fixed controls such as
  the ActionBar in document flow, including safe-area space, and let
  measurements follow wrapping and font-size changes instead of guessing heights
  for each breakpoint.
- Lay out Markdown document blocks as a stack with a consistent `gap`. Do not
  create block-to-block spacing with margins on individual Markdown elements.
- When a Markdown element needs additional vertical breathing room, add padding
  inside that element's commentable content instead. The padding must be
  included in the selectable comment-highlight area.
- Keep the Markdown support summary in `README.md` aligned with supported
  behavior. Update the summary and tests when support changes.
- `src/preview/dist/`, root `dist/`, `sadoku`, and `THIRD_PARTY_NOTICES.md` are
  generated outputs and MUST NOT be committed.
- `src/server/internal/preview/dist/` is also generated and MUST NOT be committed.
- Build client assets with `make build-client`; do not edit generated files
  under `src/preview/dist/`.
- Keep Mermaid rendering functional without CDN or other network access.

## 5. Testing Conventions

- Co-locate server and tooling unit tests as `*_test.go`.
- Put cross-module Go server workflows in `src/server/test/integration/`.
- Put preview client tests in `src/preview/test/` using Vitest and Testing
  Library.
- Keep component tests to the minimum needed to verify rendering, accessibility,
  and user-visible integration behavior. Prefer focused hook tests for state
  transitions, branching logic, side effects, and error handling extracted from
  components.
- Focus preview component tests on semantic DOM structure, accessible names and
  roles, content, and user interactions. Do not assert cosmetic details such as
  exact colors, spacing, border widths, typography, CSS tokens, generated class
  names, or stylesheet text. Keep checks for user-selected settings and
  functional layout calculations in the appropriate behavioral or hook tests.
- Prefer behavioral tests through public functions, HTTP requests, or rendered
  UI. Avoid tests coupled to private implementation details.
- Use temporary files and ephemeral or explicitly reserved loopback ports. Tests
  must not open a real browser or depend on external network services.
- When changing generated archives or binaries, verify the relevant `make build`,
  `make dist`, or installation path in addition to unit tests.

## 6. GitHub Actions and Communication

- For stable releases, follow `.agents/skills/sadoku-release/SKILL.md` and use
  its approval gate before pushing a version tag. The tag-triggered Release
  workflow owns validation, artifact builds, provenance, notes, and publication;
  do not replace those checks with local inspection.
- Pin third-party GitHub Actions to a full commit hash and include a comment
  with the corresponding release tag.
- Keep workflow permissions minimal.
- Write commit messages, pull request descriptions, and GitHub issue comments in
  English unless the user explicitly requests another language.
- Do not add unnecessary prefixes such as `[codex]` to pull request titles.
- When work was started for the purpose of resolving an issue, include
  `Closes #<issue_number>` or an equivalent closing keyword in the pull request
  description so that merging the pull request closes the issue.

## 7. Tool Usage

- Prefer command-line tools for repository management, investigation, and
  verification.
- Use `rg` and `rg --files` for code and file searches.
- Do not treat a failed sandboxed `gh auth status` as proof that the token is
  invalid. Retry it with network-enabled or escalated execution, and ask the
  user to reauthenticate only if that retry confirms the token is invalid or
  expired.
- If authenticated `gh` is unavailable but GitHub MCP is available, use the MCP
  for repository and pull request operations. Ask the user for authentication or
  other action only when neither `gh` nor GitHub MCP is available.
- Treat Git remote authentication for operations such as `git push` as
  independent from GitHub CLI authentication.
- Do not modify or revert unrelated working-tree changes.

## 8. Documentation Scope

- Keep maintained usage, specification, development, and operations documents
  directly under `docs/`. Put task-specific plans, investigations, migration
  reports, and verification notes under `docs/work/`; these may be committed.
- Start each work document with its purpose, related issue or pull request
  (or explicitly state that none is recorded), and a concrete deletion condition.
  Before completing the related work, check that condition, move any durable
  knowledge into maintained documentation or a README beside the relevant code
  or fixtures, and delete the work document when its condition is met. Do not
  invent issue references or treat work documents as maintained specifications.
- Keep user-facing essentials together in the root `README.md`: what Sadoku
  does, installation, basic review usage, meaningful limitations, settings and
  storage, and developer prerequisites plus build/test commands.
- Judge documentation by usefulness and duplication, not line counts. Do not
  split basic usage into a separate user guide merely to shorten the README.
- A new feature does not automatically need new documentation. Update an existing
  summary when it changes what users can do or need to know to get started.
  Omit exhaustive UI steps, internal behavior, and feature-by-feature histories.
- Keep specialized CLI and agent workflows in `docs/cli-and-agents.md`, build
  and tooling details in `docs/development.md`, and stable release operations
  in `docs/releases.md`. Use CLI help for the full command and option list.
- During review, remove repetition, keep explanations proportional to the task,
  and check links when moving or deleting documentation. Link to specialized
  references where needed without duplicating their contents.

## 9. APM Skills Package Versioning

- When adding, removing, or changing a distributed skill under `skills/`,
  update the package version in root `apm.yml` in the same pull request.
- Use a minor version bump for new skills or backward-compatible capabilities,
  and a patch bump for corrections. Flag breaking changes explicitly and choose
  the appropriate version before submitting the pull request.
- Before creating or updating a pull request, compare `skills/` and `apm.yml`
  against the base branch to verify that skill changes include a version bump.
  One bump covers the pull request; do not bump again for each follow-up commit.
- This version belongs to the APM skills package. Updating it does not require
  tagging or publishing a Sadoku application release.
