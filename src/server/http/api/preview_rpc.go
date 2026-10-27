package api

import (
	"connectrpc.com/connect"
	"context"
	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
)

func (s *Service) GetSession(ctx context.Context, req *connect.Request[pb.GetSessionRequest]) (*connect.Response[pb.GetSessionResponse], error) {
	out := new(pb.GetSessionResponse)
	if err := invoke(ctx, s, "GetSession", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) GetStatistics(ctx context.Context, req *connect.Request[pb.GetStatisticsRequest]) (*connect.Response[pb.GetStatisticsResponse], error) {
	out := new(pb.GetStatisticsResponse)
	if err := invoke(ctx, s, "GetStatistics", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ListDocuments(ctx context.Context, req *connect.Request[pb.ListDocumentsRequest]) (*connect.Response[pb.ListDocumentsResponse], error) {
	out := new(pb.ListDocumentsResponse)
	if err := invoke(ctx, s, "ListDocuments", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) CreateDocument(ctx context.Context, req *connect.Request[pb.CreateDocumentRequest]) (*connect.Response[pb.DocumentSummary], error) {
	out := new(pb.DocumentSummary)
	if err := invoke(ctx, s, "CreateDocument", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) UpdateDocumentTitle(ctx context.Context, req *connect.Request[pb.UpdateDocumentTitleRequest]) (*connect.Response[pb.DocumentSummary], error) {
	out := new(pb.DocumentSummary)
	if err := invoke(ctx, s, "UpdateDocumentTitle", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) GetDocument(ctx context.Context, req *connect.Request[pb.GetDocumentRequest]) (*connect.Response[pb.GetDocumentResponse], error) {
	out := new(pb.GetDocumentResponse)
	if err := invoke(ctx, s, "GetDocument", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ListDocumentRevisions(ctx context.Context, req *connect.Request[pb.ListDocumentRevisionsRequest]) (*connect.Response[pb.ListDocumentRevisionsResponse], error) {
	out := new(pb.ListDocumentRevisionsResponse)
	if err := invoke(ctx, s, "ListDocumentRevisions", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) GetDocumentRevision(ctx context.Context, req *connect.Request[pb.GetDocumentRevisionRequest]) (*connect.Response[pb.DocumentRevision], error) {
	out := new(pb.DocumentRevision)
	if err := invoke(ctx, s, "GetDocumentRevision", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) RestoreDocumentRevision(ctx context.Context, req *connect.Request[pb.RestoreDocumentRevisionRequest]) (*connect.Response[pb.RestoreDocumentRevisionResponse], error) {
	out := new(pb.RestoreDocumentRevisionResponse)
	if err := invoke(ctx, s, "RestoreDocumentRevision", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) GetDirectoryStatus(ctx context.Context, req *connect.Request[pb.GetDirectoryStatusRequest]) (*connect.Response[pb.GetDirectoryStatusResponse], error) {
	out := new(pb.GetDirectoryStatusResponse)
	if err := invoke(ctx, s, "GetDirectoryStatus", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) GetSettings(ctx context.Context, req *connect.Request[pb.GetSettingsRequest]) (*connect.Response[pb.Settings], error) {
	out := new(pb.Settings)
	if err := invoke(ctx, s, "GetSettings", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) UpdateSettings(ctx context.Context, req *connect.Request[pb.UpdateSettingsRequest]) (*connect.Response[pb.Settings], error) {
	out := new(pb.Settings)
	if err := invoke(ctx, s, "UpdateSettings", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) GetGitHubAccount(ctx context.Context, req *connect.Request[pb.GetGitHubAccountRequest]) (*connect.Response[pb.GetGitHubAccountResponse], error) {
	out := new(pb.GetGitHubAccountResponse)
	if err := invoke(ctx, s, "GetGitHubAccount", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ListTags(ctx context.Context, req *connect.Request[pb.ListTagsRequest]) (*connect.Response[pb.ListTagsResponse], error) {
	out := new(pb.ListTagsResponse)
	if err := invoke(ctx, s, "ListTags", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) UpdateTag(ctx context.Context, req *connect.Request[pb.UpdateTagRequest]) (*connect.Response[pb.Tag], error) {
	out := new(pb.Tag)
	if err := invoke(ctx, s, "UpdateTag", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) DeleteTag(ctx context.Context, req *connect.Request[pb.DeleteTagRequest]) (*connect.Response[pb.DeleteTagResponse], error) {
	out := new(pb.DeleteTagResponse)
	if err := invoke(ctx, s, "DeleteTag", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ReplaceDocumentTags(ctx context.Context, req *connect.Request[pb.ReplaceDocumentTagsRequest]) (*connect.Response[pb.ReplaceDocumentTagsResponse], error) {
	out := new(pb.ReplaceDocumentTagsResponse)
	if err := invoke(ctx, s, "ReplaceDocumentTags", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ListInstructions(ctx context.Context, req *connect.Request[pb.ListInstructionsRequest]) (*connect.Response[pb.ListInstructionsResponse], error) {
	out := new(pb.ListInstructionsResponse)
	if err := invoke(ctx, s, "ListInstructions", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) CreateInstruction(ctx context.Context, req *connect.Request[pb.CreateInstructionRequest]) (*connect.Response[pb.Instruction], error) {
	out := new(pb.Instruction)
	if err := invoke(ctx, s, "CreateInstruction", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) UpdateInstruction(ctx context.Context, req *connect.Request[pb.UpdateInstructionRequest]) (*connect.Response[pb.Instruction], error) {
	out := new(pb.Instruction)
	if err := invoke(ctx, s, "UpdateInstruction", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) DeleteInstruction(ctx context.Context, req *connect.Request[pb.DeleteInstructionRequest]) (*connect.Response[pb.DeleteInstructionResponse], error) {
	out := new(pb.DeleteInstructionResponse)
	if err := invoke(ctx, s, "DeleteInstruction", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ListMemories(ctx context.Context, req *connect.Request[pb.ListMemoriesRequest]) (*connect.Response[pb.ListMemoriesResponse], error) {
	out := new(pb.ListMemoriesResponse)
	if err := invoke(ctx, s, "ListMemories", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) DeleteMemory(ctx context.Context, req *connect.Request[pb.DeleteMemoryRequest]) (*connect.Response[pb.DeleteMemoryResponse], error) {
	out := new(pb.DeleteMemoryResponse)
	if err := invoke(ctx, s, "DeleteMemory", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ListComments(ctx context.Context, req *connect.Request[pb.ListCommentsRequest]) (*connect.Response[pb.CommentsDocument], error) {
	out := new(pb.CommentsDocument)
	if err := invoke(ctx, s, "ListComments", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) CreateComment(ctx context.Context, req *connect.Request[pb.CreateCommentRequest]) (*connect.Response[pb.Comment], error) {
	out := new(pb.Comment)
	if err := invoke(ctx, s, "CreateComment", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) UpdateComment(ctx context.Context, req *connect.Request[pb.UpdateCommentRequest]) (*connect.Response[pb.Comment], error) {
	out := new(pb.Comment)
	if err := invoke(ctx, s, "UpdateComment", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) DeleteComment(ctx context.Context, req *connect.Request[pb.DeleteCommentRequest]) (*connect.Response[pb.DeleteCommentResponse], error) {
	out := new(pb.DeleteCommentResponse)
	if err := invoke(ctx, s, "DeleteComment", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) SetCommentResolution(ctx context.Context, req *connect.Request[pb.SetCommentResolutionRequest]) (*connect.Response[pb.Comment], error) {
	out := new(pb.Comment)
	if err := invoke(ctx, s, "SetCommentResolution", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) CreateReply(ctx context.Context, req *connect.Request[pb.CreateReplyRequest]) (*connect.Response[pb.Comment], error) {
	out := new(pb.Comment)
	if err := invoke(ctx, s, "CreateReply", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) UpdateReply(ctx context.Context, req *connect.Request[pb.UpdateReplyRequest]) (*connect.Response[pb.Comment], error) {
	out := new(pb.Comment)
	if err := invoke(ctx, s, "UpdateReply", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) DeleteReply(ctx context.Context, req *connect.Request[pb.DeleteReplyRequest]) (*connect.Response[pb.DeleteReplyResponse], error) {
	out := new(pb.DeleteReplyResponse)
	if err := invoke(ctx, s, "DeleteReply", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
func (s *Service) ExportCommentToGitHub(ctx context.Context, req *connect.Request[pb.ExportCommentToGitHubRequest]) (*connect.Response[pb.ExportCommentToGitHubResponse], error) {
	out := new(pb.ExportCommentToGitHubResponse)
	if err := invoke(ctx, s, "ExportCommentToGitHub", req.Msg, out); err != nil {
		return nil, err
	}
	res := connect.NewResponse(out)
	res.Header().Set("Cache-Control", "no-store")
	return res, nil
}
