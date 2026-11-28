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
				threads.human, threads.bot, threads.resolved,
				threads.documents_with_comments, threads.documents_with_unresolved_threads,
				replies.human, replies.bot,
				(SELECT COUNT(*) FROM document_revision),
				COALESCE((SELECT file FROM pragma_database_list WHERE name = 'main'), '')
			FROM (
				SELECT COUNT(CASE WHEN author_type = 'human' THEN 1 END) AS human,
					COUNT(CASE WHEN author_type = 'bot' THEN 1 END) AS bot,
					COUNT(CASE WHEN resolved = 1 THEN 1 END) AS resolved,
					COUNT(DISTINCT document_id) AS documents_with_comments,
					COUNT(DISTINCT CASE WHEN resolved = 0 THEN document_id END)
						AS documents_with_unresolved_threads
				FROM comment
			) AS threads
			CROSS JOIN (
				SELECT COUNT(CASE WHEN author_type = 'human' THEN 1 END) AS human,
					COUNT(CASE WHEN author_type = 'bot' THEN 1 END) AS bot
				FROM comment_reply
			) AS replies`).Scan(
			&statistics.DocumentCount,
			&statistics.CommentCount.Human, &statistics.CommentCount.Bot,
			&details.ResolvedThreadCount,
			&details.DocumentsWithCommentsCount, &details.DocumentsWithUnresolvedThreadsCount,
			&details.ReplyCount.Human, &details.ReplyCount.Bot,
			&details.RevisionCount, &databasePath,
		)
		if err != nil {
			return u.DatabaseStatistics{}, err
		}
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
