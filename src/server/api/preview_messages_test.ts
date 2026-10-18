import { assertEquals } from "@std/assert";
import { create, type MessageInitShape, toJson } from "@bufbuild/protobuf";
import {
  CommentSchema,
  GetDocumentResponseSchema,
  InstructionSchema,
  TagSchema,
} from "../../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import {
  commentMessage,
  documentMessage,
  instructionMessage,
  tagMessage,
  toUint32,
  toUint64,
} from "./preview_messages.ts";
import type { PreviewComment } from "../usecase/comment/types.ts";

// These compile-time checks run under `deno task check`. Init shapes allow
// omitted scalars, but reject incompatible fields and scalar representations.
const typeContracts = () => {
  // @ts-expect-error RPC uint64 fields require bigint, not storage numbers.
  const wrongId: MessageInitShape<typeof TagSchema> = { id: 1 };
  const storageField: MessageInitShape<typeof InstructionSchema> = {
    // @ts-expect-error Instruction deliberately excludes storage documentId.
    documentId: 1n,
  };
  const wrongReply: MessageInitShape<typeof CommentSchema> = {
    // @ts-expect-error Nested replies must use generated field names.
    replies: [{ content: "body" }],
  };
  return [wrongId, storageField, wrongReply];
};
void typeContracts;

Deno.test("RPC public messages omit storage metadata before serialization", () => {
  const tag = {
    id: 2,
    name: "Review",
    backgroundColor: "#123456",
    createdAt: "created",
    updatedAt: "updated",
  };
  assertEquals(tagMessage(tag), {
    id: 2n,
    name: "Review",
    backgroundColor: "#123456",
  });
  assertEquals(
    instructionMessage({
      id: 3,
      documentId: 4,
      content: "Instruction",
      createdAt: "created",
      updatedAt: "updated",
    }),
    {
      id: 3n,
      content: "Instruction",
      createdAt: "created",
      updatedAt: "updated",
    },
  );
});

Deno.test("RPC mapping preserves optional falsy values and Proto3 scalar defaults", () => {
  const comment: PreviewComment = {
    id: 1,
    author: { type: "bot" },
    body: "Review",
    startLine: 1,
    endLine: 1,
    originalStartLine: 1,
    originalEndLine: 1,
    createdAt: "created",
    updatedAt: "updated",
    resolved: false,
    stale: false,
  };
  const absent = create(CommentSchema, commentMessage(comment));
  assertEquals(absent.resolvedAt, undefined);
  assertEquals(absent.resolvedBy, undefined);
  assertEquals(absent.sourceText, undefined);
  assertEquals(absent.displayLine, undefined);
  assertEquals(absent.replies, []);
  const present = create(
    CommentSchema,
    commentMessage({
      ...comment,
      sourceText: "",
      sourceHash: "",
      resolvedAt: "",
      displayLine: 0,
      resolvedBy: { type: "human" },
      replies: [{
        id: 2,
        author: { type: "human" },
        body: "Reply",
        createdAt: "created",
        updatedAt: "updated",
        reviewRequested: false,
      }],
    }),
  );
  const json = toJson(CommentSchema, present);
  assertEquals(present.replies[0].reviewRequested, false);
  assertEquals(present.sourceText, "");
  assertEquals(present.displayLine, 0);
  assertEquals(json, {
    id: "1",
    author: { type: "bot" },
    body: "Review",
    startLine: 1,
    endLine: 1,
    originalStartLine: 1,
    originalEndLine: 1,
    createdAt: "created",
    updatedAt: "updated",
    resolvedAt: "",
    resolvedBy: { type: "human" },
    sourceHash: "",
    sourceText: "",
    displayLine: 0,
    replies: [{
      id: "2",
      author: { type: "human" },
      body: "Reply",
      createdAt: "created",
      updatedAt: "updated",
      reviewRequested: false,
    }],
  });
  // A deleted snapshot has no file URL. The nonoptional string decodes to "".
  const document = {
    id: 1,
    relativePath: "gone.md",
    title: "gone",
    deleted: true,
    markdown: "snapshot",
  };
  const snapshot = create(GetDocumentResponseSchema, documentMessage(document));
  assertEquals(snapshot.fileUrl, "");
  assertEquals(snapshot.githubHeadSha, undefined);
  assertEquals(
    create(GetDocumentResponseSchema, documentMessage(document, ""))
      .githubHeadSha,
    "",
  );
});

Deno.test("RPC uint64 conversion rejects unsafe application numbers", () => {
  assertEquals(toUint64(0), 0n);
  assertEquals(
    toUint64(Number.MAX_SAFE_INTEGER),
    BigInt(Number.MAX_SAFE_INTEGER),
  );
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    // Connect failures are plain discriminated objects, not Error subclasses.
    let failure;
    try {
      toUint64(value);
    } catch (error) {
      failure = error;
    }
    assertEquals(failure, {
      code: "internal",
      message: "Invalid response integer.",
      status: 500,
    });
  }
});

Deno.test("RPC uint32 conversion enforces the range absent from generated types", () => {
  assertEquals(toUint32(0), 0);
  assertEquals(toUint32(0xffffffff), 0xffffffff);
  for (const value of [-1, 0.5, NaN, Infinity, 0x100000000]) {
    let failure;
    try {
      toUint32(value);
    } catch (error) {
      failure = error;
    }
    assertEquals(failure, {
      code: "internal",
      message: "Invalid response integer.",
      status: 500,
    });
  }
});
