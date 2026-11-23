import { previewPath } from "./basePath";

export const isSyncEnabled = (): boolean =>
  globalThis.document?.getElementById("sadoku-client-root")?.dataset
    .syncEnabled !== "false";

type EventSourceConstructor = new (url: string) => EventSource;

export type PreviewKeepAliveOptions = {
  EventSourceCtor?: EventSourceConstructor;
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
  onDocumentsChanged?: () => void;
};

export type HotReloadOptions = {
  documentId: number;
  EventSourceCtor?: EventSourceConstructor;
  onReloadAvailable?: () => void;
  onCommentsChanged?: () => void;
};

const invalidatedResources = (event: Event): unknown[] => {
  if (!(event instanceof MessageEvent)) return [];
  try {
    const data: unknown = JSON.parse(event.data);
    if (
      typeof data === "object" &&
      data !== null &&
      "resources" in data &&
      Array.isArray(data.resources)
    ) {
      return data.resources;
    }
  } catch {
    // Ignore malformed server events and keep the connection alive.
  }
  return [];
};

export const connectPreviewKeepAlive = ({
  EventSourceCtor = globalThis.EventSource,
  onConnectionLost = () => {},
  onConnectionRestored = () => {},
  onDocumentsChanged = () => {},
}: PreviewKeepAliveOptions = {}): (() => void) => {
  if (!isSyncEnabled()) return () => {};
  const events = new EventSourceCtor(previewPath("/__sadoku/events"));
  const notifyInvalidation = (event: Event) => {
    if (invalidatedResources(event).includes("documents")) onDocumentsChanged();
  };
  events.addEventListener("error", onConnectionLost);
  events.addEventListener("open", onConnectionRestored);
  events.addEventListener("invalidate", notifyInvalidation);

  return () => {
    events.removeEventListener("error", onConnectionLost);
    events.removeEventListener("open", onConnectionRestored);
    events.removeEventListener("invalidate", notifyInvalidation);
    events.close();
  };
};

export const connectHotReload = ({
  documentId,
  EventSourceCtor = globalThis.EventSource,
  onReloadAvailable = () => {},
  onCommentsChanged = () => {},
}: HotReloadOptions): (() => void) => {
  if (!isSyncEnabled()) return () => {};
  const events = new EventSourceCtor(
    previewPath(`/__sadoku/documents/${documentId}/events`),
  );
  const notifyInvalidation = (event: Event) => {
    const resources = invalidatedResources(event);
    if (resources.includes("document")) {
      onReloadAvailable();
    } else if (resources.includes("comments")) {
      onCommentsChanged();
    }
  };

  events.addEventListener("invalidate", notifyInvalidation);

  return () => {
    events.removeEventListener("invalidate", notifyInvalidation);
    events.close();
  };
};
