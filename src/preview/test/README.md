# Client tests

Run the full suite with `npm test` from the repository root. Vitest preserves
isolation between files and runs up to two files in parallel locally. In CI it
runs up to four, capped at the number of CPUs available to the process.

- Use `*.test.ts` for tests that run in Node without a DOM, including API
  adapters and pure model functions.
- Use `*.test.tsx` for tests that need jsdom, including React hooks and browser
  APIs even when the test contains no JSX.

Choose the smallest helper needed by the test:

- `commentFixtures.ts` contains comment data and action fixtures without UI
  dependencies.
- `domTestUtils.ts` provides Testing Library utilities, DOM cleanup, and the
  ResizeObserver fallback. Use it for hooks with their own providers and plain
  DOM harnesses.
- `testUtils.tsx` renders actual UI with the application providers, syntax
  highlighting, and notifications.
- `routerTestUtils.tsx` adds the router for application navigation tests.

To run one environment, use `npm --prefix src/preview test -- --project node` or
`npm --prefix src/preview test -- --project dom` from the repository root.
