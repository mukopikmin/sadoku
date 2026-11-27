package storage

import (
	"context"
	"os"

	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func (r *Repository) Statistics(ctx context.Context, includeDetails bool) (u.DatabaseStatistics, error) {
	var statistics u.DatabaseStatistics
	var databasePath string
	if includeDetails {
		var details u.DatabaseStatisticsDetails
		// Read all counts from the same SQLite snapshot, even during writes by
		// another Sadoku process.
		err := r.DB.QueryRowContext(ctx, `
			SELECT
				(SELECT COUNT(*) FROM comment_document),
				threads.human, threads.bot, threads.resolved, threads.stale,
				replies.human, replies.bot,
				history.revision_count, history.document_count, history.last_recorded_at,
				(SELECT COUNT(DISTINCT document_id) FROM document_tag_link),
				(SELECT COUNT(*) FROM document_tag),
				(SELECT COUNT(*) FROM document_memory),
				(SELECT COUNT(*) FROM document_instruction),
				(SELECT COUNT(*) FROM global_instruction),
				(SELECT freelist_count FROM pragma_freelist_count) *
					(SELECT page_size FROM pragma_page_size),
				COALESCE((SELECT file FROM pragma_database_list WHERE name = 'main'), ''),
				sqlite_version(), COALESCE(migration.version, ''), COALESCE(migration.finished_at, '')
			FROM (
				SELECT COUNT(CASE WHEN author_type = 'human' THEN 1 END) AS human,
					COUNT(CASE WHEN author_type = 'bot' THEN 1 END) AS bot,
					COUNT(CASE WHEN resolved = 1 THEN 1 END) AS resolved,
					COUNT(CASE WHEN stale = 1 THEN 1 END) AS stale
				FROM comment
			) AS threads
			CROSS JOIN (
				SELECT COUNT(CASE WHEN author_type = 'human' THEN 1 END) AS human,
					COUNT(CASE WHEN author_type = 'bot' THEN 1 END) AS bot
				FROM comment_reply
			) AS replies
			CROSS JOIN (
				SELECT COUNT(*) AS revision_count, COUNT(DISTINCT document_id) AS document_count,
					COALESCE(MAX(recorded_at), '') AS last_recorded_at
				FROM document_revision
			) AS history
			LEFT JOIN (
				SELECT version, finished_at FROM schema_migration
				WHERE state = 'applied' ORDER BY finished_at DESC, version DESC LIMIT 1
			) AS migration ON TRUE`).Scan(
			&statistics.DocumentCount,
			&statistics.CommentCount.Human, &statistics.CommentCount.Bot,
			&details.ResolvedThreadCount, &details.StaleThreadCount,
			&details.ReplyCount.Human, &details.ReplyCount.Bot,
			&details.RevisionCount, &details.DocumentsWithRevisionsCount, &details.LastRevisionAt,
			&details.TaggedDocumentCount, &details.TagCount, &details.MemoryCount,
			&details.DocumentInstructionCount, &details.GlobalInstructionCount,
			&details.ReusablePageBytes, &databasePath, &details.SQLiteVersion,
			&details.LastMigrationVersion, &details.LastMigrationAt,
		)
		if err != nil {
			return u.DatabaseStatistics{}, err
		}
		details.DatabasePath = databasePath
		statistics.Details = &details
	} else {
		err := r.DB.QueryRowContext(ctx, `
			SELECT (SELECT COUNT(*) FROM comment_document),
				COUNT(CASE WHEN author_type = 'human' THEN 1 END),
				COUNT(CASE WHEN author_type = 'bot' THEN 1 END),
				COALESCE((SELECT file FROM pragma_database_list WHERE name = 'main'), '')
			FROM comment`).Scan(&statistics.DocumentCount, &statistics.CommentCount.Human, &statistics.CommentCount.Bot, &databasePath)
		if err != nil {
			return u.DatabaseStatistics{}, err
		}
	}
	if info, err := os.Stat(databasePath); err == nil && info.Mode().IsRegular() {
		size := info.Size()
		statistics.DatabaseSize = &size
	}
	return statistics, nil
}
