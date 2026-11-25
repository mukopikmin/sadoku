package api

import (
	"context"
	"errors"
	"math"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/internal/gen/sadoku/preview/v1"
	u "github.com/mukopikmin/sadoku/internal/server/usecase"
)

func documentResponse[T any](value *T) *connect.Response[T] {
	response := connect.NewResponse(value)
	response.Header().Set("Cache-Control", "no-store")
	return response
}

func documentWireID(id int64) (uint64, error) {
	if id < 0 {
		return 0, connect.NewError(connect.CodeInternal, errors.New("Failed to encode response."))
	}
	return uint64(id), nil
}

func documentTags(tags []u.Tag) ([]*pb.Tag, error) {
	result := make([]*pb.Tag, 0, len(tags))
	for _, tag := range tags {
		id, err := documentWireID(tag.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, &pb.Tag{Id: id, Name: tag.Name, BackgroundColor: tag.BackgroundColor})
	}
	return result, nil
}

func documentSummary(doc u.Document) (*pb.DocumentSummary, error) {
	id, err := documentWireID(doc.ID)
	if err != nil {
		return nil, err
	}
	tags, err := documentTags(doc.Tags)
	if err != nil {
		return nil, err
	}
	return &pb.DocumentSummary{
		Id: id, RelativePath: doc.RelativePath, Title: doc.Title,
		DisplayTitle: doc.DisplayTitle, Deleted: doc.Deleted, Tags: tags,
	}, nil
}

func documentSummaryResponse(doc u.Document, err error) (*connect.Response[pb.DocumentSummary], error) {
	if err != nil {
		return nil, rpcError(err)
	}
	summary, err := documentSummary(doc)
	if err != nil {
		return nil, err
	}
	return documentResponse(summary), nil
}

func (s *Service) ListDocuments(ctx context.Context, _ *connect.Request[pb.ListDocumentsRequest]) (*connect.Response[pb.ListDocumentsResponse], error) {
	docs, err := s.Session.ListDocuments(ctx)
	if err != nil {
		return nil, rpcError(err)
	}
	summaries := make([]*pb.DocumentSummary, 0, len(docs))
	for _, doc := range docs {
		summary, err := documentSummary(doc)
		if err != nil {
			return nil, err
		}
		summaries = append(summaries, summary)
	}
	return documentResponse(&pb.ListDocumentsResponse{Documents: summaries}), nil
}

func (s *Service) CreateDocument(ctx context.Context, req *connect.Request[pb.CreateDocumentRequest]) (*connect.Response[pb.DocumentSummary], error) {
	in := req.Msg
	return documentSummaryResponse(s.Session.CreateDocument(ctx, in.GetDirectory(), in.GetFilename(), in.GetTitle()))
}

func (s *Service) UpdateDocumentTitle(ctx context.Context, req *connect.Request[pb.UpdateDocumentTitleRequest]) (*connect.Response[pb.DocumentSummary], error) {
	id := req.Msg.GetDocumentId()
	if id > math.MaxInt64 {
		return nil, invalidDocumentRPCID()
	}
	return documentSummaryResponse(s.Session.UpdateDocumentTitle(ctx, int64(id), req.Msg.GetTitle()))
}

func (s *Service) GetDocument(ctx context.Context, req *connect.Request[pb.GetDocumentRequest]) (*connect.Response[pb.GetDocumentResponse], error) {
	id := req.Msg.GetDocumentId()
	if id > math.MaxInt64 {
		return nil, invalidDocumentRPCID()
	}
	doc, err := s.Session.GetDocument(ctx, int64(id))
	if err != nil {
		return nil, rpcError(err)
	}
	tags, err := documentTags(doc.Tags)
	if err != nil {
		return nil, err
	}
	return documentResponse(&pb.GetDocumentResponse{
		FileUrl: doc.FileURL, Markdown: doc.Markdown, Title: doc.Title, Deleted: doc.Deleted,
		Tags: tags, DisplayTitle: doc.DisplayTitle, GithubHeadSha: doc.GitHubHeadSHA,
		PreviousMarkdown: doc.PreviousMarkdown, CanRestore: doc.CanRestore,
	}), nil
}

func (s *Service) ListDocumentRevisions(ctx context.Context, req *connect.Request[pb.ListDocumentRevisionsRequest]) (*connect.Response[pb.ListDocumentRevisionsResponse], error) {
	id := req.Msg.GetDocumentId()
	if id > math.MaxInt64 {
		return nil, invalidDocumentRPCID()
	}
	revisions, err := s.Session.ListDocumentRevisions(ctx, int64(id))
	if err != nil {
		return nil, rpcError(err)
	}
	summaries := make([]*pb.DocumentRevisionSummary, 0, len(revisions))
	for _, rev := range revisions {
		id, err := documentWireID(rev.ID)
		if err != nil {
			return nil, err
		}
		summaries = append(summaries, &pb.DocumentRevisionSummary{Id: id, RecordedAt: rev.RecordedAt})
	}
	return documentResponse(&pb.ListDocumentRevisionsResponse{Revisions: summaries}), nil
}

func (s *Service) GetDocumentRevision(ctx context.Context, req *connect.Request[pb.GetDocumentRevisionRequest]) (*connect.Response[pb.DocumentRevision], error) {
	id, revisionID := req.Msg.GetDocumentId(), req.Msg.GetRevisionId()
	if id > math.MaxInt64 || revisionID > math.MaxInt64 {
		return nil, invalidDocumentRPCID()
	}
	rev, err := s.Session.GetDocumentRevision(ctx, int64(id), int64(revisionID))
	if err != nil {
		return nil, rpcError(err)
	}
	wireID, err := documentWireID(rev.ID)
	if err != nil {
		return nil, err
	}
	return documentResponse(&pb.DocumentRevision{
		Id: wireID, RecordedAt: rev.RecordedAt, Markdown: rev.Markdown, PreviousMarkdown: rev.PreviousMarkdown,
	}), nil
}

func (s *Service) RestoreDocumentRevision(ctx context.Context, req *connect.Request[pb.RestoreDocumentRevisionRequest]) (*connect.Response[pb.RestoreDocumentRevisionResponse], error) {
	id, revisionID := req.Msg.GetDocumentId(), req.Msg.GetRevisionId()
	if id > math.MaxInt64 || revisionID > math.MaxInt64 {
		return nil, invalidDocumentRPCID()
	}
	if err := s.Session.RestoreDocumentRevision(ctx, int64(id), int64(revisionID), req.Msg.ExpectedMarkdown); err != nil {
		return nil, rpcError(err)
	}
	return documentResponse(&pb.RestoreDocumentRevisionResponse{}), nil
}

func invalidDocumentRPCID() error {
	return connect.NewError(connect.CodeInvalidArgument, errors.New("Invalid request: document or revision ID is out of range."))
}
