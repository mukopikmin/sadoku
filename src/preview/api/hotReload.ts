type EventSourceConstructor = new (url: string) => EventSource;

export type HotReloadOptions = {
  EventSourceCtor?: EventSourceConstructor;
  onReloadAvailable?: () => void;
  onCommentsChanged?: () => void;
  documentId?: number;
};

type InvalidationData = { resources?: unknown };

export const connectHotReload = (
  {
    EventSourceCtor = globalThis.EventSource,
    onReloadAvailable = () => {},
    onCommentsChanged = () => {},
    documentId,
  }: HotReloadOptions = {},
): () => void => {
  const events = new EventSourceCtor(
    documentId === undefined
      ? "/__sadoku/events"
      : `/__sadoku/documents/${encodeURIComponent(documentId)}/events`,
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
