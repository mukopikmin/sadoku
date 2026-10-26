package tooling

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

const baselineTag = "release-notes-baseline"

var stableVersion = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)

func isStableTag(s string) bool { return strings.HasPrefix(s, "v") && stableVersion.MatchString(s[1:]) }

type release struct {
	TagName      string `json:"tagName"`
	IsDraft      bool   `json:"isDraft"`
	IsPrerelease bool   `json:"isPrerelease"`
}
type ciRun struct {
	DatabaseID   int    `json:"databaseId"`
	WorkflowName string `json:"workflowName"`
	HeadBranch   string `json:"headBranch"`
	Event        string `json:"event"`
	Status       string `json:"status"`
	Conclusion   string `json:"conclusion"`
	HeadSHA      string `json:"headSha"`
	URL          string `json:"url"`
}
type releaseContext struct {
	HeadSHA                   string    `json:"headSha"`
	Repository                string    `json:"repository"`
	Releases                  []release `json:"releases"`
	PreviousStableTag         string    `json:"previousStableTag"`
	ApprovedPreviousStableTag string    `json:"approvedPreviousStableTag"`
	StableTags                []string  `json:"stableTags"`
	BaselineSelection         string    `json:"baselineSelection"`
}
type check struct {
	Name     string `json:"name"`
	OK       bool   `json:"ok"`
	Actual   string `json:"actual"`
	Expected string `json:"expected"`
}
type releaseInspection struct {
	releaseContext
	OK        bool    `json:"ok"`
	Version   string  `json:"version"`
	Tag       string  `json:"tag"`
	TagObject string  `json:"tagObject"`
	CIRuns    []ciRun `json:"ciRuns"`
	Checks    []check `json:"checks"`
}

func readApprovedBaseline(info string) (string, error) {
	lines := strings.Split(strings.TrimSpace(info), "\n")
	if len(lines) != 2 || lines[0] != "tag" || (lines[1] != baselineTag && !isStableTag(lines[1])) {
		return "", fmt.Errorf("release requires an annotated tag with exactly one Previous-Stable-Tag trailer containing a stable tag or %s", baselineTag)
	}
	return lines[1], nil
}
func selectPreviousStableTag(releases []release) string {
	for _, r := range releases {
		if !r.IsDraft && !r.IsPrerelease && isStableTag(r.TagName) {
			return r.TagName
		}
	}
	return baselineTag
}
func loadReleaseContext(version string, run runner) (releaseContext, error) {
	c := releaseContext{Releases: []release{}, StableTags: []string{}}
	if !stableVersion.MatchString(version) {
		return c, fmt.Errorf("invalid semantic version: %s", version)
	}
	var err error
	c.HeadSHA, err = required(run("git", "rev-parse", "HEAD"), "Read HEAD")
	if err != nil {
		return c, err
	}
	c.Repository, err = required(run("gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"), "Resolve GitHub repository")
	if err != nil {
		return c, err
	}
	info, err := required(run("git", "for-each-ref", "--format=%(objecttype)%0a%(contents:trailers:key=Previous-Stable-Tag,valueonly)", "refs/tags/v"+version), "Read approved notes baseline from release tag")
	if err != nil {
		return c, err
	}
	c.ApprovedPreviousStableTag, err = readApprovedBaseline(info)
	if err != nil {
		return c, err
	}
	out, err := required(run("gh", "api", "--paginate", "repos/"+c.Repository+"/releases?per_page=100", "--jq", ".[] | {tagName: .tag_name, isDraft: .draft, isPrerelease: .prerelease}"), "List GitHub releases")
	if err != nil {
		return c, err
	}
	if out != "" {
		for _, line := range strings.Split(out, "\n") {
			var r release
			if err = json.Unmarshal([]byte(line), &r); err != nil {
				return c, err
			}
			c.Releases = append(c.Releases, r)
		}
	}
	tags, err := required(run("git", "ls-remote", "--tags", "origin", "refs/tags/v*"), "Read remote stable tags")
	if err != nil {
		return c, err
	}
	for _, line := range strings.Split(tags, "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			continue
		}
		tag := strings.TrimPrefix(fields[1], "refs/tags/")
		if strings.HasPrefix(fields[1], "refs/tags/v") && tag != "v"+version && isStableTag(tag) {
			c.StableTags = append(c.StableTags, tag)
		}
	}
	c.PreviousStableTag = selectPreviousStableTag(c.Releases)
	c.BaselineSelection = "first stable release in GitHub API order"
	if c.PreviousStableTag == baselineTag {
		c.BaselineSelection = "no stable release returned by GitHub"
	}
	diagnostics, _ := json.Marshal(c)
	if c.PreviousStableTag == baselineTag && len(c.StableTags) > 0 {
		return c, fmt.Errorf("cannot infer a first release: stable tags exist but no stable releases were returned: %s", diagnostics)
	}
	if c.PreviousStableTag != c.ApprovedPreviousStableTag {
		return c, fmt.Errorf("notes baseline differs from the approved tag trailer: %s", diagnostics)
	}
	return c, nil
}
func isNewerVersion(version, previous string) bool {
	if previous == baselineTag {
		return true
	}
	// Compare arbitrary-size decimal components without integer overflow.
	a, b := strings.Split(version, "."), strings.Split(strings.TrimPrefix(previous, "v"), ".")
	for i := range a {
		if len(a[i]) != len(b[i]) {
			return len(a[i]) > len(b[i])
		}
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}
func inspectRelease(version string, run runner) (releaseInspection, error) {
	c, err := loadReleaseContext(version, run)
	r := releaseInspection{releaseContext: c, Version: version, Tag: "v" + version}
	if err != nil {
		return r, err
	}
	git := func(description string, args ...string) (string, error) {
		return required(run("git", args...), description)
	}
	if _, err = git("Fetch main", "fetch", "--no-tags", "origin", "main"); err != nil {
		return r, err
	}
	main, err := git("Read origin/main", "rev-parse", "origin/main")
	if err != nil {
		return r, err
	}
	ref := "refs/tags/" + r.Tag
	r.TagObject, err = git("Read release tag", "rev-parse", "--verify", ref)
	if err != nil {
		return r, err
	}
	commit, err := git("Resolve release tag commit", "rev-parse", "--verify", ref+"^{commit}")
	if err != nil {
		return r, err
	}
	remote, err := git("Read remote release tag", "ls-remote", "--exit-code", "--tags", "origin", ref)
	if err != nil {
		return r, err
	}
	remoteObject := ""
	for _, line := range strings.Split(remote, "\n") {
		f := strings.Fields(line)
		if len(f) == 2 && f[1] == ref {
			remoteObject = f[0]
		}
	}
	previous, err := git("Read notes start tag", "rev-parse", "--verify", "refs/tags/"+c.PreviousStableTag+"^{commit}")
	if err != nil {
		return r, err
	}
	ancestor := run("git", "merge-base", "--is-ancestor", previous, c.HeadSHA)
	rootOK := true
	if c.PreviousStableTag == baselineTag {
		root, err := git("Read repository root", "rev-list", "--max-parents=0", "HEAD")
		if err != nil {
			return r, err
		}
		rootOK = root == previous
	}
	ci, err := required(run("gh", "run", "list", "--repo", c.Repository, "--workflow", "test.yml", "--branch", "main", "--event", "push", "--commit", c.HeadSHA, "--limit", "1", "--json", "databaseId,workflowName,headBranch,event,status,conclusion,headSha,url"), "Read Test run")
	if err != nil {
		return r, err
	}
	if err = json.Unmarshal([]byte(ci), &r.CIRuns); err != nil {
		return r, err
	}
	ciOK := false
	ciURL := ""
	for _, run := range r.CIRuns {
		if run.DatabaseID > 0 && run.WorkflowName == "Test" && run.HeadBranch == "main" && run.Event == "push" && run.Status == "completed" && run.Conclusion == "success" && run.HeadSHA == c.HeadSHA && run.URL != "" {
			ciOK = true
			ciURL = run.URL
			break
		}
	}
	absent := true
	for _, release := range c.Releases {
		if release.TagName == r.Tag {
			absent = false
		}
	}
	absence := "absent"
	if !absent {
		absence = "already exists"
	}
	r.Checks = []check{
		{"remoteMain", c.HeadSHA == main, c.HeadSHA, main},
		{"releaseTag", commit == c.HeadSHA && remoteObject == r.TagObject, fmt.Sprintf("%s / %s locally / %s on origin", commit, r.TagObject, remoteObject), "unchanged " + r.Tag + " at " + c.HeadSHA},
		{"releaseAbsent", absent, absence, "absent, including drafts"},
		{"notesBaseline", ancestor.Success && previous != c.HeadSHA && rootOK, c.PreviousStableTag + " at " + previous, "an earlier ancestor; the root commit for the first release"},
		{"newerVersion", isNewerVersion(version, c.PreviousStableTag), version, "newer than " + c.PreviousStableTag},
		{"ci", ciOK, "selected URL: " + ciURL + "; returned runs: " + ci, "successful Test run for " + c.HeadSHA},
	}
	r.OK = true
	for _, check := range r.Checks {
		r.OK = r.OK && check.OK
	}
	return r, nil
}
func generateNotes(version, output string, run runner) error {
	c, err := loadReleaseContext(version, run)
	if err != nil {
		return err
	}
	if _, err = required(run("git", "rev-parse", "--verify", "refs/tags/"+c.PreviousStableTag+"^{commit}"), "Verify notes start tag"); err != nil {
		return err
	}
	notes, err := required(run("gh", "api", "--method", "POST", "repos/"+c.Repository+"/releases/generate-notes", "-f", "tag_name=v"+version, "-f", "target_commitish="+c.HeadSHA, "-f", "previous_tag_name="+c.PreviousStableTag), "Generate release notes")
	if err != nil {
		return err
	}
	var parsed struct{ Name, Body string }
	if err = json.Unmarshal([]byte(notes), &parsed); err != nil {
		return err
	}
	if strings.TrimSpace(parsed.Body) == "" {
		return fmt.Errorf("generated release notes are empty")
	}
	if parsed.Name == "" {
		parsed.Name = "v" + version
	}
	result := map[string]string{"version": version, "tag": "v" + version, "headSha": c.HeadSHA, "previousStableTag": c.PreviousStableTag, "title": parsed.Name, "body": parsed.Body}
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	if err = atomicWrite(output, append(data, '\n'), 0644); err != nil {
		return err
	}
	return printJSON(result)
}
