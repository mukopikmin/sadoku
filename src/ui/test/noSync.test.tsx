import { it, expect } from "vitest";
import { connectHotReload, connectPreviewKeepAlive } from "../api/hotReload";
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

it("opens neither event stream when automatic sync is disabled", () => {
  const root = document.createElement("div");
  root.id = "sadoku-client-root";
  root.dataset.syncEnabled = "false";
  document.body.append(root);
  const before = FakeEventSource.instances.length;
  try {
    const EventSourceCtor = FakeEventSource as unknown as typeof EventSource;
    const stopSession = connectPreviewKeepAlive({ EventSourceCtor });
    const stopDocument = connectHotReload({ documentId: 1, EventSourceCtor });
    expect(FakeEventSource.instances).toHaveLength(before);
    stopSession();
    stopDocument();
  } finally {
    root.remove();
  }
});
