const servicePath = "/sadoku.preview.v1.PreviewService/";

const route = (
  method: string,
  body: Record<string, unknown>,
): [string, RequestInit | undefined, ((value: unknown) => unknown)?] => {
  const documentId = body.documentId;
  const commentId = body.commentId;
  const instructionId = body.instructionId;
  const memoryId = body.memoryId;
  const replyId = body.replyId;
  switch (method) {
    case "ListDocuments":
      return ["/__sadoku/documents", undefined, (documents) => ({ documents })];
    case "GetDocument":
      return [`/__sadoku/documents/${documentId}`, undefined];
    case "GetDirectoryStatus":
      return ["/__sadoku/directory-status", undefined];
    case "GetSettings":
      return ["/__sadoku/settings", undefined];
    case "UpdateSettings":
      return [
        "/__sadoku/settings",
        json("PUT", {
          codeWrap: body.codeWrap,
          excludedDirectories: body.excludedDirectories,
          fontScale: body.fontScale,
          markdownExtensions: body.markdownExtensions,
          maxDepth: body.maxDepth,
          maxFiles: body.maxFiles,
          theme: body.theme,
        }),
      ];
    case "GetGitHubAccount":
      return ["/__sadoku/github-account", undefined];
    case "ListTags":
      return ["/__sadoku/tags", undefined, (tags) => ({ tags })];
    case "UpdateTag":
      return [
        `/__sadoku/tags/${body.id}`,
        json("PATCH", {
          name: body.name,
          backgroundColor: body.backgroundColor,
        }),
      ];
    case "ReplaceDocumentTags":
      return [
        `/__sadoku/documents/${documentId}/tags`,
        json("PUT", {
          tags: (body.tags as Array<Record<string, unknown>>).map((tag) =>
            tag.id === undefined ? tag : { id: Number(tag.id) }
          ),
        }),
        (tags) => ({ tags }),
      ];
    case "ListInstructions":
      return [`/__sadoku/documents/${documentId}/instructions`, undefined];
    case "CreateInstruction":
      return [
        `/__sadoku/documents/${documentId}/instructions`,
        json("POST", {
          content: body.content,
        }),
      ];
    case "UpdateInstruction":
      return [
        `/__sadoku/documents/${documentId}/instructions/${instructionId}`,
        json("PUT", { content: body.content }),
      ];
    case "DeleteInstruction":
      return [
        `/__sadoku/documents/${documentId}/instructions/${instructionId}`,
        { method: "DELETE" },
      ];
    case "ListMemories":
      return [`/__sadoku/documents/${documentId}/memories`, undefined];
    case "DeleteMemory":
      return [
        `/__sadoku/documents/${documentId}/memories/${memoryId}`,
        { method: "DELETE" },
      ];
    case "ListComments":
      return [`/__sadoku/documents/${documentId}/comments`, undefined];
    case "CreateComment":
      return [
        `/__sadoku/documents/${documentId}/comments`,
        json("POST", {
          startLine: body.startLine,
          endLine: body.endLine,
          body: body.body,
        }),
      ];
    case "UpdateComment":
      return [
        `/__sadoku/documents/${documentId}/comments/${commentId}`,
        json(
          "PUT",
          { body: body.body },
        ),
      ];
    case "DeleteComment":
      return [`/__sadoku/documents/${documentId}/comments/${commentId}`, {
        method: "DELETE",
      }];
    case "SetCommentResolution":
      return [
        `/__sadoku/documents/${documentId}/comments/${commentId}/${
          body.resolved ? "resolve" : "reopen"
        }`,
        { method: "POST" },
      ];
    case "CreateReply":
      return [
        `/__sadoku/documents/${documentId}/comments/${commentId}/replies`,
        json("POST", { body: body.body }),
      ];
    case "UpdateReply":
      return [
        `/__sadoku/documents/${documentId}/comments/${commentId}/replies/${replyId}`,
        json("PUT", { body: body.body }),
      ];
    case "DeleteReply":
      return [
        `/__sadoku/documents/${documentId}/comments/${commentId}/replies/${replyId}`,
        { method: "DELETE" },
      ];
    case "ExportCommentToGitHub":
      return [
        `/__sadoku/documents/${documentId}/comments/${commentId}/github`,
        json("POST", {
          headSha: body.headSha,
          displayedMarkdown: body.displayedMarkdown,
          createdAt: body.createdAt,
          body: body.body,
          startLine: body.startLine,
          endLine: body.endLine,
        }),
      ];
    default:
      throw new Error(`Unexpected Connect test request: ${method}`);
  }
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

(globalThis as typeof globalThis & {
  __sadokuConnectTestFetch?: typeof fetch;
}).__sadokuConnectTestFetch = async (input, init) => {
  const url = new URL(String(input), "http://127.0.0.1");
  const method = url.pathname.startsWith(servicePath)
    ? url.pathname.slice(servicePath.length)
    : undefined;
  if (!method) return globalThis.fetch(input, init);
  if (method === "GetSession" || method === "GetStatistics") {
    return globalThis.fetch(input, init);
  }
  const text = await new Request(input, init).text() || "{}";
  const body = JSON.parse(text) as Record<string, unknown>;
  const [path, legacyInit, transform = (value) => value] = route(method, body);
  const response = legacyInit === undefined
    ? await globalThis.fetch(path)
    : await globalThis.fetch(path, legacyInit);
  if (!response.ok) {
    const message = await response.text();
    return Response.json({ code: "internal", message }, {
      status: response.status,
    });
  }
  const value = response.status === 204 ? {} : await response.json();
  return Response.json(transform(value), {
    headers: { "content-type": "application/json" },
  });
};
