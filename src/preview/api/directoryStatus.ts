export type DirectoryStatus = {
  state: "loading" | "ready" | "error";
  detected: number;
  registered: number;
  error?: { name: string; message: string };
};

export const loadDirectoryStatus = async (): Promise<
  DirectoryStatus | null
> => {
  let response;
  try {
    response = await previewClient.getDirectoryStatus({});
  } catch (error) {
    if (ConnectError.from(error).code === Code.Unimplemented) return null;
    throw error;
  }
  const value: Partial<DirectoryStatus> = {
    ...response,
    detected: Number(response.detected),
    registered: Number(response.registered),
  } as Partial<DirectoryStatus>;
  if (
    !["loading", "ready", "error"].includes(value.state ?? "") ||
    !Number.isSafeInteger(value.detected) || Number(value.detected) < 0 ||
    !Number.isSafeInteger(value.registered) || Number(value.registered) < 0 ||
    (value.state === "error" &&
      (typeof value.error?.name !== "string" ||
        typeof value.error?.message !== "string"))
  ) {
    throw new Error("Invalid directory status response.");
  }
  return {
    state: value.state,
    detected: value.detected,
    registered: value.registered,
    ...(value.error ? { error: value.error } : {}),
  } as DirectoryStatus;
};
import { Code, ConnectError } from "@connectrpc/connect";
import { previewClient } from "./connect";
