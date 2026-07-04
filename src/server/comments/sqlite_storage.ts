import { basename } from "@std/path";
import { type AppDatabase, withTransaction } from "../db/connection.ts";
import type {
  CommentsStore,
  CommentsStoreFile,
  CommentsStoreFileList,
} from "./storage.ts";
import type {
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "./types.ts";

type CommentDocumentRow = {
  id: number;
  file_path: string;
};

type CommentRow = {
  body: string;
  created_at: string;
  id: number;
  line: number;
  local_id: number;
  original_line: number;
  resolved: number;
  resolved_at: string | null;
  source_hash: string | null;
  source_text: string | null;
  stale: number;
  updated_at: string;
};

type CommentReplyRow = {
  body: string;
  comment_id: number;
  created_at: string;
  local_id: number;
  updated_at: string;
};

type CommentsFileRow = {
  comment_count: number;
  file_path: string;
  open_count: number;
  updated_at: string | null;
};

const emptyDocument = (filePath: string): PreviewCommentsDocument => ({
  comments: [],
  filePath,
});

const toBoolean = (value: number): boolean => value === 1;

const latestTimestamp = (
  document: PreviewCommentsDocument,
): string => {
  const timestamps = document.comments.flatMap((comment) => [
    comment.createdAt,
    comment.updatedAt,
    ...(comment.resolvedAt ? [comment.resolvedAt] : []),
    ...(comment.replies ?? []).flatMap((reply) => [
      reply.createdAt,
      reply.updatedAt,
    ]),
  ]);

  return timestamps.sort().at(-1) ?? new Date().toISOString();
};

const commentFromRow = (
  row: CommentRow,
  replies: PreviewCommentReply[],
): PreviewComment => ({
  body: row.body,
  createdAt: row.created_at,
  id: row.local_id,
  line: row.line,
  originalLine: row.original_line,
  replies,
  resolved: toBoolean(row.resolved),
  ...(row.resolved_at === null ? {} : { resolvedAt: row.resolved_at }),
  ...(row.source_hash === null ? {} : { sourceHash: row.source_hash }),
  ...(row.source_text === null ? {} : { sourceText: row.source_text }),
  stale: toBoolean(row.stale),
  updatedAt: row.updated_at,
});

const replyFromRow = (row: CommentReplyRow): PreviewCommentReply => ({
  body: row.body,
  createdAt: row.created_at,
  id: row.local_id,
  updatedAt: row.updated_at,
});

const readDocumentRow = async (
  database: AppDatabase,
  filePath: string,
): Promise<CommentDocumentRow | undefined> => {
  const result = await database.execute<CommentDocumentRow>(
    "SELECT id, file_path FROM comment_documents WHERE file_path = ?",
    [filePath],
  );
  return result.rows?.[0];
};

const readDocumentId = async (
  database: AppDatabase,
  filePath: string,
): Promise<number> => {
  const row = await readDocumentRow(database, filePath);
  if (row === undefined) {
    throw new Error(`Comment document was not created for ${filePath}.`);
  }
  return row.id;
};

const readCommentsDocumentFromSqlite = async (
  database: AppDatabase,
  filePath: string,
): Promise<PreviewCommentsDocument> => {
  const documentRow = await readDocumentRow(database, filePath);
  if (documentRow === undefined) return emptyDocument(filePath);

  const comments = (await database.execute<CommentRow>(
    `SELECT id, local_id, line, original_line, body, resolved, resolved_at,
      source_hash, source_text, stale, created_at, updated_at
      FROM comments
      WHERE document_id = ?
      ORDER BY local_id`,
    [documentRow.id],
  )).rows ?? [];
  const replies = (await database.execute<CommentReplyRow>(
    `SELECT comment_id, local_id, body, created_at, updated_at
      FROM comment_replies
      WHERE comment_id IN (SELECT id FROM comments WHERE document_id = ?)
      ORDER BY comment_id, local_id`,
    [documentRow.id],
  )).rows ?? [];
  const repliesByCommentId = new Map<number, CommentReplyRow[]>();
  for (const reply of replies) {
    repliesByCommentId.set(reply.comment_id, [
      ...(repliesByCommentId.get(reply.comment_id) ?? []),
      reply,
    ]);
  }

  return {
    comments: comments.map((comment) =>
      commentFromRow(
        comment,
        (repliesByCommentId.get(comment.id) ?? []).map(replyFromRow),
      )
    ),
    filePath,
  };
};

const writeCommentsDocumentToSqlite = async (
  database: AppDatabase,
  filePath: string,
  document: PreviewCommentsDocument,
): Promise<void> => {
  await withTransaction(database, async () => {
    const updatedAt = latestTimestamp(document);
    await database.execute(
      `INSERT INTO comment_documents (file_path, created_at, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET updated_at = excluded.updated_at`,
      [filePath, updatedAt, updatedAt],
    );
    const documentId = await readDocumentId(database, filePath);

    await database.execute("DELETE FROM comments WHERE document_id = ?", [
      documentId,
    ]);

    for (const comment of document.comments) {
      await database.execute(
        `INSERT INTO comments (
          document_id, local_id, line, original_line, body, resolved,
          resolved_at, source_hash, source_text, stale, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          documentId,
          comment.id,
          comment.line,
          comment.originalLine,
          comment.body,
          comment.resolved ? 1 : 0,
          comment.resolvedAt ?? null,
          comment.sourceHash ?? null,
          comment.sourceText ?? null,
          comment.stale ? 1 : 0,
          comment.createdAt,
          comment.updatedAt,
        ],
      );
      const commentRow = (await database.execute<{ id: number }>(
        "SELECT id FROM comments WHERE document_id = ? AND local_id = ?",
        [documentId, comment.id],
      )).rows?.[0];
      if (commentRow === undefined) {
        throw new Error(`Comment was not created for ${filePath}.`);
      }

      for (const reply of comment.replies ?? []) {
        await database.execute(
          `INSERT INTO comment_replies (
            comment_id, local_id, body, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            commentRow.id,
            reply.id,
            reply.body,
            reply.createdAt,
            reply.updatedAt,
          ],
        );
      }
    }
  });
};

const deleteCommentsDocumentFromSqlite = async (
  database: AppDatabase,
  filePath: string,
): Promise<void> => {
  await database.execute("DELETE FROM comment_documents WHERE file_path = ?", [
    filePath,
  ]);
};

const listCommentsFilesFromSqlite = async (
  database: AppDatabase,
): Promise<CommentsStoreFileList> => {
  const rows = (await database.execute<CommentsFileRow>(
    `SELECT comment_documents.file_path,
      COUNT(comments.id) AS comment_count,
      SUM(CASE WHEN comments.resolved = 0 THEN 1 ELSE 0 END) AS open_count,
      MAX(comments.updated_at) AS updated_at
      FROM comment_documents
      LEFT JOIN comments ON comments.document_id = comment_documents.id
      GROUP BY comment_documents.id, comment_documents.file_path
      ORDER BY comment_documents.file_path`,
  )).rows ?? [];

  const entries: CommentsStoreFile[] = rows.map((row) => ({
    commentCount: row.comment_count,
    fileName: basename(row.file_path),
    markdownPath: row.file_path,
    openCount: row.open_count,
    updatedAt: row.updated_at ?? undefined,
  }));

  return { entries, warnings: [] };
};

export const createSqliteCommentsStore = (
  database: AppDatabase,
): CommentsStore => ({
  delete: (filePath) => deleteCommentsDocumentFromSqlite(database, filePath),
  list: () => listCommentsFilesFromSqlite(database),
  read: (filePath) => readCommentsDocumentFromSqlite(database, filePath),
  write: (filePath, document) =>
    writeCommentsDocumentToSqlite(database, filePath, document),
});
