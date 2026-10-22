import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { createPreviewQueryClient } from "../queryClient";
import {
  loadDocumentRevision,
  loadDocumentRevisions,
} from "../api/documentRevisions";
import { useDocumentRevisions } from "../hooks/useDocumentRevisions";

vi.mock(
  "../api/documentRevisions",
  () => ({ loadDocumentRevisions: vi.fn(), loadDocumentRevision: vi.fn() }),
);
const recordedAt = "2026-10-22T00:00:00.000Z";
const wrapper = ({ children }: { children: ReactNode }) => {
  const [client] = useState(createPreviewQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("loads Current's baseline, compares each selection with its predecessor, and ignores late responses", async () => {
  vi.mocked(loadDocumentRevisions).mockResolvedValue([{ id: 2, recordedAt }, {
    id: 1,
    recordedAt,
  }]);
  let resolveLate!: (
    value: {
      id: number;
      recordedAt: string;
      markdown: string;
      previousMarkdown?: string;
    },
  ) => void;
  const late = new Promise<
    {
      id: number;
      recordedAt: string;
      markdown: string;
      previousMarkdown?: string;
    }
  >((resolve) => {
    resolveLate = resolve;
  });
  vi.mocked(loadDocumentRevision).mockImplementation(async (_documentId, id) =>
    id === 2
      ? {
        id,
        recordedAt,
        markdown: "# Saved two",
        previousMarkdown: "# Saved one",
      }
      : await late
  );
  const { result } = renderHook(() => useDocumentRevisions(7, "# Current"), {
    wrapper,
  });
  expect(result.current.content).toEqual({
    status: "ready",
    markdown: "# Current",
  });
  expect(loadDocumentRevision).not.toHaveBeenCalled();
  await waitFor(() => expect(result.current.comparison.status).toBe("ready"));
  expect(loadDocumentRevision).toHaveBeenCalledTimes(1);
  act(() => result.current.selectRevision(2));
  await waitFor(() =>
    expect(result.current.content).toEqual({
      status: "ready",
      markdown: "# Saved two",
    })
  );
  expect(result.current.comparison).toEqual({
    status: "ready",
    changes: { previous: new Set([1]), current: new Set([1]) },
  });
  act(() => result.current.selectRevision(1));
  expect(result.current.content).toEqual({ status: "loading" });
  expect(result.current.comparison).toEqual({ status: "loading" });
  await waitFor(() => expect(loadDocumentRevision).toHaveBeenCalledTimes(2));
  act(() => result.current.selectRevision(undefined));
  await act(async () => {
    resolveLate({ id: 1, recordedAt, markdown: "# Late" });
    await late;
  });
  expect(result.current.content).toEqual({
    status: "ready",
    markdown: "# Current",
  });
  act(() => result.current.selectRevision(2));
  expect(result.current.content).toEqual({
    status: "ready",
    markdown: "# Saved two",
  });
  expect(loadDocumentRevision).toHaveBeenCalledTimes(2);
});

it("preserves an empty saved body and uses the latest live Markdown when Current is selected", async () => {
  vi.mocked(loadDocumentRevisions).mockResolvedValue([{ id: 1, recordedAt }]);
  vi.mocked(loadDocumentRevision).mockResolvedValue({
    id: 1,
    recordedAt,
    markdown: "",
    previousMarkdown: "",
  });
  const { result, rerender } = renderHook(
    ({ markdown }) => useDocumentRevisions(7, markdown),
    { initialProps: { markdown: "# Current" }, wrapper },
  );
  act(() => result.current.selectRevision(1));
  await waitFor(() =>
    expect(result.current.content).toEqual({ status: "ready", markdown: "" })
  );
  expect(result.current.comparison).toEqual({
    status: "ready",
    changes: { previous: new Set(), current: new Set() },
  });
  rerender({ markdown: "# Updated" });
  expect(result.current.content).toEqual({ status: "ready", markdown: "" });
  act(() => result.current.selectRevision(undefined));
  expect(result.current.content).toEqual({
    status: "ready",
    markdown: "# Updated",
  });
  expect(result.current.comparison).toEqual({
    status: "ready",
    changes: { previous: new Set(), current: new Set([1]) },
  });
});

it("exposes retryable history and body failures without hiding Current", async () => {
  vi.mocked(loadDocumentRevisions).mockRejectedValueOnce(
    new Error("History unavailable"),
  ).mockResolvedValue([]);
  vi.mocked(loadDocumentRevision).mockRejectedValueOnce(
    new Error("Body unavailable"),
  ).mockResolvedValue({ id: 1, recordedAt, markdown: "# Recovered" });
  const { result } = renderHook(() => useDocumentRevisions(7, "# Current"), {
    wrapper,
  });
  await waitFor(() =>
    expect(result.current.history).toEqual({
      status: "error",
      message: "History unavailable",
    })
  );
  expect(result.current.content).toEqual({
    status: "ready",
    markdown: "# Current",
  });
  act(() => result.current.retryHistory());
  await waitFor(() =>
    expect(result.current.history).toEqual({ status: "empty" })
  );
  act(() => result.current.selectRevision(1));
  await waitFor(() =>
    expect(result.current.content).toEqual({
      status: "error",
      message: "Body unavailable",
    })
  );
  act(() => result.current.retryRevision());
  await waitFor(() =>
    expect(result.current.content).toEqual({
      status: "ready",
      markdown: "# Recovered",
    })
  );
  expect(result.current.comparison).toEqual({ status: "unavailable" });
});

it("keeps Current readable when its latest saved comparison fails and retries that comparison", async () => {
  vi.mocked(loadDocumentRevisions).mockResolvedValue([{ id: 2, recordedAt }]);
  vi.mocked(loadDocumentRevision).mockRejectedValueOnce(
    new Error("Unavailable"),
  )
    .mockResolvedValue({
      id: 2,
      recordedAt,
      markdown: "# Current",
      previousMarkdown: "# Different predecessor",
    });
  const { result } = renderHook(() => useDocumentRevisions(7, "# Current"), {
    wrapper,
  });
  await waitFor(() =>
    expect(result.current.comparison).toEqual({
      status: "error",
      message: "Unavailable",
    })
  );
  expect(result.current.content).toEqual({
    status: "ready",
    markdown: "# Current",
  });
  act(() => result.current.retryComparison());
  await waitFor(() =>
    expect(result.current.comparison).toEqual({
      status: "ready",
      changes: { previous: new Set(), current: new Set() },
    })
  );
  act(() => result.current.selectRevision(2));
  expect(result.current.comparison).toEqual({
    status: "ready",
    changes: { previous: new Set([1]), current: new Set([1]) },
  });
  expect(loadDocumentRevision).toHaveBeenCalledTimes(2);
});
