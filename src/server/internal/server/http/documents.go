package http

import "net/http"

func (r *router) listDocuments(w http.ResponseWriter, req *http.Request) {
	documents, err := r.session.ListDocuments(req.Context())
	if err != nil {
		respondError(w, err)
		return
	}
	summaries := make([]documentSummary, 0, len(documents))
	for _, doc := range documents {
		summaries = append(summaries, documentSummary{doc.ID, doc.RelativePath, doc.Title, doc.DisplayTitle, doc.Deleted, publicDocumentTags(doc.Tags)})
	}
	respond(w, http.StatusOK, summaries)
}

func (r *router) getDocument(w http.ResponseWriter, req *http.Request) {
	doc, err := r.session.GetDocument(req.Context(), int64(restParameters(req).DocumentID))
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, struct {
		documentSummary
		FileURL       string  `json:"fileUrl"`
		Markdown      string  `json:"markdown"`
		GitHubHeadSHA *string `json:"githubHeadSha,omitempty"`
	}{
		documentSummary: documentSummary{doc.ID, doc.RelativePath, doc.Title, doc.DisplayTitle, doc.Deleted, publicDocumentTags(doc.Tags)},
		FileURL:         doc.FileURL, Markdown: doc.Markdown, GitHubHeadSHA: doc.GitHubHeadSHA,
	})
}
