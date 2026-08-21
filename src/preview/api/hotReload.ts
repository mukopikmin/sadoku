type EventSourceConstructor = new (url: string) => EventSource;

export type HotReloadOptions = {
  documentId: number;
  EventSourceCtor?: EventSourceConstructor;
  onReloadAvailable?: () => void;
  onCommentsChanged?: () => void;
};

type InvalidationData = { resources?: unknown };

export const connectPreviewKeepAlive = (
  EventSourceCtor: EventSourceConstructor = globalThis.EventSource,
): () => void => {
  const events = new EventSourceCtor("/__sadoku/events");
  return () => events.close();
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
