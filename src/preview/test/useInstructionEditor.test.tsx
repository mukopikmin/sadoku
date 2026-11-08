import type { InstructionScope } from "../models/instruction";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../api/instructions";
import { useInstructionEditor } from "../hooks/useInstructionEditor";
import { instructionsQueryKey } from "../hooks/previewQueryKeys";
import { createPreviewQueryClient } from "../queryClient";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";

vi.mock("../api/instructions", () => ({
  loadInstructions: vi.fn(),
  createInstruction: vi.fn(),
  updateInstruction: vi.fn(),
  deleteInstruction: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const note = (content: string) => ({
  id: 1,
  content,
  createdAt: "created",
  updatedAt: "updated",
});
const setup = () => {
  const client = createPreviewQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

it.each(["create", "update", "clear"])(
  "retains the draft after a failed %s and supports retry",
  async (operation) => {
    let saved = operation === "create" ? [] : [note("Saved")];
    vi.mocked(api.loadInstructions).mockImplementation(async () => saved);
    const mutation =
      operation === "create"
        ? vi.mocked(api.createInstruction)
        : operation === "update"
          ? vi.mocked(api.updateInstruction)
          : vi.mocked(api.deleteInstruction);
    mutation.mockRejectedValueOnce(new Error("Save failed"));
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useInstructionEditor({ type: "document", documentId: 7 }, true),
      {
        wrapper,
      },
    );
    await waitFor(() =>
      expect(result.current.state.status === "ready").toBe(true),
    );
    act(() => result.current.startEditing());
    const draft = operation === "clear" ? "" : "My draft";
    act(() => result.current.change(draft));
    await act(() => result.current.save());
    expect(result.current.state).toMatchObject({
      status: "save-error",
      message: "Save failed",
    });
    expect(result.current.state).toMatchObject({ content: draft });
    expect(result.current.state).toMatchObject({ dirty: true });
    expect(result.current.editing).toBe(true);
    if (operation === "clear") {
      vi.mocked(api.deleteInstruction).mockImplementationOnce(async () => {
        saved = [];
      });
    } else {
      const saveDraft = async () => {
        saved = [note(draft)];
        return note(draft);
      };
      if (operation === "create") {
        vi.mocked(api.createInstruction).mockImplementationOnce(saveDraft);
      } else vi.mocked(api.updateInstruction).mockImplementationOnce(saveDraft);
    }
    await act(() => result.current.save());
    await waitFor(() =>
      expect(result.current.state).toMatchObject({ dirty: false }),
    );
    expect(result.current.state.status).toBe("ready");
    expect(result.current.editing).toBe(false);
    expect(result.current.state).toMatchObject({ content: draft });
  },
);

it("keeps unsaved edits during a refetch and resets them on scope changes and reopening", async () => {
  vi.mocked(api.loadInstructions).mockImplementation(async (scope) => [
    note(scope.type === "global" ? "Global" : "Local"),
  ]);
  const { client, wrapper } = setup();
  const { result, rerender } = renderHook(
    ({ scope, open }: { scope: InstructionScope; open: boolean }) =>
      useInstructionEditor(scope, open),
    {
      wrapper,
      initialProps: {
        scope: { type: "document", documentId: 7 } as InstructionScope,
        open: true,
      },
    },
  );
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ content: "Local" }),
  );
  act(() => result.current.startEditing());
  act(() => result.current.change("Unsaved"));
  await act(() =>
    client.invalidateQueries({
      queryKey: instructionsQueryKey({ type: "document", documentId: 7 }),
    }),
  );
  expect(result.current.state).toMatchObject({ content: "Unsaved" });
  expect(result.current.editing).toBe(true);
  rerender({ scope: { type: "document", documentId: 7 }, open: true });
  expect(result.current.state).toMatchObject({ content: "Unsaved" });
  expect(result.current.editing).toBe(true);
  rerender({ scope: { type: "global" }, open: true });
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ content: "Global" }),
  );
  expect(result.current.editing).toBe(false);
  act(() => result.current.startEditing());
  act(() => result.current.change("Discard on close"));
  rerender({ scope: { type: "global" }, open: false });
  rerender({ scope: { type: "global" }, open: true });
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ content: "Global" }),
  );
});

it("ignores a late save failure after switching instruction scope", async () => {
  vi.mocked(api.loadInstructions).mockImplementation(async (scope) => [
    note(scope.type === "global" ? "Global" : "Local"),
  ]);
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_resolve, no) => {
    reject = no;
  });
  vi.mocked(api.updateInstruction).mockReturnValue(pending);
  const { result, rerender } = renderHook(
    ({ scope }: { scope: InstructionScope }) =>
      useInstructionEditor(scope, true),
    {
      ...setup(),
      initialProps: {
        scope: { type: "document", documentId: 7 } as InstructionScope,
      },
    },
  );
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "ready",
      content: "Local",
    }),
  );
  act(() => result.current.change("Draft"));
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.save();
    void result.current.save();
    result.current.change("Overwrite");
  });
  expect(result.current.state).toMatchObject({
    status: "saving",
    content: "Draft",
  });
  await waitFor(() => expect(api.updateInstruction).toHaveBeenCalledOnce());
  rerender({ scope: { type: "global" } });
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ content: "Global" }),
  );
  await act(async () => {
    reject(new Error("Old failure"));
    await completion;
  });
  expect(result.current.state).toMatchObject({
    status: "ready",
    content: "Global",
    dirty: false,
  });
});
