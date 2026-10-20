package proxy

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type testClock struct{ nanos atomic.Int64 }

func newTestClock() *testClock {
	clock := &testClock{}
	clock.nanos.Store(time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC).UnixNano())
	return clock
}

func (c *testClock) Now() time.Time          { return time.Unix(0, c.nanos.Load()) }
func (c *testClock) Advance(d time.Duration) { c.nanos.Add(int64(d)) }

func jwtPayload(payload string) string {
	encode := base64.RawURLEncoding.EncodeToString
	return encode([]byte(`{"alg":"RS256"}`)) + "." + encode([]byte(payload)) + "." + encode([]byte("synthetic-signature"))
}

func fakeIDToken(audience string, expires time.Time) string {
	payload, _ := json.Marshal(map[string]any{"aud": audience, "exp": expires.Unix()})
	return jwtPayload(string(payload))
}

func metadataResponse(token string) *http.Response {
	r := response(http.StatusOK, token)
	r.Header.Set("Metadata-Flavor", "Google")
	return r
}

func metadataSource(clock *testClock, transport http.RoundTripper) *metadataTokenSource {
	client := newMetadataClient()
	client.Transport = transport
	return newMetadataTokenSource(backendURL, client, clock.Now)
}

func awaitSignal(t *testing.T, signal <-chan struct{}) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for metadata request")
	}
}

func TestMetadataRequestAndTokenReuse(t *testing.T) {
	clock := newTestClock()
	want := fakeIDToken(backendURL, clock.Now().Add(time.Hour))
	var calls atomic.Int32
	source := metadataSource(clock, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls.Add(1)
		if r.Method != "GET" || r.URL.Scheme != "http" || r.URL.Host != "metadata.google.internal" ||
			r.URL.Path != "/computeMetadata/v1/instance/service-accounts/default/identity" {
			t.Errorf("unexpected metadata endpoint: %s %s", r.Method, r.URL)
		}
		if r.Header.Get("Metadata-Flavor") != "Google" || r.Header.Get("Authorization") != "" ||
			r.URL.Query().Get("audience") != backendURL || r.URL.Query().Get("format") != "full" || len(r.URL.Query()) != 2 {
			t.Error("metadata request must use only the configured audience and full format")
		}
		if _, ok := r.Context().Deadline(); !ok {
			t.Error("metadata request has no deadline")
		}
		return metadataResponse(want), nil
	}))
	for range 3 {
		got, err := source.Token(context.Background())
		if err != nil || got != want {
			t.Fatalf("token unavailable: %v", err)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("metadata requests = %d, want 1", calls.Load())
	}
}

func TestMetadataRefreshBeforeExpiry(t *testing.T) {
	clock := newTestClock()
	var calls atomic.Int32
	source := metadataSource(clock, roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls.Add(1)
		return metadataResponse(fakeIDToken(backendURL, clock.Now().Add(time.Hour))), nil
	}))
	first, err := source.Token(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	clock.Advance(58*time.Minute + 59*time.Second)
	if got, err := source.Token(context.Background()); err != nil || got != first || calls.Load() != 1 {
		t.Fatal("valid cached token was not reused")
	}
	clock.Advance(time.Second)
	if got, err := source.Token(context.Background()); err != nil || got == first || calls.Load() != 2 {
		t.Fatal("token was not refreshed one minute before expiry")
	}
}

func TestMetadataFailureDoesNotFallBackToOldToken(t *testing.T) {
	clock := newTestClock()
	var calls atomic.Int32
	var unavailable atomic.Bool
	source := metadataSource(clock, roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls.Add(1)
		if unavailable.Load() {
			return response(503, "private metadata response"), nil
		}
		return metadataResponse(fakeIDToken(backendURL, clock.Now().Add(time.Hour))), nil
	}))
	if _, err := source.Token(context.Background()); err != nil {
		t.Fatal(err)
	}
	unavailable.Store(true)
	clock.Advance(59 * time.Minute)
	for range 3 {
		if token, err := source.Token(context.Background()); token != "" || !errors.Is(err, errIDToken) {
			t.Fatal("refresh failure returned a cached credential")
		}
	}
	if calls.Load() != 2 {
		t.Fatal("metadata failure did not share its brief backoff")
	}
	clock.Advance(2 * time.Minute)
	if token, err := source.Token(context.Background()); token != "" || err == nil {
		t.Fatal("expired token was returned")
	}
	unavailable.Store(false)
	clock.Advance(time.Second)
	if token, err := source.Token(context.Background()); token == "" || err != nil || calls.Load() != 4 {
		t.Fatal("metadata recovery did not produce a fresh token")
	}
}

func TestMetadataResponseValidation(t *testing.T) {
	clock := newTestClock()
	valid := fakeIDToken(backendURL, clock.Now().Add(time.Hour))
	for name, token := range map[string]string{
		"empty": "", "opaque": "not-a-jwt", "oversized": strings.Repeat("x", maxIDTokenBytes+1),
		"invalid base64": "a.b.c", "invalid JSON": jwtPayload("not JSON"),
		"wrong audience":    fakeIDToken(publicOrigin, clock.Now().Add(time.Hour)),
		"tagged audience":   fakeIDToken("https://v1---sadoku-opaque-id.a.run.app", clock.Now().Add(time.Hour)),
		"expired":           fakeIDToken(backendURL, clock.Now().Add(-time.Second)),
		"refresh window":    fakeIDToken(backendURL, clock.Now().Add(time.Minute)),
		"missing expiry":    jwtPayload(`{"aud":"` + backendURL + `"}`),
		"fractional expiry": jwtPayload(`{"aud":"` + backendURL + `","exp":123.4}`),
		"array audience":    jwtPayload(`{"aud":["` + backendURL + `"],"exp":9999999999}`),
		"header injection":  valid + "\r\nX-Injected: value",
	} {
		t.Run(name, func(t *testing.T) {
			source := metadataSource(clock, roundTripFunc(func(*http.Request) (*http.Response, error) {
				return metadataResponse(token), nil
			}))
			if got, err := source.Token(context.Background()); got != "" || !errors.Is(err, errIDToken) {
				t.Fatal("invalid metadata credential was accepted")
			}
		})
	}
	for _, status := range []int{302, 400, 401, 404, 429, 500, 503} {
		source := metadataSource(clock, roundTripFunc(func(*http.Request) (*http.Response, error) {
			r := metadataResponse(valid)
			r.StatusCode = status
			return r, nil
		}))
		if _, err := source.Token(context.Background()); !errors.Is(err, errIDToken) {
			t.Errorf("metadata status %d was accepted", status)
		}
	}
	for _, flavor := range []string{"", "Untrusted"} {
		source := metadataSource(clock, roundTripFunc(func(*http.Request) (*http.Response, error) {
			r := metadataResponse(valid)
			r.Header.Set("Metadata-Flavor", flavor)
			return r, nil
		}))
		if _, err := source.Token(context.Background()); !errors.Is(err, errIDToken) {
			t.Errorf("metadata flavor %q was accepted", flavor)
		}
	}
}

func TestMetadataRedirectIsNotFollowed(t *testing.T) {
	var calls atomic.Int32
	source := metadataSource(newTestClock(), roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls.Add(1)
		if r.URL.Host != "metadata.google.internal" {
			t.Error("metadata request followed an external redirect")
		}
		res := response(302, "")
		res.Header.Set("Location", "https://attacker.test/identity")
		return res, nil
	}))
	if _, err := source.Token(context.Background()); !errors.Is(err, errIDToken) || calls.Load() != 1 {
		t.Fatal("metadata redirect was not rejected")
	}
}

func TestMetadataRequestTimeout(t *testing.T) {
	clock := newTestClock()
	source := metadataSource(clock, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		<-r.Context().Done()
		return nil, r.Context().Err()
	}))
	source.client.Timeout = 20 * time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := source.Token(ctx); !errors.Is(err, errIDToken) {
		t.Fatalf("metadata timeout = %v", err)
	}
}

func TestMetadataRefreshSharedAcrossConcurrentRequests(t *testing.T) {
	clock := newTestClock()
	entered := []chan struct{}{make(chan struct{}), make(chan struct{})}
	release := []chan struct{}{make(chan struct{}), make(chan struct{})}
	var releaseOnce [2]sync.Once
	defer func() {
		for i := range release {
			releaseOnce[i].Do(func() { close(release[i]) })
		}
	}()
	var calls atomic.Int32
	source := metadataSource(clock, roundTripFunc(func(*http.Request) (*http.Response, error) {
		index := int(calls.Add(1)) - 1
		if index >= len(entered) {
			t.Error("concurrent requests triggered duplicate metadata refreshes")
			return nil, errIDToken
		}
		close(entered[index])
		<-release[index]
		return metadataResponse(fakeIDToken(backendURL, clock.Now().Add(time.Hour))), nil
	}))
	for phase := range 2 {
		var wg sync.WaitGroup
		for range 40 {
			wg.Go(func() {
				if token, err := source.Token(context.Background()); token == "" || err != nil {
					t.Error("shared credential unavailable")
				}
			})
		}
		awaitSignal(t, entered[phase])
		releaseOnce[phase].Do(func() { close(release[phase]) })
		wg.Wait()
		if calls.Load() != int32(phase+1) {
			t.Fatal("refresh was not shared")
		}
		clock.Advance(59 * time.Minute)
	}
}

func TestCanceledCallerDoesNotCancelSharedRefresh(t *testing.T) {
	clock := newTestClock()
	entered, release := make(chan struct{}), make(chan struct{})
	var releaseOnce sync.Once
	defer releaseOnce.Do(func() { close(release) })
	source := metadataSource(clock, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		close(entered)
		<-release
		if r.Context().Err() != nil {
			t.Error("one caller canceled the shared metadata request")
		}
		return metadataResponse(fakeIDToken(backendURL, clock.Now().Add(time.Hour))), nil
	}))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	first := make(chan error, 1)
	go func() { _, err := source.Token(ctx); first <- err }()
	awaitSignal(t, entered)
	cancel()
	select {
	case err := <-first:
		if !errors.Is(err, context.Canceled) {
			t.Fatal("caller cancellation was lost")
		}
	case <-time.After(time.Second):
		t.Fatal("canceled caller kept waiting for metadata")
	}
	releaseOnce.Do(func() { close(release) })
	if token, err := source.Token(context.Background()); token == "" || err != nil {
		t.Fatal("another caller could not use the shared refresh")
	}
}

func TestCanceledContextDoesNotRequestMetadata(t *testing.T) {
	source := metadataSource(newTestClock(), roundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Error("canceled request reached metadata")
		return nil, errIDToken
	}))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := source.Token(ctx); !errors.Is(err, context.Canceled) {
		t.Fatal("canceled caller was accepted")
	}
}

func TestIAMTokenAcrossTagsAndSpoofedHeaders(t *testing.T) {
	clock := newTestClock()
	token := fakeIDToken(backendURL, clock.Now().Add(time.Hour))
	var metadataCalls atomic.Int32
	source := metadataSource(clock, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		metadataCalls.Add(1)
		if r.URL.Query().Get("audience") != backendURL {
			t.Error("request changed token audience")
		}
		return metadataResponse(token), nil
	}))
	proxy, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: backendURL, IDTokenSource: source,
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.Header.Get("X-Serverless-Authorization") != "Bearer "+token ||
				r.Header.Get("Authorization") != "Bearer application-token" {
				t.Error("IAM credential or application authorization was lost")
			}
			if r.URL.RawQuery != "audience=https://evil.test" {
				t.Error("application query changed")
			}
			body, err := io.ReadAll(r.Body)
			if err != nil || string(body) != "request payload" {
				t.Error("authenticated request body changed")
			}
			return response(204, ""), nil
		}),
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, tag := range []string{"v1", "staging"} {
		r := httptest.NewRequest("POST", publicOrigin+"/revisions/"+tag+"/documents?audience=https://evil.test", strings.NewReader("request payload"))
		r.Header.Set("Authorization", "Bearer application-token")
		r.Header.Set("X-Serverless-Authorization", "Bearer forged-token")
		r.Header.Set("Connection", "X-Serverless-Authorization")
		w := httptest.NewRecorder()
		proxy.ServeHTTP(w, r)
		if w.Code != 204 || r.Header.Get("X-Serverless-Authorization") != "Bearer forged-token" {
			t.Fatal("credential injection failed or mutated the incoming request")
		}
	}
	if metadataCalls.Load() != 1 {
		t.Fatal("tags did not reuse a service-wide credential")
	}
}

type trackedBody struct {
	io.Reader
	closed bool
}

func (b *trackedBody) Close() error { b.closed = true; return nil }

func TestIAMFailureDoesNotForward(t *testing.T) {
	clock := newTestClock()
	source := metadataSource(clock, roundTripFunc(func(*http.Request) (*http.Response, error) {
		return response(503, "sensitive metadata contents"), nil
	}))
	proxy, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: backendURL, IDTokenSource: source,
		Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			t.Error("unauthenticated request reached backend")
			return response(200, ""), nil
		}),
	})
	if err != nil {
		t.Fatal(err)
	}
	body := &trackedBody{Reader: strings.NewReader("payload")}
	defer body.Close() // The HTTP server owns the incoming body.
	r := httptest.NewRequest("POST", publicOrigin+"/revisions/v1/", body)
	w := httptest.NewRecorder()
	proxy.ServeHTTP(w, r)
	if w.Code != 502 || w.Body.String() != "Upstream request failed.\n" ||
		w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("authentication failure did not fail closed with a generic response")
	}
}

func TestIAMTransportClosesBodyOnCredentialFailure(t *testing.T) {
	transport := &iamTransport{
		source: tokenSourceFunc(func(context.Context) (string, error) { return "", errIDToken }),
		base: roundTripFunc(func(*http.Request) (*http.Response, error) {
			t.Error("unauthenticated request reached backend")
			return nil, errIDToken
		}),
	}
	body := &trackedBody{Reader: strings.NewReader("payload")}
	r := httptest.NewRequest("POST", backendURL, body)
	if _, err := transport.RoundTrip(r); !errors.Is(err, errIDToken) || !body.closed {
		t.Fatal("failed RoundTrip did not close its owned request body")
	}
}

func TestUnsafeCustomIDTokensAreRejected(t *testing.T) {
	for _, token := range []string{"", "opaque-token", "a.b.c\r\nInjected: value", strings.Repeat("a", maxIDTokenBytes+1)} {
		proxy, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: backendURL,
			IDTokenSource: tokenSourceFunc(func(context.Context) (string, error) { return token, nil }),
			Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				t.Error("unsafe credential reached backend")
				return response(200, ""), nil
			}),
		})
		if err != nil {
			t.Fatal(err)
		}
		if got := serve(proxy, "GET", "/revisions/v1/", nil).Code; got != 502 {
			t.Fatal("unsafe token was accepted")
		}
	}
}

func TestBackendRejectionDoesNotReplayAuthenticatedRequest(t *testing.T) {
	for _, status := range []int{401, 403, 500, 503} {
		var tokenCalls, backendCalls int
		proxy, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: backendURL,
			IDTokenSource: tokenSourceFunc(func(context.Context) (string, error) { tokenCalls++; return testIDToken, nil }),
			Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				backendCalls++
				return response(status, "backend response"), nil
			}),
		})
		if err != nil {
			t.Fatal(err)
		}
		w := serve(proxy, "POST", "/revisions/v1/", strings.NewReader("payload"))
		if w.Code != status || tokenCalls != 1 || backendCalls != 1 {
			t.Fatal("backend rejection retried or changed an authenticated request")
		}
	}
}

func TestIAMRejectsInvalidAudienceConfiguration(t *testing.T) {
	for _, audience := range []string{"http://api.run.app", "https://evil.test", "https://api.run.app/path", "https://api.run.app?aud=evil"} {
		if _, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: backendURL, IAMAudience: audience}); err == nil {
			t.Errorf("accepted invalid audience %q", audience)
		}
	}
	if _, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: backendURL,
		IAMAudience: "https://api-123456789.asia-northeast1.run.app/"}); err != nil {
		t.Fatal("valid service alias was rejected")
	}
}
