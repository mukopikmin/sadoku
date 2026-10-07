import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { afterEach, expect, it, vi } from "vitest";
import { StatisticsDialog } from "../components/StatisticsDialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("loads and displays database statistics when opened", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(Response.json({
        commentCount: { bot: "4", human: "12" },
        databaseSize: "1536",
        documentCount: "3",
      }))
    ),
  );

  render(<StatisticsDialog onOpenChange={() => {}} open />);

  expect(await screen.findByRole("dialog", { name: "Database statistics" }))
    .toBeTruthy();
  await waitFor(() => expect(screen.getByText("1.5 KB")).toBeTruthy());
  expect(screen.getByText("Documents").nextElementSibling).toHaveProperty(
    "textContent",
    "3",
  );
  expect(screen.getByText("Human comments").nextElementSibling)
    .toHaveProperty("textContent", "12");
  expect(screen.getByText("Bot comments").nextElementSibling).toHaveProperty(
    "textContent",
    "4",
  );
});

it("offers a close button", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(Response.json({
        commentCount: { bot: "0", human: "0" },
        databaseSize: "0",
        documentCount: "0",
      }))
    ),
  );
  const onOpenChange = vi.fn();

  render(<StatisticsDialog onOpenChange={onOpenChange} open />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Close database statistics" }),
  );

  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});
