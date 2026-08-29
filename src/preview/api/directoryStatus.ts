export type DirectoryStatus = {
  state: "loading" | "ready" | "error";
  detected: number;
  registered: number;
  error?: { name: string; message: string };
};

export const loadDirectoryStatus = async (): Promise<
  DirectoryStatus | null
> => {
  const response = await fetch("/__sadoku/directory-status");
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load directory status: ${response.status}`);
  }
  const value = await response.json() as Partial<DirectoryStatus>;
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
  return value as DirectoryStatus;
};
