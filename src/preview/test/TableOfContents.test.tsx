import { afterEach, expect, it } from "vitest";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";

afterEach(cleanup);

it("collapses and expands branches without closing, then navigates with the keyboard", async () => {
  globalThis.history.replaceState(null, "", "/docs/readme");
  render(<TableOfContents markdown={"# Parent\n\n### Child\n\n# Next"} />);
  fireEvent.click(screen.getByRole("button", { name: "Table of contents" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Table of contents",
  });
  const toggle = within(dialog).getByRole("button", { name: "Toggle Parent" });
  expect(
    within(dialog).getByRole("treeitem", { name: "Child" }),
  ).not.toBeNull();
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(
      within(dialog).queryByRole("treeitem", { name: "Child" }),
    ).toBeNull(),
  );
  expect(globalThis.location.hash).toBe("");
  fireEvent.click(toggle);
  const child = await within(dialog).findByRole("treeitem", { name: "Child" });
  child.focus();
  fireEvent.keyDown(child, { key: "Enter" });
  await waitFor(() => expect(globalThis.location.hash).toBe("#child"));
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Table of contents" }),
    ).toBeNull(),
  );
});

it("selects a parent heading and can select it again after reopening", async () => {
  globalThis.history.replaceState(null, "", "/docs/readme");
  render(<TableOfContents markdown={"# 日本語\n\n## Child"} />);
  for (let index = 0; index < 2; index++) {
    fireEvent.click(screen.getByRole("button", { name: "Table of contents" }));
    const tree = await screen.findByRole("tree", { name: "Table of contents" });
    fireEvent.click(within(tree).getByText("日本語"));
    await waitFor(() =>
      expect(globalThis.location.hash).toBe("#%E6%97%A5%E6%9C%AC%E8%AA%9E"),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Table of contents" }),
      ).toBeNull(),
    );
  }
});
