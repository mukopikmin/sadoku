import { describe, expect, it } from "vitest";
import { connectHotReload } from "../api/hotReload";

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  closed = false;
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("connectHotReload", () => {
  it("notifies when the server invalidates the document", () => {
    let reloads = 0;
    const disconnect = connectHotReload({
      EventSourceCtor: FakeEventSource as unknown as new (
        url: string,
      ) => EventSource,
      onReloadAvailable: () => {
        reloads += 1;
      },
    });

    const events = FakeEventSource.instances.at(-1);
    expect(events?.url).toBe("/__sadoku/events");

    events?.dispatchEvent(
      new MessageEvent("invalidate", {
        data: JSON.stringify({ resources: ["document", "comments"] }),
      }),
    );
    expect(reloads).toBe(1);

    disconnect();
    expect(events?.closed).toBe(true);
  });

  it("notifies separately when only comments are invalidated", () => {
    let reloads = 0;
    let commentChanges = 0;
    connectHotReload({
      EventSourceCtor: FakeEventSource as unknown as new (
        url: string,
      ) => EventSource,
      onCommentsChanged: () => commentChanges += 1,
      onReloadAvailable: () => reloads += 1,
    });

    FakeEventSource.instances.at(-1)?.dispatchEvent(
      new MessageEvent("invalidate", {
        data: JSON.stringify({ resources: ["comments"] }),
      }),
    );

    expect(commentChanges).toBe(1);
    expect(reloads).toBe(0);
  });

  it("ignores malformed invalidation events", () => {
    let reloads = 0;
    connectHotReload({
      EventSourceCtor: FakeEventSource as unknown as new (
        url: string,
      ) => EventSource,
      onReloadAvailable: () => reloads += 1,
    });

    FakeEventSource.instances.at(-1)?.dispatchEvent(
      new MessageEvent("invalidate", { data: "not json" }),
    );

    expect(reloads).toBe(0);
  });
});
