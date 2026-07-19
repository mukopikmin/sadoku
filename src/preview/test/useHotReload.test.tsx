import { cleanup, render, screen, waitFor } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHotReload } from "../hooks/useHotReload";

class TestEventSource extends EventTarget {
  static instances: TestEventSource[] = [];

  constructor() {
    super();
    TestEventSource.instances.push(this);
  }

  close() {}
}

const HookProbe = () => {
  const { reloadAvailable } = useHotReload();

  return <div>{reloadAvailable ? "reload available" : "waiting"}</div>;
};

afterEach(() => {
  cleanup();
  TestEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("useHotReload", () => {
  it("marks reload as available when the server sends a reload event", async () => {
    vi.stubGlobal("EventSource", TestEventSource);

    render(<HookProbe />);

    expect(screen.getByText("waiting")).not.toBeNull();

    TestEventSource.instances.at(-1)?.dispatchEvent(new Event("reload"));

    await waitFor(() => {
      expect(screen.getByText("reload available")).not.toBeNull();
    });
  });
});
