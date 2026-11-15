import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteMemory, loadMemories } from "../api/memories";

describe("memory API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads and validates document memories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          memories: [
            {
              id: 2,
              documentId: 7,
              content: "Stable fact.",
              createdAt: "2026-09-11T00:00:00.000Z",
              updatedAt: "2026-09-11T01:00:00.000Z",
            },
          ],
        }),
      ),
    );
    await expect(loadMemories(7)).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/__sadoku/documents/7/memories");
  });

  it("rejects invalid responses and supports deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ memories: [{ id: "2" }] }))
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );
    await expect(loadMemories(7)).rejects.toThrow("Invalid memory response");
    await expect(deleteMemory(7, 2)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenLastCalledWith("/__sadoku/documents/7/memories/2", {
      method: "DELETE",
    });
  });
});
