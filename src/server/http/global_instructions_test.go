package http_test

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1/previewv1connect"
)

func TestGlobalInstructionsConnect(t *testing.T) {
	for _, jsonCodec := range []bool{true, false} {
		t.Run(fmt.Sprint(jsonCodec), func(t *testing.T) {
			s, server, _ := setup(t)
			// No document is required, even in a session with no selected documents.
			s.Documents = nil
			options := []connect.ClientOption{}
			if jsonCodec {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			ctx := context.Background()
			created, err := client.CreateGlobalInstruction(ctx, connect.NewRequest(&pb.CreateGlobalInstructionRequest{Content: "Shared"}))
			if err != nil {
				t.Fatal(err)
			}
			if created.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing cache policy")
			}
			id := created.Msg.Id
			list, err := client.ListGlobalInstructions(ctx, connect.NewRequest(&pb.ListGlobalInstructionsRequest{}))
			if err != nil || len(list.Msg.Instructions) != 1 {
				t.Fatalf("list: %v %v", list, err)
			}
			updated, err := client.UpdateGlobalInstruction(ctx, connect.NewRequest(&pb.UpdateGlobalInstructionRequest{InstructionId: id, Content: "Updated"}))
			if err != nil || updated.Msg.Content != "Updated" || updated.Msg.CreatedAt != created.Msg.CreatedAt {
				t.Fatalf("update: %v %v", updated, err)
			}
			_, err = client.CreateGlobalInstruction(ctx, connect.NewRequest(&pb.CreateGlobalInstructionRequest{Content: " \n "}))
			if connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("empty accepted: %v", err)
			}
			_, err = client.UpdateGlobalInstruction(ctx, connect.NewRequest(&pb.UpdateGlobalInstructionRequest{Content: "Invalid"}))
			if connect.CodeOf(err) != connect.CodeNotFound {
				t.Fatalf("zero update: %v", err)
			}
			_, err = client.DeleteGlobalInstruction(ctx, connect.NewRequest(&pb.DeleteGlobalInstructionRequest{InstructionId: id}))
			if err != nil {
				t.Fatal(err)
			}
			_, err = client.UpdateGlobalInstruction(ctx, connect.NewRequest(&pb.UpdateGlobalInstructionRequest{InstructionId: id, Content: "Missing"}))
			if connect.CodeOf(err) != connect.CodeNotFound {
				t.Fatalf("missing update: %v", err)
			}
			_, err = client.DeleteGlobalInstruction(ctx, connect.NewRequest(&pb.DeleteGlobalInstructionRequest{InstructionId: id}))
			if connect.CodeOf(err) != connect.CodeNotFound {
				t.Fatalf("missing delete: %v", err)
			}
		})
	}
}

func TestGlobalInstructionsREST(t *testing.T) {
	_, server, _ := setup(t)
	path := "/__sadoku/global-instructions"
	b := restRequest(t, server.URL, "POST", path, `{"content":"Shared","documentId":999}`, "application/json", 201)
	var created map[string]any
	if err := json.Unmarshal(b, &created); err != nil {
		t.Fatal(err)
	}
	if created["documentId"] != nil {
		t.Fatal(created)
	}
	idPath := fmt.Sprintf("%s/%.0f", path, created["id"])
	restRequest(t, server.URL, "PUT", idPath, `{"content":"Updated","instructionId":999}`, "application/json", 200)
	b = restRequest(t, server.URL, "GET", path, "", "", 200)
	var list struct{ Instructions []struct{ Content string } }
	if err := json.Unmarshal(b, &list); err != nil || len(list.Instructions) != 1 || list.Instructions[0].Content != "Updated" {
		t.Fatalf("list: %s %v", b, err)
	}
	for _, body := range []string{`{}`, `{"content":null}`, `{"content":7}`, `{"content":" "}`} {
		restRequest(t, server.URL, "POST", path, body, "application/json", 400)
	}
	restRequest(t, server.URL, "DELETE", idPath, "", "", 204)
	restRequest(t, server.URL, "DELETE", idPath, "", "", 404)
	restRequest(t, server.URL, "PUT", path+"/0", `{"content":"bad"}`, "application/json", 404)
}

func TestInstructionAPISavesSingleValuePerScope(t *testing.T) {
	for _, jsonCodec := range []bool{true, false} {
		t.Run(fmt.Sprint(jsonCodec), func(t *testing.T) {
			s, server, _ := setup(t)
			options := []connect.ClientOption{}
			if jsonCodec {
				options = append(options, connect.WithProtoJSON())
			}
			client := previewv1connect.NewPreviewServiceClient(server.Client(), server.URL, options...)
			ctx := context.Background()
			docID := uint64(s.Documents[0].ID)
			var globalID, localID uint64
			for _, content := range []string{"First", "Replacement"} {
				global, err := client.CreateGlobalInstruction(ctx, connect.NewRequest(&pb.CreateGlobalInstructionRequest{Content: "Global " + content}))
				if err != nil {
					t.Fatal(err)
				}
				local, err := client.CreateInstruction(ctx, connect.NewRequest(&pb.CreateInstructionRequest{DocumentId: docID, Content: "Local " + content}))
				if err != nil {
					t.Fatal(err)
				}
				if globalID != 0 && globalID != global.Msg.Id {
					t.Fatal("replaced global ID")
				}
				if localID != 0 && localID != local.Msg.Id {
					t.Fatal("replaced local ID")
				}
				globalID, localID = global.Msg.Id, local.Msg.Id
			}
			global, err := client.ListGlobalInstructions(ctx, connect.NewRequest(&pb.ListGlobalInstructionsRequest{}))
			if err != nil || len(global.Msg.Instructions) != 1 || global.Msg.Instructions[0].Content != "Global Replacement" {
				t.Fatalf("global: %v %v", global, err)
			}
			local, err := client.ListInstructions(ctx, connect.NewRequest(&pb.ListInstructionsRequest{DocumentId: docID}))
			if err != nil || len(local.Msg.Instructions) != 1 || local.Msg.Instructions[0].Content != "Local Replacement" {
				t.Fatalf("local: %v %v", local, err)
			}
		})
	}
}
