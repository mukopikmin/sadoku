import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { createPreviewQueryClient } from "../queryClient";
import { cleanup, render, screen, waitFor } from "./domTestUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHotReload } from "../hooks/useHotReload";
import { useCommentsQuery } from "../hooks/useComments";

class TestEventSource extends EventTarget {
  static instances: TestEventSource[] = [];

  constructor() {
    super();
    TestEventSource.instances.push(this);
  }

  close() {}
}

const HookProbe = () => {
  const { reloadAvailable } = useHotReload(42);

  return <div>{reloadAvailable ? "reload available" : "waiting"}</div>;
};

const CommentsHookProbe = () => {
  useCommentsQuery(42);
  return <HookProbe />;
};

const renderProbe = (probe: ReactElement) =>
  render(
    <QueryClientProvider client={createPreviewQueryClient()}>
      {probe}
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  TestEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("useHotReload", () => {
  it("marks reload as available when the document is invalidated", async () => {
    vi.stubGlobal("EventSource", TestEventSource);

    renderProbe(<HookProbe />);

    expect(screen.getByText("waiting")).not.toBeNull();

    TestEventSource.instances.at(-1)?.dispatchEvent(
      new MessageEvent("invalidate", {
        data: JSON.stringify({ resources: ["document", "comments"] }),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("reload available")).not.toBeNull();
    });
  });

  it("reloads comments without marking the document for reload", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    const fetchMock = vi.fn(() =>
      Promise.resolve(Response.json({ comments: [], filePath: "/tmp/a.md" }))
    );
    vi.stubGlobal("fetch", fetchMock);

    renderProbe(<CommentsHookProbe />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    TestEventSource.instances.at(-1)?.dispatchEvent(
      new MessageEvent("invalidate", {
        data: JSON.stringify({ resources: ["comments"] }),
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText("waiting")).not.toBeNull();
  });
});
