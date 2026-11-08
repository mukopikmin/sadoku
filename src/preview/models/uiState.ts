export type ActionState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; message: string };

export type ListState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; items: T[] };

export const listState = <T>(query: {
  data: T[] | undefined;
  error: Error | null;
}): ListState<T> =>
  query.error
    ? { status: "error", message: query.error.message }
    : query.data
      ? query.data.length
        ? { status: "ready", items: query.data }
        : { status: "empty" }
      : { status: "loading" };

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
