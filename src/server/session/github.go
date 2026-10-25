package session

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/url"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/mukopikmin/sadoku/src/server/config"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

type Pull struct {
	Owner, Repo, URL, HeadSHA string
	Number                    int
	Details                   pullDetails
}
type pullDetails struct {
	NodeID             string `json:"node_id"`
	Title, Body, State string
	Head               struct{ SHA string }
}

func ParsePull(input string) *Pull {
	parsed, err := url.Parse(input)
	if err != nil || parsed.Scheme != "https" || !strings.EqualFold(parsed.Host, "github.com") {
		return nil
	}
	m := regexp.MustCompile(`^/([^/]+)/([^/]+)/pull/([0-9]+)/?$`).FindStringSubmatch(parsed.Path)
	if m == nil {
		return nil
	}
	number, err := strconv.Atoi(m[3])
	if err != nil || number < 1 {
		return nil
	}
	return &Pull{Owner: m[1], Repo: m[2], Number: number, URL: fmt.Sprintf("https://github.com/%s/%s/pull/%d", m[1], m[2], number)}
}
func (p *Pull) endpoint() string {
	return fmt.Sprintf("repos/%s/%s/pulls/%d", url.PathEscape(p.Owner), url.PathEscape(p.Repo), p.Number)
}
func gh(ctx context.Context, endpoint string, payload any, raw bool) ([]byte, error) {
	args := []string{"api", "--hostname", "github.com"}
	if raw {
		args = append(args, "-H", "Accept: application/vnd.github.raw+json")
	}
	var stdin []byte
	if payload != nil {
		var err error
		stdin, err = json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		args = append(args, "--input", "-")
	}
	args = append(args, endpoint)
	cmd := exec.CommandContext(ctx, "gh", args...)
	if stdin != nil {
		cmd.Stdin = bytes.NewReader(stdin)
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("GitHub CLI request failed: %s", strings.TrimSpace(stderr.String()))
	}
	return out, nil
}
func ghJSON(ctx context.Context, endpoint string, payload, out any) error {
	b, err := gh(ctx, endpoint, payload, false)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}
func ghPages[T any](ctx context.Context, endpoint string) ([]T, error) {
	all := []T{}
	for page := 1; ; page++ {
		var values []T
		if err := ghJSON(ctx, fmt.Sprintf("%s?per_page=100&page=%d", endpoint, page), nil, &values); err != nil {
			return nil, err
		}
		all = append(all, values...)
		if len(values) < 100 {
			return all, nil
		}
	}
}

type changedFile struct{ Filename, Status, Patch string }

func (s *Session) preparePull(ctx context.Context, p *Pull, settings config.Settings) error {
	if err := ghJSON(ctx, p.endpoint(), nil, &p.Details); err != nil {
		return err
	}
	p.HeadSHA = p.Details.Head.SHA
	if p.HeadSHA == "" {
		return fmt.Errorf("GitHub response is missing the head SHA")
	}
	s.GitHub = p
	s.Root = p.URL
	s.PullRequest = map[string]any{"description": p.Details.Body, "number": p.Number, "title": p.Details.Title, "url": p.URL}
	files, err := ghPages[changedFile](ctx, p.endpoint()+"/files")
	if err != nil {
		return err
	}
	s.ReadRemote = func(ctx context.Context, source string) (string, error) {
		parsed, err := url.Parse(source)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "api.github.com" {
			return "", fmt.Errorf("invalid GitHub contents URL")
		}
		b, err := gh(ctx, strings.TrimPrefix(parsed.RequestURI(), "/"), nil, true)
		return string(b), err
	}
	for _, file := range files {
		if len(s.Documents) >= settings.MaxFiles {
			break
		}
		if file.Status == "removed" {
			continue
		}
		allowed := false
		for _, ext := range settings.MarkdownExtensions {
			if strings.EqualFold(filepath.Ext(file.Filename), ext) {
				allowed = true
			}
		}
		if !allowed {
			continue
		}
		parts := strings.Split(file.Filename, "/")
		for i := range parts {
			parts[i] = url.PathEscape(parts[i])
		}
		encoded := strings.Join(parts, "/")
		doc, err := s.Repository.Ensure(p.URL + "/files/" + encoded)
		if err != nil {
			return err
		}
		doc.RelativePath = file.Filename
		doc.Title = filepath.Base(file.Filename)
		doc.Tags = []u.Tag{}
		s.Documents = append(s.Documents, doc)
		s.Sources[doc.ID] = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s?ref=%s", url.PathEscape(p.Owner), url.PathEscape(p.Repo), encoded, url.QueryEscape(p.HeadSHA))
		identity, _, _ := Source(s.Sources[doc.ID])
		commentDoc, err := s.Repository.Ensure(identity)
		if err != nil {
			return err
		}
		if s.CommentIDs == nil {
			s.CommentIDs = map[int64]int64{}
		}
		s.CommentIDs[doc.ID] = commentDoc.ID

		markdown, err := s.Read(ctx, doc.ID)
		if err != nil {
			return err
		}
		if err = s.Repository.InitializeSnapshot(doc.ID, markdown); err != nil {
			return err
		}
	}
	return nil
}
func GitHubAccount(ctx context.Context) any {
	var account struct {
		Login     string  `json:"login"`
		Name      *string `json:"name"`
		AvatarURL *string `json:"avatar_url"`
	}
	if err := ghJSON(ctx, "user", nil, &account); err != nil || account.Login == "" {
		return map[string]any{"ok": false, "message": "GitHub CLI is not authenticated. Run `gh auth login --hostname github.com`."}
	}
	return map[string]any{"ok": true, "account": map[string]any{"login": account.Login, "name": account.Name, "avatarUrl": account.AvatarURL}}
}
func exportFailure(code string) error {
	kind := "already_exists"
	if code == "export_unavailable" || code == "export_comment_not_found" || code == "export_document_not_found" {
		kind = "not_found"
	}
	return u.Fail(kind, `{"error":{"code":"`+code+`"}}`)
}

type review struct {
	ID       int64
	NodeID   string `json:"node_id"`
	State    string
	CommitID string `json:"commit_id"`
	User     struct{ Login string }
}
type remoteComment struct {
	NodeID    string `json:"node_id"`
	Body      string
	HTMLURL   string `json:"html_url"`
	User      struct{ Login string }
	ReplyID   *int64 `json:"in_reply_to_id"`
	ReviewID  int64  `json:"pull_request_review_id"`
	CommitID  string `json:"commit_id"`
	Path      string
	Line      int
	StartLine *int `json:"start_line"`
	Side      string
}

func graphql(ctx context.Context, query string, variables map[string]any, out any) error {
	var result struct {
		Data   json.RawMessage
		Errors []any
	}
	if err := ghJSON(ctx, "graphql", map[string]any{"query": query, "variables": variables}, &result); err != nil {
		return err
	}
	if len(result.Errors) > 0 || len(result.Data) == 0 {
		return fmt.Errorf("GitHub GraphQL request failed")
	}
	return json.Unmarshal(result.Data, out)
}
func (s *Session) exportComment(ctx context.Context, doc u.Document, in Input) (any, error) {
	p := s.GitHub
	if p == nil {
		return nil, exportFailure("export_unavailable")
	}
	if in.HeadSHA != p.HeadSHA {
		return nil, exportFailure("export_out_of_sync")
	}
	markdown, err := s.Read(ctx, doc.ID)
	if err != nil {
		return nil, err
	}
	if markdown != in.DisplayedMarkdown {
		return nil, exportFailure("export_markdown_changed")
	}
	comments, err := s.Repository.ReadComments(s.CommentDocumentID(doc.ID))
	if err != nil {
		return nil, err
	}
	comments = u.ResolveComments(comments, markdown)
	var target *u.Comment
	for i := range comments.Comments {
		if comments.Comments[i].ID == int64(in.CommentID) {
			target = &comments.Comments[i]
		}
	}
	if target == nil {
		return nil, exportFailure("export_comment_not_found")
	}
	if target.Author.Type != "human" || target.Resolved || target.Stale {
		return nil, exportFailure("export_comment_ineligible")
	}
	if target.CreatedAt != in.CreatedAt || target.Body != in.Body || target.StartLine != in.StartLine || target.EndLine != in.EndLine {
		return nil, exportFailure("export_out_of_sync")
	}
	var keyBuffer bytes.Buffer
	encoder := json.NewEncoder(&keyBuffer)
	encoder.SetEscapeHTML(false)
	if err = encoder.Encode([]any{p.URL, doc.RelativePath, target.ID, target.CreatedAt}); err != nil {
		return nil, err
	}
	keyBytes := bytes.TrimSuffix(keyBuffer.Bytes(), []byte("\n"))
	marker := fmt.Sprintf("<!-- sadoku-comment:%x -->", sha256.Sum256(keyBytes))
	body := in.Body + "\n\n" + marker
	var user struct{ Login string }
	if err = ghJSON(ctx, "user", nil, &user); err != nil {
		return nil, err
	}
	reviews, err := ghPages[review](ctx, p.endpoint()+"/reviews")
	if err != nil {
		return nil, err
	}
	var pending *review
	for i := range reviews {
		rev := &reviews[i]
		if rev.User.Login == user.Login && rev.State == "PENDING" {
			if pending != nil {
				return nil, exportFailure("export_review_out_of_sync")
			}
			pending = rev
		}
	}
	var existing *remoteComment
	if pending != nil {
		list, err := ghPages[remoteComment](ctx, fmt.Sprintf("%s/reviews/%d/comments", p.endpoint(), pending.ID))
		if err != nil {
			return nil, err
		}
		for i := range list {
			c := &list[i]
			if c.User.Login == user.Login && c.ReplyID == nil && c.ReviewID == pending.ID && strings.HasSuffix(c.Body, marker) {
				copy := *c
				existing = &copy
				break
			}
		}
	}
	if existing == nil {
		list, err := ghPages[remoteComment](ctx, p.endpoint()+"/comments")
		if err != nil {
			return nil, err
		}
		for _, c := range list {
			if c.User.Login == user.Login && c.ReplyID == nil && strings.HasSuffix(c.Body, marker) && (pending == nil || c.ReviewID != pending.ID) {
				prefix := p.URL + "#discussion_r"
				suffix := strings.TrimPrefix(c.HTMLURL, prefix)
				if !strings.HasPrefix(c.HTMLURL, prefix) || !regexp.MustCompile(`^[0-9]+$`).MatchString(suffix) {
					return nil, fmt.Errorf("invalid GitHub comment URL")
				}
				return map[string]any{"url": c.HTMLURL, "state": "submitted"}, nil
			}
		}
	}
	if pending != nil && pending.CommitID != in.HeadSHA {
		return nil, exportFailure("export_review_out_of_sync")
	}
	if existing != nil {
		start := existing.Line
		if existing.StartLine != nil {
			start = *existing.StartLine
		}
		if pending == nil || existing.CommitID != in.HeadSHA || existing.Path != doc.RelativePath || start != in.StartLine || existing.Line != in.EndLine || existing.Side != "RIGHT" {
			return nil, exportFailure("export_review_out_of_sync")
		}
	}
	files, err := ghPages[changedFile](ctx, p.endpoint()+"/files")
	if err != nil {
		return nil, err
	}
	supported := false
	hunk := regexp.MustCompile(`^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@`)
	for _, file := range files {
		if file.Filename != doc.RelativePath || file.Status == "removed" {
			continue
		}
		for _, line := range strings.Split(file.Patch, "\n") {
			m := hunk.FindStringSubmatch(line)
			if m == nil {
				continue
			}
			first, _ := strconv.Atoi(m[1])
			count := 1
			if m[2] != "" {
				count, _ = strconv.Atoi(m[2])
			}
			if in.StartLine >= first && in.EndLine < first+count {
				supported = true
			}
		}
	}
	if !supported {
		return nil, exportFailure("export_outside_diff")
	}
	// Recheck local data and remote head after all paginated reads.
	latest, err := s.Repository.ReadComments(s.CommentDocumentID(doc.ID))
	if err != nil {
		return nil, err
	}
	found := false
	for _, c := range latest.Comments {
		if c.ID == target.ID && c.CreatedAt == target.CreatedAt && c.Body == in.Body && c.StartLine == in.StartLine && c.EndLine == in.EndLine && !c.Resolved && !c.Stale && c.Author.Type == "human" {
			found = true
		}
	}
	if !found {
		return nil, exportFailure("export_out_of_sync")
	}
	var pull pullDetails
	if err = ghJSON(ctx, p.endpoint(), nil, &pull); err != nil {
		return nil, err
	}
	if pull.State != "open" {
		return nil, exportFailure("export_unavailable")
	}
	if pull.Head.SHA != in.HeadSHA {
		return nil, exportFailure("export_out_of_sync")
	}
	result := map[string]any{"url": p.URL + "/files", "state": "pending"}
	if existing != nil {
		if existing.Body == body {
			return result, nil
		}
		var check struct {
			Node *struct {
				Body   string
				Review struct {
					ID, State string
					Author    struct{ Login string }
					Commit    struct{ OID string }
				} `json:"pullRequestReview"`
			}
		}
		if err = graphql(ctx, `query($id:ID!){node(id:$id){... on PullRequestReviewComment{body pullRequestReview{id state author{login} commit{oid}}}}}`, map[string]any{"id": existing.NodeID}, &check); err != nil {
			return nil, err
		}
		if check.Node == nil || check.Node.Body != existing.Body || check.Node.Review.ID != pending.NodeID || check.Node.Review.State != "PENDING" || check.Node.Review.Author.Login != user.Login || check.Node.Review.Commit.OID != in.HeadSHA {
			return nil, exportFailure("export_review_out_of_sync")
		}
		var updated struct {
			Update struct {
				Comment struct{ ID string } `json:"pullRequestReviewComment"`
			} `json:"updatePullRequestReviewComment"`
		}
		err = graphql(ctx, `mutation($id:ID!,$body:String!){updatePullRequestReviewComment(input:{pullRequestReviewCommentId:$id,body:$body}){pullRequestReviewComment{id}}}`, map[string]any{"id": existing.NodeID, "body": body}, &updated)
		if err != nil {
			return nil, err
		}
		if updated.Update.Comment.ID != existing.NodeID {
			return nil, fmt.Errorf("invalid updated comment")
		}
		return result, nil
	}
	variables := map[string]any{"body": body, "path": doc.RelativePath, "line": in.EndLine}
	decl := `$body:String!,$path:String!,$line:Int!`
	fields := `body:$body,path:$path,line:$line,side:RIGHT`
	if in.StartLine != in.EndLine {
		variables["startLine"] = in.StartLine
		decl += `,$startLine:Int!`
		fields += `,startLine:$startLine,startSide:RIGHT`
	}
	if pending == nil {
		variables["pullId"] = pull.NodeID
		variables["sha"] = in.HeadSHA
		var created struct {
			Add struct {
				Review struct{ ID, State string } `json:"pullRequestReview"`
			} `json:"addPullRequestReview"`
		}
		query := `mutation($pullId:ID!,$sha:GitObjectID!,` + decl + `){addPullRequestReview(input:{pullRequestId:$pullId,commitOID:$sha,threads:[{` + fields + `}]} ){pullRequestReview{id state}}}`
		if err = graphql(ctx, query, variables, &created); err != nil {
			return nil, err
		}
		if created.Add.Review.ID == "" || created.Add.Review.State != "PENDING" {
			return nil, exportFailure("export_review_out_of_sync")
		}
	} else {
		var check struct {
			Node *struct {
				State  string
				Commit struct{ OID string }
				Author struct{ Login string }
			}
		}
		if err = graphql(ctx, `query($id:ID!){node(id:$id){... on PullRequestReview{state commit{oid} author{login}}}}`, map[string]any{"id": pending.NodeID}, &check); err != nil {
			return nil, err
		}
		if check.Node == nil || check.Node.State != "PENDING" || check.Node.Commit.OID != in.HeadSHA || check.Node.Author.Login != user.Login {
			return nil, exportFailure("export_review_out_of_sync")
		}
		variables["reviewId"] = pending.NodeID
		var added struct {
			Add struct{ Thread struct{ ID string } } `json:"addPullRequestReviewThread"`
		}
		if err = graphql(ctx, `mutation($reviewId:ID!,`+decl+`){addPullRequestReviewThread(input:{pullRequestReviewId:$reviewId,`+fields+`}){thread{id}}}`, variables, &added); err != nil {
			return nil, err
		}
		if added.Add.Thread.ID == "" {
			return nil, fmt.Errorf("invalid pending thread")
		}
	}
	return result, nil
}

// Monitor refreshes immutable PR sources after a remote head change.
func (s *Session) Monitor(ctx context.Context, settings config.Settings, logError func(error)) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		s.Mu.Lock()
		if s.GitHub == nil {
			s.Mu.Unlock()
			return
		}
		pull := *s.GitHub
		s.Mu.Unlock()
		var latest pullDetails
		if err := ghJSON(ctx, pull.endpoint(), nil, &latest); err != nil {
			if ctx.Err() == nil {
				logError(err)
			}
			continue
		}
		if latest.Head.SHA == pull.HeadSHA {
			continue
		}
		next := &Session{Repository: s.Repository, Sources: map[int64]string{}, Documents: []u.Document{}}
		if err := next.preparePull(ctx, &pull, settings); err != nil {
			if ctx.Err() == nil {
				logError(err)
			}
			continue
		}
		s.Mu.Lock()
		s.Documents, s.Sources, s.CommentIDs, s.PullRequest, s.GitHub = next.Documents, next.Sources, next.CommentIDs, next.PullRequest, next.GitHub
		s.Generation++
		s.Mu.Unlock()
	}
}
