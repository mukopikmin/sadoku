package proxy

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	identityEndpoint = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
	metadataTimeout  = 5 * time.Second
	refreshBefore    = time.Minute
	metadataBackoff  = time.Second
	maxIDTokenBytes  = 16 * 1024
)

var (
	errIDToken = errors.New("Cloud Run ID token unavailable")
	compactJWT = regexp.MustCompile(`^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$`)
)

// IDTokenSource supplies credentials for the configured backend service.
// Implementations must support concurrent calls and honor caller cancellation.
type IDTokenSource interface {
	Token(context.Context) (string, error)
}

type iamTransport struct {
	source IDTokenSource
	base   http.RoundTripper
}

func (t *iamTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	token, err := t.source.Token(request.Context())
	if err != nil || len(token) > maxIDTokenBytes || !compactJWT.MatchString(token) {
		// RoundTripper owns the request body, including failures before forwarding.
		if request.Body != nil {
			request.Body.Close()
		}
		return nil, errIDToken
	}
	forwarded := request.Clone(request.Context())
	forwarded.Header.Set("X-Serverless-Authorization", "Bearer "+token)
	// Keep the application's Authorization header intact. RoundTrip does not
	// follow redirects or replay requests when the backend rejects a credential.
	return t.base.RoundTrip(forwarded)
}

type tokenRefresh struct {
	done  chan struct{}
	token string
	err   error
}

type metadataTokenSource struct {
	audience string
	client   *http.Client
	now      func() time.Time

	mu         sync.Mutex
	token      string
	expires    time.Time
	retryAfter time.Time
	refresh    *tokenRefresh
}

func newMetadataClient() *http.Client {
	return &http.Client{
		Timeout: metadataTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
		// Metadata credentials must stay on the Cloud Run metadata connection,
		// independently of application HTTP proxy environment variables.
		Transport: &http.Transport{
			DialContext:           (&net.Dialer{Timeout: 2 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
			ResponseHeaderTimeout: 3 * time.Second,
			IdleConnTimeout:       time.Minute,
			MaxIdleConns:          1,
			MaxIdleConnsPerHost:   1,
		},
	}
}

func newMetadataTokenSource(audience string, client *http.Client, now func() time.Time) *metadataTokenSource {
	return &metadataTokenSource{audience: audience, client: client, now: now}
}

func (s *metadataTokenSource) Token(ctx context.Context) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	s.mu.Lock()
	now := s.now()
	if s.token != "" && now.Add(refreshBefore).Before(s.expires) {
		token := s.token
		s.mu.Unlock()
		return token, nil
	}
	if now.Before(s.retryAfter) {
		s.mu.Unlock()
		return "", errIDToken
	}
	flight := s.refresh
	if flight == nil {
		flight = &tokenRefresh{done: make(chan struct{})}
		s.refresh = flight
		// One bounded refresh is shared across callers. A browser disconnect
		// cancels its wait without canceling credentials for other requests.
		go s.load(flight)
	}
	s.mu.Unlock()
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-flight.done:
		if err := ctx.Err(); err != nil {
			return "", err
		}
		return flight.token, flight.err
	}
}

func (s *metadataTokenSource) load(flight *tokenRefresh) {
	token, expires, err := s.fetch()
	s.mu.Lock()
	defer s.mu.Unlock()
	if err == nil {
		s.token, s.expires = token, expires
		s.retryAfter = time.Time{}
	} else {
		// Do not fall back to a credential inside its refresh window. Briefly
		// share failures as well, so an outage does not trigger a request storm.
		s.retryAfter = s.now().Add(metadataBackoff)
	}
	flight.token, flight.err = token, err
	s.refresh = nil
	close(flight.done)
}

func (s *metadataTokenSource) fetch() (string, time.Time, error) {
	u, _ := url.Parse(identityEndpoint)
	u.RawQuery = url.Values{"audience": {s.audience}, "format": {"full"}}.Encode()
	ctx, cancel := context.WithTimeout(context.Background(), metadataTimeout)
	defer cancel()
	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	request.Header.Set("Metadata-Flavor", "Google")
	response, err := s.client.Do(request)
	if err != nil {
		return "", time.Time{}, errIDToken
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK || response.Header.Get("Metadata-Flavor") != "Google" {
		return "", time.Time{}, errIDToken
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxIDTokenBytes+1))
	if err != nil || len(body) > maxIDTokenBytes {
		return "", time.Time{}, errIDToken
	}
	token := strings.TrimSpace(string(body))
	if !compactJWT.MatchString(token) {
		return "", time.Time{}, errIDToken
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.Split(token, ".")[1])
	var claims struct {
		Audience string `json:"aud"`
		Expires  int64  `json:"exp"`
	}
	if err != nil || json.Unmarshal(payload, &claims) != nil || claims.Audience != s.audience {
		return "", time.Time{}, errIDToken
	}
	expires := time.Unix(claims.Expires, 0)
	if !s.now().Add(refreshBefore).Before(expires) {
		return "", time.Time{}, errIDToken
	}
	// Claims from the fixed metadata endpoint are decoded for caching only.
	// The receiving Cloud Run service verifies the token's signature and IAM.
	return token, expires, nil
}
