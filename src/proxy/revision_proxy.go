// Package proxy routes public revision paths to a single Cloud Run service.
package proxy

import (
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// Options configures the routing core, independently of serving and IAM setup.
type Options struct {
	// BackendServiceURL is an untagged Cloud Run HTTPS origin verified against
	// actual tagged URLs. Its service identifier is opaque.
	BackendServiceURL string
	// PublicOrigin is the browser-facing HTTPS origin, even when Cloud Run
	// terminates TLS before the container receives the request.
	PublicOrigin string
	// IAMAudience is the backend's untagged service URL. It defaults to
	// BackendServiceURL; set it separately if tagged routing uses another alias.
	IAMAudience string
	// IDTokenSource defaults to the Cloud Run metadata identity endpoint.
	// A custom source is useful for tests or local development credentials.
	IDTokenSource IDTokenSource
	// Transport carries requests after IAM credentials have been attached.
	// A nil value uses http.DefaultTransport.
	Transport http.RoundTripper
}

var (
	dnsLabel    = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`)
	revisionTag = regexp.MustCompile(`^[a-z](?:[a-z0-9-]*[a-z0-9])?$`)
)

func parseOrigin(value string) (*url.URL, error) {
	u, err := url.Parse(value)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil ||
		strings.TrimSuffix(value, "/") != (&url.URL{Scheme: u.Scheme, Host: u.Host}).String() {
		return nil, errors.New("expected an HTTPS origin without credentials, a path, query or fragment")
	}
	return u, nil
}

func parseCloudRunOrigin(value string) (*url.URL, error) {
	backend, err := parseOrigin(value)
	if err != nil {
		return nil, err
	}
	labels := strings.Split(backend.Host, ".")
	if backend.Host != backend.Hostname() || len(backend.Host) > 253 ||
		len(labels) < 3 || !strings.HasSuffix(backend.Host, ".run.app") {
		return nil, errors.New("expected an untagged Cloud Run service origin")
	}
	for _, label := range labels {
		if len(label) > 63 || !dnsLabel.MatchString(label) {
			return nil, errors.New("invalid Cloud Run hostname label")
		}
	}
	return backend, nil
}

// New builds a routing handler authenticated as the calling Cloud Run service.
// The executable/container remains separate.
func New(options Options) (http.Handler, error) {
	backend, err := parseCloudRunOrigin(options.BackendServiceURL)
	if err != nil {
		return nil, err
	}
	public, err := parseOrigin(options.PublicOrigin)
	if err != nil {
		return nil, err
	}
	audience := backend.Scheme + "://" + backend.Host
	if options.IAMAudience != "" {
		origin, err := parseCloudRunOrigin(options.IAMAudience)
		if err != nil {
			return nil, err
		}
		audience = origin.Scheme + "://" + origin.Host
	}
	source := options.IDTokenSource
	if source == nil {
		source = newMetadataTokenSource(audience, newMetadataClient(), time.Now)
	}
	base := options.Transport
	if base == nil {
		base = http.DefaultTransport
	}
	transport := &iamTransport{source: source, base: base}
	firstLabel, _, _ := strings.Cut(backend.Host, ".")
	serviceHosts := []string{backend.Host}
	if audienceHost := strings.TrimPrefix(audience, "https://"); audienceHost != backend.Host {
		serviceHosts = append(serviceHosts, audienceHost)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.EqualFold(r.Host, public.Host) ||
			(r.URL.Host != "" && !strings.EqualFold(r.URL.Host, public.Host)) {
			writeError(w, "Host is not allowed.", http.StatusMisdirectedRequest)
			return
		}
		tail, ok := strings.CutPrefix(r.URL.EscapedPath(), "/revisions/")
		if !ok {
			writeError(w, "Not found.", http.StatusNotFound)
			return
		}
		tag, rest, hasSlash := strings.Cut(tail, "/")
		if !revisionTag.MatchString(tag) || len(tag)+3+len(firstLabel) > 63 ||
			len(tag)+3+len(backend.Host) > 253 {
			writeError(w, "Invalid revision tag.", http.StatusBadRequest)
			return
		}
		basePath := "/revisions/" + tag
		if !hasSlash {
			location := *public
			location.Path = basePath + "/"
			location.RawQuery, location.ForceQuery = r.URL.RawQuery, r.URL.ForceQuery
			w.Header().Set("Location", location.String())
			setCacheHeaders(w.Header(), "no-store")
			w.WriteHeader(http.StatusPermanentRedirect)
			return
		}
		rawPath := "/" + rest
		path, err := url.PathUnescape(rawPath)
		if err != nil || strings.Contains(path, `\`) || hasDotSegment(path) {
			writeError(w, "Invalid revision path.", http.StatusBadRequest)
			return
		}
		// Cloud Run documents TAG---SERVICE_IDENTIFIER.run.app and its
		// deterministic equivalent. Never reconstruct SERVICE_IDENTIFIER:
		// https://cloud.google.com/run/docs/triggering/https-request#service_url
		target := *backend
		target.Host = tag + "---" + backend.Host
		target.Path, target.RawPath = path, rawPath
		target.RawQuery, target.ForceQuery = r.URL.RawQuery, r.URL.ForceQuery
		reverse := &httputil.ReverseProxy{
			Transport:     transport,
			FlushInterval: -1, // Flush each write, including large responses and SSE.
			Rewrite: func(request *httputil.ProxyRequest) {
				request.Out.URL = &target
				request.Out.Host = target.Host
				request.Out.RequestURI = ""
				setForwardedHeaders(request.Out.Header, public, basePath)
			},
			ModifyResponse: func(response *http.Response) error {
				return rewriteResponse(response, r.Method, &target, public, basePath, serviceHosts)
			},
			ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
				writeError(w, "Upstream request failed.", http.StatusBadGateway)
			},
		}
		// ReverseProxy uses RoundTrip directly: redirects are returned to the
		// caller and cannot cause a second request to an attacker-selected host.
		reverse.ServeHTTP(w, r)
	}), nil
}

func hasDotSegment(path string) bool {
	for _, segment := range strings.Split(path, "/") {
		if segment == "." || segment == ".." {
			return true
		}
	}
	return false
}

func setForwardedHeaders(headers http.Header, public *url.URL, basePath string) {
	// ReverseProxy already removes hop-by-hop and Connection-nominated headers
	// before Rewrite. Replace every client-controlled forwarding/auth assertion.
	for name := range headers {
		lower := strings.ToLower(name)
		if lower == "host" || lower == "content-length" || lower == "forwarded" ||
			strings.HasPrefix(lower, "x-forwarded-") || strings.HasPrefix(lower, "x-goog-iap-") ||
			lower == "x-serverless-authorization" || lower == "x-original-url" || lower == "x-rewrite-url" {
			headers.Del(name)
		}
	}
	headers.Set("X-Forwarded-Prefix", basePath)
	headers.Set("X-Forwarded-Host", public.Host)
	headers.Set("X-Forwarded-Proto", public.Scheme)
}

func writeError(w http.ResponseWriter, message string, status int) {
	setCacheHeaders(w.Header(), "no-store")
	http.Error(w, message, status)
}
