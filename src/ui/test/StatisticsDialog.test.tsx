import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { afterEach, expect, it, vi } from "vitest";
import { create, toJson } from "@bufbuild/protobuf";
import { StatisticsDialog } from "../components/StatisticsDialog";
import { GetStatisticsResponseSchema } from "../gen/sadoku/preview/v1/preview_pb";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows database-wide counts and lets the user reveal diagnostic details", async () => {
  const response = create(GetStatisticsResponseSchema, {
    commentCount: { bot: 4n, human: 12n },
    databaseSize: 1536n,
    documentCount: 3n,
    details: {
      resolvedThreadCount: 5n,
      staleThreadCount: 2n,
      replyCount: { bot: 1n, human: 6n },
      revisionCount: 8n,
      documentsWithRevisionsCount: 2n,
      lastRevisionAt: "2026-11-27T01:00:00.000Z",
      taggedDocumentCount: 1n,
      tagCount: 2n,
      memoryCount: 2n,
      documentInstructionCount: 1n,
      globalInstructionCount: 3n,
      reusablePageBytes: 4096n,
      databasePath: "/data/sadoku.sqlite3",
      sqliteVersion: "3.51.2",
      lastMigrationVersion: "0018",
      lastMigrationAt: "2026-11-27T00:00:00.000Z",
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        Response.json(toJson(GetStatisticsResponseSchema, response)),
      ),
    ),
  );

  const onOpenChange = vi.fn();
  render(<StatisticsDialog onOpenChange={onOpenChange} open />);

  expect(
    await screen.findByRole("dialog", { name: "Database statistics" }),
  ).toBeTruthy();
  await waitFor(() => expect(screen.getByText("1.5 KB")).toBeTruthy());
  for (const [label, value] of [
    ["Registered documents", "3"],
    ["Comment threads", "16"],
    ["Thread authors", "12 human · 4 bot"],
    ["Thread status", "11 unresolved · 5 resolved"],
    ["Replies", "7"],
    ["Saved revisions", "8"],
  ]) {
    expect(screen.getByText(label).nextElementSibling).toHaveProperty(
      "textContent",
      value,
    );
  }
  const details = screen.getByText("Details");
  const disclosure = details.closest("details");
  expect(disclosure?.open).toBe(false);
  fireEvent.click(details);
  expect(disclosure?.open).toBe(true);
  for (const [label, value] of [
    ["Stale threads", "2"],
    ["Reply authors", "6 human · 1 bot"],
    ["Reusable page space", "4.0 KB"],
    ["Database path", "/data/sadoku.sqlite3"],
    ["Latest migration", "0018"],
  ]) {
    expect(screen.getByText(label).nextElementSibling).toHaveProperty(
      "textContent",
      value,
    );
  }
  fireEvent.click(
    screen.getByRole("button", { name: "Close database statistics" }),
  );
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

it("distinguishes an unavailable file size from an empty revision history", async () => {
  const response = create(GetStatisticsResponseSchema, {
    commentCount: {},
    details: {
      replyCount: {},
      databasePath: "/data/sadoku.sqlite3",
      sqliteVersion: "3.51.2",
      lastMigrationVersion: "0018",
      lastMigrationAt: "2026-11-27T00:00:00.000Z",
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        Response.json(toJson(GetStatisticsResponseSchema, response)),
      ),
    ),
  );
  render(<StatisticsDialog onOpenChange={vi.fn()} open />);
  const size = await screen.findByText("Database file size");
  expect(size.nextElementSibling).toHaveProperty("textContent", "Unavailable");
  fireEvent.click(screen.getByText("Details"));
  expect(screen.getByText("No revisions yet")).toBeTruthy();
});
