export type SnapshotDocument = {
  deleted?: boolean;
  filePath: string;
  id: number;
};

export type SnapshotQueueProgress = {
  concurrency: number;
  targetCount: number;
  completedCount: number;
  failedCount: number;
};

export type SnapshotQueueOptions = {
  concurrency?: number;
  documents: readonly SnapshotDocument[];
  initializeSnapshot: (id: number, markdown: string) => Promise<void>;
  readMarkdown: (filePath: string) => Promise<string>;
  signal?: AbortSignal;
};

/** Initializes archival snapshots with bounded background work. */
export const initializeSnapshotQueue = async (
  options: SnapshotQueueOptions,
): Promise<SnapshotQueueProgress> => {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  const documents = options.documents.filter((document) => !document.deleted);
  const progress: SnapshotQueueProgress = {
    concurrency,
    targetCount: documents.length,
    completedCount: 0,
    failedCount: 0,
  };
  let nextIndex = 0;

  const worker = async () => {
    while (!options.signal?.aborted) {
      const index = nextIndex++;
      if (index >= documents.length) return;
      const document = documents[index];
      try {
        const markdown = await options.readMarkdown(document.filePath);
        await options.initializeSnapshot(document.id, markdown);
        progress.completedCount += 1;
      } catch {
        progress.failedCount += 1;
      }
      // Yield between files so request handling is not monopolized by the queue.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, documents.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return progress;
};
