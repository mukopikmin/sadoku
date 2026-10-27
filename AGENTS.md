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
  `npm install` directly, the root `postinstall` also installs the preview client's
  dependencies under `src/preview/`.
- Keep the root `package-lock.json` and
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

- The production server and CLI are implemented in Go. `cmd/sadoku/main.go` is
  the executable entry point and delegates to `src/server/app.go`.
- Keep native code under the corresponding `src/server/` boundaries: `cli/`,
  `http/` and `http/api/`, `session/`, `storage/`, `db/`, and `usecase/`.
- Use Go's standard library for runtime facilities. Keep domain operations as
  functions and plain data with explicit persistence ports.
- Run `make build-client` before Go builds or tests; `src/preview/assets.go`
  embeds the generated client. Never commit client build outputs.
- Validate Go changes with `make check-go-format`, `make vet`, and `make test-server`.
  Co-locate Go tests as `*_test.go` and preserve existing protocol contracts.
- Keep `go.mod` and `go.sum` consistent. Use `CGO_ENABLED=0` for release builds.
- `src/server/db/migrations/legacy.json` preserves the exact original migration
  statements and checksums; treat it as append-only. Never rewrite an applied
  statement or checksum during migration to Go.
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

- Build, source installation, and notice tools use Go under `internal/tooling/`,
  with the entry point `cmd/sadoku-tools/`. Release validation and note generation
  use Bash, Git, GitHub CLI, and jq in `scripts/release.sh`.
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
  tokens. Prefer Chakra layout and style props over new ad hoc CSS. Add reusable
  colors to `src/preview/theme.ts` as semantic tokens with both light and dark
  values; do not hard-code theme-specific colors in feature components. Reuse
  components under `src/preview/components/ui/` before introducing a new dialog,
  notification, or common control implementation.
- Prefer toolkit defaults, responsive component recipes, semantic tokens, and
  component props such as `size` over explicit values or custom code. Add an
  override only when a product requirement cannot be expressed by the toolkit's
  existing API.
- Lay out Markdown document blocks as a stack with a consistent `gap`. Do not
  create block-to-block spacing with margins on individual Markdown elements.
- When a Markdown element needs additional vertical breathing room, add padding
  inside that element's commentable content instead. The padding must be
  included in the selectable comment-highlight area.
- Keep Markdown feature support aligned with the table in `README.md`. Update
  the table and tests when support changes.
- `src/preview/dist/`, root `dist/`, `sadoku`, and `THIRD_PARTY_NOTICES.md` are
  generated outputs and MUST NOT be committed.
- Build client assets with `make build-client`; do not edit generated files
  under `src/preview/dist/`.
- Keep Mermaid rendering functional without CDN or other network access.

## 5. Testing Conventions

- Co-locate server and tooling unit tests as `*_test.go`.
- Put cross-module Go server workflows in `test/integration/`.
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
