type EventSourceConstructor = new (url: string) => EventSource;

export type PreviewKeepAliveOptions = {
  EventSourceCtor?: EventSourceConstructor;
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
};

export type HotReloadOptions = {
  documentId: number;
  EventSourceCtor?: EventSourceConstructor;
  onReloadAvailable?: () => void;
  onCommentsChanged?: () => void;
};

type InvalidationData = { resources?: unknown };

export const connectPreviewKeepAlive = (
  {
    EventSourceCtor = globalThis.EventSource,
    onConnectionLost = () => {},
    onConnectionRestored = () => {},
  }: PreviewKeepAliveOptions = {},
): () => void => {
  const events = new EventSourceCtor("/__sadoku/events");
  events.addEventListener("error", onConnectionLost);
  events.addEventListener("open", onConnectionRestored);

  return () => {
    events.removeEventListener("error", onConnectionLost);
    events.removeEventListener("open", onConnectionRestored);
    events.close();
  };
};

export const connectHotReload = (
  {
    documentId,
    EventSourceCtor = globalThis.EventSource,
    onReloadAvailable = () => {},
    onCommentsChanged = () => {},
  }: HotReloadOptions,
): () => void => {
  const events = new EventSourceCtor(
    `/__sadoku/documents/${documentId}/events`,
  );
  const notifyInvalidation = (event: Event) => {
    if (!(event instanceof MessageEvent)) return;
    try {
      const data = JSON.parse(event.data) as InvalidationData;
      if (!Array.isArray(data.resources)) return;
      if (data.resources.includes("document")) {
        onReloadAvailable();
      } else if (data.resources.includes("comments")) {
        onCommentsChanged();
      }
    } catch {
      // Ignore malformed server events and keep the connection alive.
    }
  };

  events.addEventListener("invalidate", notifyInvalidation);

  return () => {
    events.removeEventListener("invalidate", notifyInvalidation);
    events.close();
  };
};
