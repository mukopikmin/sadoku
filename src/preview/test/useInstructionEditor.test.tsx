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
    const mutation = operation === "create"
      ? vi.mocked(api.createInstruction)
      : operation === "update"
      ? vi.mocked(api.updateInstruction)
      : vi.mocked(api.deleteInstruction);
    mutation.mockRejectedValueOnce(new Error("Save failed"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useInstructionEditor(7, true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    const draft = operation === "clear" ? "" : "My draft";
    act(() => result.current.change(draft));
    await act(() => result.current.save());
    expect(result.current.error).toBe("Save failed");
    expect(result.current.content).toBe(draft);
    expect(result.current.dirty).toBe(true);
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
    await waitFor(() => expect(result.current.dirty).toBe(false));
    expect(result.current.error).toBe("");
    expect(result.current.content).toBe(draft);
  },
);

it("keeps unsaved edits during a refetch and resets them on scope changes and reopening", async () => {
  vi.mocked(api.loadInstructions).mockImplementation(async (
    scope,
  ) => [note(scope === "global" ? "Global" : "Local")]);
  const { client, wrapper } = setup();
  const { result, rerender } = renderHook(
    ({ scope, open }: { scope: number | "global"; open: boolean }) =>
      useInstructionEditor(scope, open),
    { wrapper, initialProps: { scope: 7, open: true } },
  );
  await waitFor(() => expect(result.current.content).toBe("Local"));
  act(() => result.current.change("Unsaved"));
  await act(() =>
    client.invalidateQueries({ queryKey: instructionsQueryKey(7) })
  );
  expect(result.current.content).toBe("Unsaved");
  rerender({ scope: "global", open: true });
  await waitFor(() => expect(result.current.content).toBe("Global"));
  act(() => result.current.change("Discard on close"));
  rerender({ scope: "global", open: false });
  rerender({ scope: "global", open: true });
  await waitFor(() => expect(result.current.content).toBe("Global"));
});
