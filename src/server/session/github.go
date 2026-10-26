package session

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mukopikmin/sadoku/src/server/config"
	u "github.com/mukopikmin/sadoku/src/server/usecase"
	whatwg "github.com/nlnwa/whatwg-url/url"
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
	titlePresent       bool
}

func ParsePull(input string) *Pull {
	return parsePullURL(parseHTTPURL(input))
}

func parsePullURL(parsed *whatwg.Url) *Pull {
	if parsed == nil || parsed.Scheme() != "https" || parsed.Hostname() != "github.com" {
		return nil
	}
	m := regexp.MustCompile(`^/([^/]+)/([^/]+)/pull/([0-9]+)/?$`).FindStringSubmatch(parsed.Pathname())
	if m == nil {
		return nil
	}
	number, err := strconv.Atoi(m[3])
	if err != nil || number < 1 || int64(number) > 9007199254740991 {
		return nil
	}
	owner, err := url.PathUnescape(m[1])
	if err != nil || !utf8.ValidString(owner) {
		return nil
	}
	repo, err := url.PathUnescape(m[2])
	if err != nil || !utf8.ValidString(repo) {
		return nil
	}
	return &Pull{Owner: owner, Repo: repo, Number: number, URL: fmt.Sprintf("https://github.com/%s/%s/pull/%d", m[1], m[2], number)}
}
func (p *Pull) endpoint() string {
	return fmt.Sprintf("repos/%s/%s/pulls/%d", encodeComponent(p.Owner), encodeComponent(p.Repo), p.Number)
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
		if errors.Is(err, exec.ErrNotFound) {
			return nil, fmt.Errorf("GitHub pull request previews require the GitHub CLI. Install gh, then run `gh auth login --hostname github.com`.")
		}
		return nil, &githubCommandError{u.TrimSpace(decodeText(stderr.Bytes(), true))}
	}
	return out, nil
}

type githubCommandError struct{ stderr string }

func (e *githubCommandError) Error() string {
	detail := strings.ToLower(e.stderr)
	switch {
	case strings.Contains(detail, "not logged"), strings.Contains(detail, "authentication"), strings.Contains(detail, "gh auth login"):
		return "GitHub CLI is not authenticated. Run `gh auth login --hostname github.com`."
	case strings.Contains(detail, "rate limit"):
		return "GitHub API rate limit exceeded. Try again later."
	case strings.Contains(detail, "not found"), strings.Contains(detail, "http 404"):
		return "GitHub pull request was not found or the authenticated account cannot access the repository."
	case e.stderr == "":
		return "GitHub CLI request failed."
	default:
		return "GitHub CLI request failed: " + e.stderr
	}
}
func ghJSON(ctx context.Context, endpoint string, payload, out any) error {
	b, err := gh(ctx, endpoint, payload, false)
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(decodeText(b, true)), out)
}
func ghPages[T any](ctx context.Context, endpoint string) ([]T, error) {
	all := []T{}
	for page := 1; ; page++ {
		var values []T
		if err := ghJSON(ctx, fmt.Sprintf("%s?per_page=100&page=%d", endpoint, page), nil, &values); err != nil {
			return nil, err
		}
		if values == nil {
			return nil, fmt.Errorf("GitHub returned an invalid list")
		}
		all = append(all, values...)
		if len(values) < 100 {
			return all, nil
		}
	}
}

type changedFile struct{ Filename, Status, Patch string }

func (s *Session) preparePull(ctx context.Context, p *Pull, settings config.Settings) error {
	details, err := readPullDetails(ctx, p.endpoint(), true)
	if err != nil {
		return err
	}
	p.Details = details
	p.HeadSHA = p.Details.Head.SHA
	return s.preparePullSnapshot(ctx, p, settings)
}

func (s *Session) preparePullSnapshot(ctx context.Context, p *Pull, settings config.Settings) error {
	files, err := listPullFiles(ctx, p, settings)
	if err != nil {
		return err
	}
	if !p.Details.titlePresent {
		return fmt.Errorf("GitHub API response did not contain a valid pull request title.")
	}
	s.GitHub = p
	s.Root = p.URL
	s.PullRequest = map[string]any{"description": p.Details.Body, "number": p.Number, "title": p.Details.Title, "url": p.URL}
	s.ReadRemote = func(ctx context.Context, source string) (string, error) {
		parsed, err := url.Parse(source)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "api.github.com" {
			return "", fmt.Errorf("invalid GitHub contents URL")
		}
		b, err := gh(ctx, strings.TrimPrefix(parsed.RequestURI(), "/"), nil, true)
		return decodeText(b, true), err
	}
	for _, file := range files {
		parts := strings.Split(file.Filename, "/")
		for i := range parts {
			parts[i] = encodeComponent(parts[i])
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
		s.Sources[doc.ID] = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s?ref=%s", encodeComponent(p.Owner), encodeComponent(p.Repo), encoded, encodeComponent(p.HeadSHA))
		identity, _, _ := Source(s.Sources[doc.ID])
		commentDoc, found, err := s.Repository.FindDocument(identity)
		if err != nil {
			return err
		}
		if found {
			if s.CommentIDs == nil {
				s.CommentIDs = map[int64]int64{}
			}
			s.CommentIDs[doc.ID] = commentDoc.ID
		}
	}
	return nil
}

func encodeComponent(value string) string {
	return strings.NewReplacer("+", "%20", "%21", "!", "%27", "'", "%28", "(", "%29", ")", "%2A", "*").Replace(url.QueryEscape(value))
}
func GitHubAccount(ctx context.Context) (any, error) {
	b, err := gh(ctx, "user", nil, false)
	if err != nil {
		message := "GitHub CLI authentication is unavailable."
		var commandError *githubCommandError
		if !errors.As(err, &commandError) {
			return nil, err
		}
		if commandError.stderr != "" {
			message = commandError.stderr
		}
		return map[string]any{"ok": false, "message": message}, nil
	}
	var account map[string]any
	if err = json.Unmarshal([]byte(decodeText(b, true)), &account); err != nil {
		return map[string]any{"ok": false, "message": "GitHub returned an invalid account."}, nil
	}
	login, ok := account["login"].(string)
	if !ok || login == "" {
		return map[string]any{"ok": false, "message": "GitHub returned an invalid account."}, nil
	}
	result := map[string]any{"login": login}
	for field, key := range map[string]string{"name": "name", "avatar_url": "avatarUrl"} {
		if value, ok := account[field].(string); ok && value != "" {
			result[key] = value
		}
	}
	return map[string]any{"ok": true, "account": result}, nil
}
func exportFailure(code string) error {
	kind := "already_exists"
	if code == "export_comment_not_found" || code == "export_document_not_found" {
		kind = "not_found"
	}
	if code == "export_failed" {
		kind = "internal"
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
	comments, err := s.readComments(doc.ID)
	if err != nil {
		return nil, err
	}
	changed := comments.SourceSnapshot == nil || *comments.SourceSnapshot != markdown
	comments = u.ResolveComments(comments, markdown)
	if changed && len(comments.Comments) > 0 {
		if err = s.saveComments(doc.ID, comments); err != nil {
			return nil, err
		}
	}
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
	if user.Login == "" {
		return nil, fmt.Errorf("GitHub returned an invalid user")
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
	if pending != nil && (pending.NodeID == "" || pending.CommitID == "" || u.PositiveID(pending.ID) != nil) {
		return nil, fmt.Errorf("GitHub returned an invalid pending review")
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
				if c.NodeID == "" {
					return nil, fmt.Errorf("GitHub returned an invalid comment ID")
				}
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
		if existing.NodeID == "" {
			return nil, fmt.Errorf("GitHub returned an invalid comment ID")
		}
		start := existing.Line
		if existing.StartLine != nil {
			start = *existing.StartLine
		}
		if pending == nil || existing.CommitID != in.HeadSHA || existing.Path != doc.RelativePath || start != in.StartLine || existing.Line != in.EndLine || existing.Side != "RIGHT" {
			return nil, exportFailure("export_review_out_of_sync")
		}
	}
	supported, err := supportsPullRange(ctx, p, doc.RelativePath, in.StartLine, in.EndLine)
	if err != nil {
		return nil, err
	}
	if !supported {
		return nil, exportFailure("export_outside_diff")
	}
	// Recheck local data and remote head after all paginated reads.
	latest, err := s.readComments(doc.ID)
	if err != nil {
		return nil, err
	}
	latest = u.ResolveComments(latest, markdown)
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
		latest, err := readPullDetails(ctx, pull.endpoint(), false)
		if err != nil {
			if ctx.Err() == nil {
				logError(err)
			}
			continue
		}
		if latest.Head.SHA == pull.HeadSHA {
			continue
		}
		pull.HeadSHA = latest.Head.SHA
		pull.Details.Head.SHA = latest.Head.SHA
		next := &Session{Repository: s.Repository, Sources: map[int64]string{}, Documents: []u.Document{}}
		if err := next.preparePullSnapshot(ctx, &pull, settings); err != nil {
			if ctx.Err() == nil {
				logError(err)
			}
			continue
		}
		s.Mu.Lock()
		s.Documents, s.Sources, s.CommentIDs, s.PullRequest, s.GitHub = next.Documents, next.Sources, next.CommentIDs, next.PullRequest, next.GitHub
		s.Mu.Unlock()
		s.Invalidate()
	}
}
