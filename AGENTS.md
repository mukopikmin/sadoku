# Agent Instructions for Sadoku

These technical guidelines apply to the entire repository. Agents MUST follow
them when making changes.

## 1. Quality Control (Highest Priority)

- Use `.github/workflows/test.yml` as the source of truth for required checks.
  Run the checks relevant to the changed code before submitting it.
- Prefer the stable project entry points defined in `deno.json` and
  `package.json` instead of duplicating their underlying commands.
- Use `npm install` to install dependencies. The root `postinstall` installs the
  preview client's dependencies under `src/preview/`.
- Keep `deno.lock`, the root `package-lock.json`, and
  `src/preview/package-lock.json` consistent with dependency changes.
- Add or update focused tests for behavior changes. Do not rely only on a
  successful build.

## 2. Project Architecture

- Treat `src/server/` as the backend boundary shared by HTTP and command-line
  entry points. Organize backend code by adapter and application-layer role:
  keep backend CLI adapters in `src/server/cli/`, HTTP/API adapters in
  `src/server/` (or a feature-specific API directory), use cases in
  `src/server/usecase/`, and persistence implementations in the appropriate
  `src/server/` storage or feature directory.
- Name feature-specific backend adapters by feature and adapter role. Use
  `<feature>_cli.ts` under `src/server/cli/` for command-line adapters and
  `<feature>_api.ts` under `src/server/api/` for HTTP/API adapters; use the same
  stem for their co-located `*_test.ts` files.
- Keep all command-line interfaces under `src/server/cli/`, including
  application-wide argument parsing, browser-launch behavior, update commands,
  and feature-specific CLI adapters. CLI adapters call the relevant use cases
  and remain separate from HTTP/API adapters.
- Keep `src/main.ts` as a thin executable entry point that delegates command
  handling to `src/server/app.ts`; do not place command dispatch or server-side
  orchestration in it. Use `src/server/app.ts` as the composition root that
  connects CLI adapters to server lifecycle implementations.
- Keep HTTP routing and server lifecycle behavior in `src/server/`. HTTP
  handlers must remain adapters: parse transport input, call use cases, map
  use-case errors to HTTP responses, and avoid owning business rules.
- Keep backend business rules and orchestration in `src/server/usecase/`. Use
  cases must be functions and plain objects, depend on explicit ports, and
  remain independent of Deno, HTTP `Request`/`Response`, and CLI input/output.
- Name use-case feature directories for the domain concept in the singular (for
  example, `src/server/usecase/comment/`). Do not derive use-case names from
  REST resource collection paths.
- Put each use-case operation in its own verb-oriented snake-case module (for
  example, `add_comment.ts` and `delete_reply.ts`). Keep `mod.ts` as a thin
  public export surface only; do not place use-case implementations in it.
- Define persistence and other infrastructure ports with their owning use case.
  Infrastructure implementations, database connections, notifications, and
  resource lifecycle/close behavior remain under `src/server/` and depend on
  those ports, not the reverse.
- Keep preview document, asset, shell, and event-stream handling in
  `src/server/preview/`.
- Keep comment HTTP handling in `src/server/api/comment_api.ts`, comment CLI
  adaptation in `src/server/cli/comment_cli.ts`, comment business rules in
  `src/server/usecase/comment/`, and comment persistence implementations in
  `src/server/storage/comment/`.
- Keep database connections and migrations in `src/server/db/`. Keep storage
  implementations and their selection under `src/server/storage/`, grouped by
  singular domain concept.
- Treat database migrations as append-only. Never edit a migration after it has
  been added; add a new migration with the next four-digit zero-padded version
  instead. Register each migration in `MIGRATIONS` and add a co-located test
  covering fresh-database behavior and, when applicable, upgrades from the
  previous schema.
- Write persistent configuration and storage files atomically: create and finish
  writing a temporary file in the destination directory, then rename it into
  place. Clean up temporary files on failure, and do not truncate an existing
  persistent file before its replacement has been written successfully.
- Keep browser-side React code in `src/preview/`.
- Keep HTTP response types and response-to-model conversion at the
  `src/preview/api/` boundary. Keep browser-side domain models in
  `src/preview/models/`.
- Keep Markdown rendering infrastructure in `src/preview/markdown/`, with
  element-specific renderers in `src/preview/markdown/renderers/`.
- Keep release, installation, and notice-generation logic in `scripts/`.
- Preserve the boundary between the Deno server and the browser client. Pass
  data through the existing HTTP endpoints instead of importing server modules
  into client code.
- Treat existing HTTP endpoint paths, status codes, and response fields as
  contracts between the Deno server and preview client. When changing a
  contract, update the server adapter tests, preview API response types and
  conversion tests, and at least one behavioral client or integration test in
  the same change. Prefer backward-compatible additions over silently renaming
  or removing fields used by the preview client.
- Build HTTP responses through the shared helpers in `src/server/responses.ts`;
  do not duplicate common response construction in individual handlers. Serve
  dynamic preview, comment, and settings data with `Cache-Control: no-store`
  unless the resource has an explicit immutable caching policy. Use
  `204 No Content` for successful delete operations that return no updated
  resource.
- Map discriminated use-case errors explicitly at each adapter boundary. Keep
  HTTP status codes and response wording out of use cases.
- For remote Markdown sources, preserve the complete URL only for fetching. Use
  the canonical comment source, with query strings and fragments removed, for
  document identity and persistent comment storage. Do not persist credentials,
  access tokens, or other URL query parameters in document or comment
  identifiers. Reuse `createPreviewSource` instead of implementing source
  canonicalization independently.

## 2.1 TypeScript Style

- Prefer plain objects, functions, and factory helpers over `class`
  declarations. Do not introduce classes unless there is a strong
  interoperability reason.
- Error subclasses are an allowed interoperability exception when callers need
  `instanceof Error`, a distinct error type, or structured error metadata.
  Prefer discriminated plain-object errors for use-case business failures.

## 3. Deno and Runtime Behavior

- Use Deno and Web Platform APIs in server code unless an existing dependency
  already provides the required behavior.
- Keep Deno permissions narrowly scoped. When adding a runtime capability,
  update the relevant task or script with only the required `--allow-*`
  permission.
- Run Deno commands with `DENO_NO_PACKAGE_JSON=1` where the existing tasks do
  so, to prevent the root npm configuration from changing Deno resolution.
- Preserve the default security behavior: bind to `127.0.0.1`, escape raw HTML
  in Markdown, and serve Mermaid assets locally.
- Do not weaken path handling, response escaping, or request validation for
  convenience. Treat Markdown and comment contents as untrusted input.

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
- Build preview UI with Chakra UI components and existing Sadoku semantic
  tokens. Prefer Chakra layout and style props over new ad hoc CSS. Add reusable
  colors to `src/preview/theme.ts` as semantic tokens with both light and dark
  values; do not hard-code theme-specific colors in feature components. Reuse
  components under `src/preview/components/ui/` before introducing a new dialog,
  notification, or common control implementation.
- Lay out Markdown document blocks as a stack with a consistent `gap`. Do not
  create block-to-block spacing with margins on individual Markdown elements.
- When a Markdown element needs additional vertical breathing room, add padding
  inside that element's commentable content instead. The padding must be
  included in the selectable comment-highlight area.
- Keep Markdown feature support aligned with the table in `README.md`. Update
  the table and tests when support changes.
- `src/preview/dist/`, root `dist/`, `sadoku`, and `THIRD_PARTY_NOTICES.md` are
  generated outputs and MUST NOT be committed.
- Build client assets with `npm run build:client`; do not edit generated files
  under `src/preview/dist/`.
- Keep Mermaid rendering functional without CDN or other network access.

## 5. Testing Conventions

- Co-locate Deno unit tests with their implementation using `*_test.ts`.
- Put cross-module server workflows in `test/integration/`.
- Put preview client tests in `src/preview/test/` using Vitest and Testing
  Library.
- Prefer behavioral tests through public functions, HTTP requests, or rendered
  UI. Avoid tests coupled to private implementation details.
- Use temporary files and ephemeral or explicitly reserved loopback ports. Tests
  must not open a real browser or depend on external network services.
- When changing generated archives or binaries, verify the relevant `compile`,
  `dist`, or installation path in addition to unit tests.

## 6. GitHub Actions and Communication

- For stable releases, follow `.agents/skills/sadoku-release/SKILL.md` and use
  the repository release tasks and approval gates defined there.
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
