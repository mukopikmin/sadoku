import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInstruction,
  deleteInstruction,
  loadInstructions,
  updateInstruction,
} from "../api/instructions";

afterEach(() => vi.unstubAllGlobals());

describe("instruction API", () => {
  it("loads and validates document instructions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          instructions: [{
            id: 1,
            content: "Keep APIs stable.",
            createdAt: "created",
            updatedAt: "updated",
          }],
        }),
      ),
    );
    await expect(loadInstructions(7)).resolves.toEqual([{
      id: 1,
      content: "Keep APIs stable.",
      createdAt: "created",
      updatedAt: "updated",
    }]);
    expect(fetch).toHaveBeenCalledWith("/__sadoku/documents/7/instructions");
  });

  it("uses the document instruction CRUD endpoints", async () => {
    const instruction = {
      id: 2,
      content: "Instruction",
      createdAt: "created",
      updatedAt: "updated",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(instruction, { status: 201 }))
      .mockResolvedValueOnce(Response.json(instruction))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await createInstruction(7, "Instruction");
    await updateInstruction(7, 2, "Instruction");
    await deleteInstruction(7, 2);
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method]))
      .toEqual([
        ["/__sadoku/documents/7/instructions", "POST"],
        ["/__sadoku/documents/7/instructions/2", "PUT"],
        ["/__sadoku/documents/7/instructions/2", "DELETE"],
      ]);
  });
});

it("manages global instructions without a document ID", async () => {
  const instruction = {
    id: 1,
    content: "Shared",
    createdAt: "created",
    updatedAt: "updated",
  };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ instructions: [instruction] }))
    .mockResolvedValueOnce(Response.json(instruction))
    .mockResolvedValueOnce(Response.json(instruction))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(loadInstructions("global")).resolves.toEqual([instruction]);
  await createInstruction("global", "Shared");
  await updateInstruction("global", 1, "Shared");
  await deleteInstruction("global", 1);
  expect(
    fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]),
  )
    .toEqual([
      ["/__sadoku/global-instructions", "GET"],
      ["/__sadoku/global-instructions", "POST"],
      ["/__sadoku/global-instructions/1", "PUT"],
      ["/__sadoku/global-instructions/1", "DELETE"],
    ]);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    content: "Shared",
  });
});
