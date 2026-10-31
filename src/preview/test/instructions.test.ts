import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInstruction,
  deleteInstruction,
  loadInstructions,
  updateInstruction,
} from "../api/instructions";

beforeEach(() => vi.stubGlobal("__sadokuConnectTestFetch", undefined));
afterEach(() => vi.unstubAllGlobals());

const instruction = {
  id: 2,
  content: "Instruction",
  createdAt: "created",
  updatedAt: "updated",
};

const requestFrom = (fetchMock: ReturnType<typeof vi.fn>) => {
  expect(fetchMock).toHaveBeenCalledOnce();
  const [input, init] = fetchMock.mock.calls[0];
  const request = new Request(input, init);
  expect(request.method).toBe("POST");
  return request;
};

describe("instruction API", () => {
  it("loads and converts document instructions through Connect", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ instructions: [{ ...instruction, id: "2" }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadInstructions(7)).resolves.toEqual([instruction]);

    const request = requestFrom(fetchMock);
    expect(new URL(request.url).pathname).toBe(
      "/sadoku.preview.v1.PreviewService/ListInstructions",
    );
    expect(await request.json()).toEqual({ documentId: "7" });
  });

  it.each([
    {
      method: "CreateInstruction",
      invoke: () => createInstruction(7, instruction.content),
      body: { documentId: "7", content: instruction.content },
      result: instruction,
    },
    {
      method: "UpdateInstruction",
      invoke: () => updateInstruction(7, instruction.id, instruction.content),
      body: {
        documentId: "7",
        instructionId: "2",
        content: instruction.content,
      },
      result: instruction,
    },
    {
      method: "DeleteInstruction",
      invoke: () => deleteInstruction(7, instruction.id),
      body: { documentId: "7", instructionId: "2" },
      result: undefined,
    },
  ])("uses the $method RPC and document-scoped payload", async (test) => {
    const fetchMock = vi.fn(async () =>
      Response.json(test.result ? { ...test.result, id: "2" } : {})
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(test.invoke()).resolves.toEqual(test.result);

    const request = requestFrom(fetchMock);
    expect(new URL(request.url).pathname).toBe(
      "/sadoku.preview.v1.PreviewService/" + test.method,
    );
    expect(await request.json()).toEqual(test.body);
  });
});

it("manages global instructions through Connect without a document ID", async () => {
  const instruction = {
    id: 1,
    content: "Shared",
    createdAt: "created",
    updatedAt: "updated",
  };
  const response = { ...instruction, id: "1" };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ instructions: [response] }))
    .mockResolvedValueOnce(Response.json(response))
    .mockResolvedValueOnce(Response.json(response))
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal("fetch", fetchMock);
  await expect(loadInstructions("global")).resolves.toEqual([instruction]);
  await createInstruction("global", "Shared");
  await updateInstruction("global", 1, "Shared");
  await deleteInstruction("global", 1);
  const requests = fetchMock.mock.calls.map(([input, init]) =>
    new Request(input, init)
  );
  expect(
    requests.map((request) => [new URL(request.url).pathname, request.method]),
  )
    .toEqual([
      ["/sadoku.preview.v1.PreviewService/ListGlobalInstructions", "POST"],
      ["/sadoku.preview.v1.PreviewService/CreateGlobalInstruction", "POST"],
      ["/sadoku.preview.v1.PreviewService/UpdateGlobalInstruction", "POST"],
      ["/sadoku.preview.v1.PreviewService/DeleteGlobalInstruction", "POST"],
    ]);
  expect(await Promise.all(requests.map((request) => request.json()))).toEqual([
    {},
    { content: "Shared" },
    { instructionId: "1", content: "Shared" },
    { instructionId: "1" },
  ]);
});
