import { cleanup, render, screen, waitFor } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHotReload } from "../hooks/useHotReload";
import { useCommentsQuery } from "../hooks/usePreviewData";

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

afterEach(() => {
  cleanup();
  TestEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("useHotReload", () => {
  it("marks reload as available when the document is invalidated", async () => {
    vi.stubGlobal("EventSource", TestEventSource);

    render(<HookProbe />);

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

    render(<CommentsHookProbe />);
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
