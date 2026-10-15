package proxy

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	publicOrigin = "https://preview.example.com"
	backendURL   = "https://sadoku-opaque-id.a.run.app"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func response(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status, Header: make(http.Header),
		Body: io.NopCloser(strings.NewReader(body)), ContentLength: int64(len(body)),
	}
}

func newProxy(t *testing.T, transport http.RoundTripper) http.Handler {
	t.Helper()
	if transport == nil {
		transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
			t.Error("unexpected upstream request")
			return nil, errors.New("unexpected upstream request")
		})
	}
	handler, err := New(Options{BackendServiceURL: backendURL, PublicOrigin: publicOrigin, Transport: transport})
	if err != nil {
		t.Fatal(err)
	}
	return handler
}

func serve(handler http.Handler, method, path string, body io.Reader) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(method, publicOrigin+path, body))
	return w
}

func TestDynamicTagsPathsAndQuery(t *testing.T) {
	for _, tag := range []string{"v1", "staging", "pr-42", "new-tag"} {
		t.Run(tag, func(t *testing.T) {
			proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
				want := "https://" + tag + "---sadoku-opaque-id.a.run.app/documents/a%20b%2Fc?x=1&x=2&q=a+b&next=%2F"
				if r.URL.String() != want {
					t.Errorf("upstream URL = %q, want %q", r.URL, want)
				}
				if r.Host != r.URL.Host {
					t.Errorf("upstream Host = %q, want %q", r.Host, r.URL.Host)
				}
				if got := r.Header.Get("X-Forwarded-Prefix"); got != "/revisions/"+tag {
					t.Errorf("prefix = %q", got)
				}
				return response(200, "ok"), nil
			}))
			w := serve(proxy, "GET", "/revisions/"+tag+"/documents/a%20b%2Fc?x=1&x=2&q=a+b&next=%2F", nil)
			if w.Code != 200 || w.Body.String() != "ok" {
				t.Fatalf("response = %d %q", w.Code, w.Body.String())
			}
		})
	}
}

func TestDeterministicCloudRunURL(t *testing.T) {
	handler, err := New(Options{
		BackendServiceURL: "https://api-123456789.asia-northeast1.run.app/", PublicOrigin: publicOrigin,
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if want := "https://v1---api-123456789.asia-northeast1.run.app/"; r.URL.String() != want {
				t.Errorf("URL = %q, want %q", r.URL, want)
			}
			return response(204, ""), nil
		}),
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := serve(handler, "GET", "/revisions/v1/", nil).Code; got != 204 {
		t.Fatal(got)
	}
}

func TestInvalidRevisionRoutes(t *testing.T) {
	proxy := newProxy(t, nil)
	for _, tag := range []string{
		"", "V1", "1v", "-v1", "v1-", "v_1", "v1.evil.test", "%76%31",
		"v1%2Fstaging", "v1%5Cstaging", "v1%252Fstaging", "%0A", "user@evil.test", strings.Repeat("a", 64),
	} {
		t.Run(tag, func(t *testing.T) {
			if got := serve(proxy, "GET", "/revisions/"+tag+"/", nil).Code; got != 400 {
				t.Fatalf("status = %d", got)
			}
		})
	}
	for _, path := range []string{"/", "/documents", "/revisions", "//evil.test/"} {
		if got := serve(proxy, "GET", path, nil).Code; got != 404 {
			t.Errorf("%q: status = %d", path, got)
		}
	}
	for _, path := range []string{"../documents", "%2e%2e/documents", "a/./b", "a%2F..%2Fb", `a%5Cb`} {
		if got := serve(proxy, "GET", "/revisions/v1/"+path, nil).Code; got != 400 {
			t.Errorf("%q: status = %d", path, got)
		}
	}
}

func TestDNSLabelLimit(t *testing.T) {
	proxy, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: "https://" + strings.Repeat("a", 60) + ".run.app"})
	if err != nil {
		t.Fatal(err)
	}
	if got := serve(proxy, "GET", "/revisions/v1/", nil).Code; got != 400 {
		t.Fatal(got)
	}
}

func TestRejectsInvalidConfiguration(t *testing.T) {
	for _, backend := range []string{
		"", "http://sadoku.run.app", "https://evil.test", "https://run.app.evil.test", "https://127.0.0.1",
		"https://user:pass@sadoku.run.app", "https://sadoku.run.app:8443", "https://sadoku.run.app/path",
		"https://sadoku.run.app?target=evil", "https://sadoku.run.app#fragment", "https://sadoku.run.app?",
		"https://bad_host.run.app", "https://" + strings.Repeat("a", 64) + ".run.app",
	} {
		if _, err := New(Options{BackendServiceURL: backend, PublicOrigin: publicOrigin}); err == nil {
			t.Errorf("accepted backend %q", backend)
		}
	}
	for _, origin := range []string{
		"", "http://preview.example.com", "https://preview.example.com/path",
		"https://user:pass@preview.example.com", "https://preview.example.com?q=1", "https://preview.example.com#",
	} {
		if _, err := New(Options{BackendServiceURL: backendURL, PublicOrigin: origin}); err == nil {
			t.Errorf("accepted public origin %q", origin)
		}
	}
}

func TestRejectsUnconfiguredHost(t *testing.T) {
	proxy := newProxy(t, nil)
	for _, host := range []string{"evil.test", "preview.example.com:1234", "preview.example.com.evil.test"} {
		r := httptest.NewRequest("GET", publicOrigin+"/revisions/v1/", nil)
		r.Host = host
		w := httptest.NewRecorder()
		proxy.ServeHTTP(w, r)
		if w.Code != http.StatusMisdirectedRequest {
			t.Errorf("%q: status = %d", host, w.Code)
		}
	}
	// Absolute-form request targets must also match the configured authority.
	r := httptest.NewRequest("GET", "https://evil.test/revisions/v1/", nil)
	r.Host = "preview.example.com"
	w := httptest.NewRecorder()
	proxy.ServeHTTP(w, r)
	if w.Code != http.StatusMisdirectedRequest {
		t.Fatal(w.Code)
	}
}

func TestCanonicalTagRoot(t *testing.T) {
	proxy := newProxy(t, nil)
	for _, query := range []string{"?x=1&next=%2F", "?", ""} {
		w := serve(proxy, "POST", "/revisions/v1"+query, strings.NewReader("payload"))
		if w.Code != 308 || w.Header().Get("Location") != publicOrigin+"/revisions/v1/"+query {
			t.Fatalf("response = %d %q", w.Code, w.Header().Get("Location"))
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("redirect must not be cached")
		}
	}
}

func TestTLSIsTerminatedBeforeContainer(t *testing.T) {
	proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("X-Forwarded-Proto") != "https" {
			t.Error("public scheme was lost")
		}
		return response(204, ""), nil
	}))
	for _, trailing := range []string{"", "/"} {
		w := httptest.NewRecorder()
		proxy.ServeHTTP(w, httptest.NewRequest("GET", "http://preview.example.com/revisions/v1"+trailing, nil))
		if trailing == "" && w.Header().Get("Location") != publicOrigin+"/revisions/v1/" {
			t.Fatal("redirect did not retain HTTPS")
		}
		if trailing == "/" && w.Code != 204 {
			t.Fatal(w.Code)
		}
	}
}

func TestMethodsAndBinaryBodies(t *testing.T) {
	for _, method := range []string{"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"} {
		t.Run(method, func(t *testing.T) {
			var payload []byte
			if method != "GET" && method != "HEAD" {
				payload = []byte{0, 1, 127, 128, 255}
			}
			proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
				var body []byte
				var err error
				if r.Body != nil {
					body, err = io.ReadAll(r.Body)
				}
				if err != nil || !bytes.Equal(body, payload) || r.Method != method {
					t.Errorf("forwarded %s body %v, err %v", r.Method, body, err)
				}
				if r.Header.Get("Content-Type") != "application/octet-stream" {
					t.Error("content type was lost")
				}
				return response(204, ""), nil
			}))
			r := httptest.NewRequest(method, publicOrigin+"/revisions/v1/resource", bytes.NewReader(payload))
			r.Header.Set("Content-Type", "application/octet-stream")
			w := httptest.NewRecorder()
			proxy.ServeHTTP(w, r)
			if w.Code != 204 {
				t.Fatal(w.Code)
			}
		})
	}
}

func TestForwardingHeaders(t *testing.T) {
	proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		for _, name := range []string{
			"Host", "Connection", "X-Private", "Keep-Alive", "Transfer-Encoding", "Content-Length",
			"Forwarded", "X-Forwarded-For", "X-Forwarded-Port", "X-Goog-Iap-Jwt-Assertion",
			"X-Serverless-Authorization", "X-Original-URL", "X-Rewrite-URL",
		} {
			if got := r.Header.Get(name); got != "" {
				t.Errorf("forwarded %s: %s", name, got)
			}
		}
		for name, want := range map[string]string{
			"X-Forwarded-Prefix": "/revisions/staging", "X-Forwarded-Host": "preview.example.com",
			"X-Forwarded-Proto": "https", "Authorization": "Bearer application-token", "Cookie": "session=app-cookie",
		} {
			if got := r.Header.Get(name); got != want {
				t.Errorf("%s = %q, want %q", name, got, want)
			}
		}
		return response(204, ""), nil
	}))
	r := httptest.NewRequest("GET", publicOrigin+"/revisions/staging/", nil)
	for name, value := range map[string]string{
		"Host": "evil.test", "Connection": "X-Private, X-Forwarded-Prefix", "X-Private": "secret",
		"Keep-Alive": "timeout=5", "Transfer-Encoding": "chunked", "Content-Length": "0",
		"Forwarded": "host=evil.test;proto=http", "X-Forwarded-For": "127.0.0.1", "X-Forwarded-Port": "80",
		"X-Forwarded-Host": "evil.test", "X-Forwarded-Proto": "http", "X-Forwarded-Prefix": "/evil",
		"X-Goog-Iap-Jwt-Assertion": "untrusted", "X-Serverless-Authorization": "Bearer untrusted",
		"X-Original-URL": "https://evil.test", "X-Rewrite-URL": "https://evil.test",
		"Authorization": "Bearer application-token", "Cookie": "session=app-cookie",
	} {
		r.Header.Set(name, value)
	}
	w := httptest.NewRecorder()
	proxy.ServeHTTP(w, r)
	if w.Code != 204 {
		t.Fatal(w.Code)
	}
}

func TestURLShapedPathAndQueryCannotChangeBackend(t *testing.T) {
	proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "v1---sadoku-opaque-id.a.run.app" || r.URL.Path != "//evil.test/path" {
			t.Errorf("unexpected destination: %s", r.URL)
		}
		return response(204, ""), nil
	}))
	if got := serve(proxy, "GET", "/revisions/v1//evil.test/path?url=https://evil.test", nil).Code; got != 204 {
		t.Fatal(got)
	}
}

func TestRequestStreamAndCancellation(t *testing.T) {
	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		// No bytes have been supplied: reaching RoundTrip proves no pre-buffering.
		if r.Body == nil {
			t.Error("request body stream was lost")
			return nil, errors.New("missing body")
		}
		go func() {
			defer writer.Close()
			_, _ = writer.Write([]byte("streamed body"))
		}()
		if got, err := io.ReadAll(r.Body); err != nil || string(got) != "streamed body" {
			t.Errorf("streamed body = %q, err %v", got, err)
		}
		cancel()
		if !errors.Is(r.Context().Err(), context.Canceled) {
			t.Error("request cancellation was lost")
		}
		return response(204, ""), nil
	}))
	r := httptest.NewRequest("POST", publicOrigin+"/revisions/v1/", reader).WithContext(ctx)
	w := httptest.NewRecorder()
	proxy.ServeHTTP(w, r)
	if w.Code != 204 {
		t.Fatal(w.Code)
	}
}

func TestLargeResponseAndSSEStreamOverHTTP(t *testing.T) {
	for _, contentType := range []string{"application/octet-stream", "text/event-stream"} {
		t.Run(contentType, func(t *testing.T) {
			reader, writer := io.Pipe()
			proxy := newProxy(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {contentType}},
					Body: reader, ContentLength: -1}, nil
			}))
			server := httptest.NewServer(proxy)
			defer server.Close()
			release := make(chan struct{})
			defer func() { close(release); reader.Close(); writer.Close() }()
			first := bytes.Repeat([]byte("x"), 1024*1024)
			if contentType == "text/event-stream" {
				first = []byte("data: first\n\n")
			}
			go func() {
				defer writer.Close()
				if _, err := writer.Write(first); err != nil {
					return
				}
				<-release // Upstream stays open until the browser gets the first chunk.
			}()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			r, err := http.NewRequestWithContext(ctx, "GET", server.URL+"/revisions/v1/events", nil)
			if err != nil {
				t.Fatal(err)
			}
			r.Host = "preview.example.com"
			res, err := server.Client().Do(r)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			got := make([]byte, len(first))
			if _, err := io.ReadFull(res.Body, got); err != nil || !bytes.Equal(got, first) {
				t.Fatalf("first chunk was not streamed: %v", err)
			}
			if res.Header.Get("Content-Type") != contentType {
				t.Fatal("content type was lost")
			}
		})
	}
}

func TestUpstreamStatusesAndRedirects(t *testing.T) {
	for _, status := range []int{302, 400, 401, 403, 404, 429, 500, 503} {
		calls := 0
		proxy := newProxy(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
			calls++
			r := response(status, "upstream")
			r.Header.Set("Location", "https://evil.test/")
			r.Header.Set("Set-Cookie", "session=test; Path=/; Secure; HttpOnly")
			r.Header.Set("Retry-After", "5")
			return r, nil
		}))
		w := serve(proxy, "GET", "/revisions/nonexistent/", nil)
		if w.Code != status || w.Body.String() != "upstream" || calls != 1 {
			t.Errorf("status %d: got %d %q, calls %d", status, w.Code, w.Body.String(), calls)
		}
		if w.Header().Get("Location") != "https://evil.test/" || w.Header().Get("Retry-After") != "5" ||
			w.Header().Get("Set-Cookie") != "session=test; Path=/; Secure; HttpOnly" {
			t.Error("upstream response headers were lost")
		}
	}
}

func TestTransportErrorIsGeneric(t *testing.T) {
	proxy := newProxy(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("private backend details")
	}))
	w := serve(proxy, "GET", "/revisions/v1/", nil)
	if w.Code != 502 || w.Body.String() != "Upstream request failed.\n" || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("response = %d %q", w.Code, w.Body.String())
	}
}

func TestConcurrentTagsStayIsolated(t *testing.T) {
	proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		tag := strings.TrimPrefix(r.Header.Get("X-Forwarded-Prefix"), "/revisions/")
		if r.Host != tag+"---sadoku-opaque-id.a.run.app" {
			t.Error("revision and prefix do not match")
		}
		return response(200, tag), nil
	}))
	var wg sync.WaitGroup
	for range 20 {
		for _, tag := range []string{"v1", "staging"} {
			wg.Go(func() {
				w := serve(proxy, "GET", "/revisions/"+url.PathEscape(tag)+"/", nil)
				if w.Code != 200 || w.Body.String() != tag {
					t.Errorf("%s: response = %d %q", tag, w.Code, w.Body.String())
				}
			})
		}
	}
	wg.Wait()
}
