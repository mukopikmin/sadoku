package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	pb "github.com/mukopikmin/sadoku/gen/go/sadoku/preview/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"
)

var rpcInputs = func() map[string]protoreflect.MessageDescriptor {
	result := map[string]protoreflect.MessageDescriptor{}
	methods := pb.File_sadoku_preview_v1_preview_proto.Services().ByName("PreviewService").Methods()
	for i := 0; i < methods.Len(); i++ {
		method := methods.Get(i)
		result["/sadoku.preview.v1.PreviewService/"+string(method.Name())] = method.Input()
	}
	return result
}()

// Keep the original JSON validation contract ahead of Connect's more permissive
// decoder. In particular, unknown fields must never reach a mutating handler.
// Binary protobuf remains supported by the native Connect adapter.
func validateRPC(w http.ResponseWriter, req *http.Request) bool {
	input, ok := rpcInputs[req.URL.Path]
	if !ok {
		return true
	}
	fail := func(status int, code, message string) bool {
		respond(w, status, map[string]string{"code": code, "message": message})
		return false
	}
	if req.Method != "POST" {
		return fail(405, "unimplemented", "HTTP method is not supported.")
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(req.Header.Get("Content-Type"), ";")[0]))
	if contentType == "application/proto" || strings.HasPrefix(contentType, "application/grpc") {
		return true
	}
	if contentType != "application/json" {
		return fail(415, "invalid_argument", "Content-Type must be application/json.")
	}
	if req.Header.Get("Connect-Protocol-Version") != "1" {
		return fail(400, "invalid_argument", "Connect-Protocol-Version must be 1.")
	}
	if encoding := req.Header.Get("Content-Encoding"); encoding != "" && !strings.EqualFold(encoding, "identity") {
		return fail(415, "unimplemented", "Compressed requests are not supported.")
	}
	var data []byte
	var err error
	if req.Body != nil {
		data, err = io.ReadAll(io.LimitReader(req.Body, (32<<20)+1))
		req.Body.Close()
	}
	if err != nil || len(data) > 32<<20 || protojson.Unmarshal(data, dynamicpb.NewMessage(input)) != nil {
		return fail(400, "invalid_argument", "Invalid request message.")
	}
	req.Body = io.NopCloser(bytes.NewReader(data))
	return true
}

// The original creation API returns 412 for an unavailable destination. Keep
// that HTTP status while retaining Connect's failed_precondition wire code.
type creationResponse struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *creationResponse) WriteHeader(status int) {
	w.status = status
	if status != 400 {
		w.ResponseWriter.WriteHeader(status)
	}
}

func (w *creationResponse) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(200)
	}
	if w.status == 400 {
		return w.body.Write(data)
	}
	return w.ResponseWriter.Write(data)
}

func (w *creationResponse) finish() {
	if w.status != 400 {
		return
	}
	var failure struct{ Code string }
	status := 400
	if json.Unmarshal(w.body.Bytes(), &failure) == nil && failure.Code == "failed_precondition" {
		status = 412
	}
	w.ResponseWriter.WriteHeader(status)
	w.ResponseWriter.Write(w.body.Bytes())
}
