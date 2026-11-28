import "@testing-library/jest-dom/vitest";
import { create, toJson } from "@bufbuild/protobuf";
import { afterEach, expect, it, vi } from "vitest";
import { StatisticsDialog } from "../components/StatisticsDialog";
import { GetStatisticsResponseSchema } from "../gen/sadoku/preview/v1/preview_pb";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("displays all eight database statistics in a flat list", async () => {
  const response = create(GetStatisticsResponseSchema, {
    commentCount: { bot: 4n, human: 12n },
    databaseSize: 1536n,
    documentCount: 3n,
    details: {
      documentsWithCommentsCount: 2n,
      documentsWithUnresolvedThreadsCount: 1n,
      resolvedThreadCount: 5n,
      replyCount: { bot: 1n, human: 6n },
      revisionCount: 8n,
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
  const dialog = await screen.findByRole("dialog", {
    name: "Database statistics",
  });
  await screen.findByText("1.5 KB");

  const expectedRows = [
    ["Registered documents", "3"],
    ["Documents with comments", "2"],
    ["Documents with unresolved threads", "1"],
    ["Comment threads", "16 (Human 12 · Bot 4)"],
    ["Resolution rate", "31% (5 of 16 resolved)"],
    ["Replies", "7 (Human 6 · Bot 1)"],
    ["Saved revisions", "8"],
    ["Database file size", "1.5 KB"],
  ];
  expect(
    Array.from(dialog.querySelectorAll("dt"), (term) => term.textContent),
  ).toEqual(expectedRows.map(([label]) => label));
  for (const [label, value] of expectedRows) {
    const term = screen.getByText(label);
    expect(term).toBeVisible();
    expect(term.nextElementSibling).toHaveProperty("textContent", value);
  }

  fireEvent.click(
    screen.getByRole("button", { name: "Close database statistics" }),
  );
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

it("shows a dash for the resolution rate of an empty database", async () => {
  const response = create(GetStatisticsResponseSchema, {
    commentCount: {},
    details: { replyCount: {} },
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
  const rate = await screen.findByText("Resolution rate");
  expect(rate.nextElementSibling).toHaveProperty("textContent", "—");
  const size = screen.getByText("Database file size");
  expect(size.nextElementSibling).toHaveProperty("textContent", "Unavailable");
});
