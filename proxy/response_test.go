package proxy

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestPublicResponseLocations(t *testing.T) {
	for _, test := range []struct{ name, location, want string }{
		{"tagged origin", "https://v1---sadoku-opaque-id.a.run.app/documents", publicOrigin + "/revisions/v1/documents"},
		{"base origin", backendURL + "/documents", publicOrigin + "/revisions/v1/documents"},
		{"other tag", "https://staging---sadoku-opaque-id.a.run.app/", publicOrigin + "/revisions/staging/"},
		{"service alias", "https://v1---api-123.asia-northeast1.run.app/documents", publicOrigin + "/revisions/v1/documents"},
		{"base alias", "https://api-123.asia-northeast1.run.app/documents", publicOrigin + "/revisions/v1/documents"},
		{"root path", "/documents", publicOrigin + "/revisions/v1/documents"},
		{"relative", "edit", publicOrigin + "/revisions/v1/documents/edit"},
		{"parent", "../settings", publicOrigin + "/revisions/v1/settings"},
		{"root traversal", "../../../../settings", publicOrigin + "/revisions/v1/settings"},
		{"query", "?page=2", publicOrigin + "/revisions/v1/documents/1?page=2"},
		{"empty query", "?", publicOrigin + "/revisions/v1/documents/1?"},
		{"fragment", "#part", publicOrigin + "/revisions/v1/documents/1?old=yes#part"},
		{"root", "/", publicOrigin + "/revisions/v1/"},
		{"escaped URL", "/documents/a%2Fb?q=a+b&x=1&x=2#part%20one", publicOrigin + "/revisions/v1/documents/a%2Fb?q=a+b&x=1&x=2#part%20one"},
		{"already prefixed", "/revisions/v1/documents", publicOrigin + "/revisions/v1/documents"},
		{"prefixed tag root", "/revisions/v1", publicOrigin + "/revisions/v1"},
		{"explicit public tag", "/revisions/staging/documents", publicOrigin + "/revisions/staging/documents"},
		{"public origin", publicOrigin + "/documents", publicOrigin + "/revisions/v1/documents"},
		{"public prefix", publicOrigin + "/revisions/v1/documents", publicOrigin + "/revisions/v1/documents"},
		{"public default port", "https://preview.example.com:443/documents", publicOrigin + "/revisions/v1/documents"},
		{"public HTTP", "http://preview.example.com/documents", publicOrigin + "/revisions/v1/documents"},
		{"internal default port", "https://v1---sadoku-opaque-id.a.run.app:443/documents", publicOrigin + "/revisions/v1/documents"},
		{"internal HTTP", "http://v1---sadoku-opaque-id.a.run.app:80/documents", publicOrigin + "/revisions/v1/documents"},
		{"case and final dot", "https://V1---SADOKU-OPAQUE-ID.A.RUN.APP./documents", publicOrigin + "/revisions/v1/documents"},
		{"network reference", "//v1---sadoku-opaque-id.a.run.app/documents", publicOrigin + "/revisions/v1/documents"},
		{"OAuth provider", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fpreview.example.com", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fpreview.example.com"},
		{"external network reference", "//accounts.google.com/login", "//accounts.google.com/login"},
		{"external Cloud Run service", "https://other-service.run.app/login", "https://other-service.run.app/login"},
		{"external suffix", "https://v1---sadoku-opaque-id.a.run.app.evil.test/login", "https://v1---sadoku-opaque-id.a.run.app.evil.test/login"},
	} {
		t.Run(test.name, func(t *testing.T) {
			calls := 0
			proxy, err := New(Options{PublicOrigin: publicOrigin, BackendServiceURL: backendURL,
				IAMAudience: "https://api-123.asia-northeast1.run.app", IDTokenSource: tokenSourceFunc(fixedIDToken),
				Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
					calls++
					r := response(302, "redirect body")
					r.Header.Set("Location", test.location)
					return r, nil
				}),
			})
			if err != nil {
				t.Fatal(err)
			}
			w := serve(proxy, "GET", "/revisions/v1/documents/1?old=yes", nil)
			if w.Code != 302 || w.Header().Get("Location") != test.want || calls != 1 || w.Body.String() != "redirect body" {
				t.Fatalf("response = %d %q, calls %d", w.Code, w.Header().Get("Location"), calls)
			}
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("redirect must not be cached")
			}
		})
	}
}

func TestResourceLocationAndRedirectStatusPreserved(t *testing.T) {
	for _, status := range []int{200, 201, 301, 302, 303, 307, 308} {
		proxy := newProxy(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
			r := response(status, "unchanged response")
			r.Header.Set("Location", "/documents/2")
			r.Header.Set("Content-Location", backendURL+"/documents/2?format=raw")
			return r, nil
		}))
		w := serve(proxy, "POST", "/revisions/v1/documents", strings.NewReader("payload"))
		if w.Code != status || w.Body.String() != "unchanged response" ||
			w.Header().Get("Location") != publicOrigin+"/revisions/v1/documents/2" ||
			w.Header().Get("Content-Location") != publicOrigin+"/revisions/v1/documents/2?format=raw" {
			t.Fatalf("resource URL or HTTP status %d was changed incorrectly", status)
		}
	}
}

func TestMalformedResponseLocationsFailClosed(t *testing.T) {
	for _, location := range []string{
		"http://[", "javascript:alert(1)", "data:text/html,test", "https:opaque",
		"https:/v1---sadoku-opaque-id.a.run.app/documents", "https:///v1---sadoku-opaque-id.a.run.app/documents",
		"https://v1---sadoku-opaque-id。a.run.app/documents",
		"https://user:password@v1---sadoku-opaque-id.a.run.app/documents",
		`/\evil.test/path`, "/%5Cevil.test/path", "/%2e%2e/outside", "/foo%2F..%2Foutside",
		"https://v1---sadoku-opaque-id.a.run.app:8443/documents",
		"https://bad_tag---sadoku-opaque-id.a.run.app/documents",
		"https://" + strings.Repeat("a", 64) + "---sadoku-opaque-id.a.run.app/documents",
	} {
		closed := &trackedBody{Reader: strings.NewReader("private backend body")}
		proxy := newProxy(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
			r := response(302, "")
			r.Body = closed
			r.Header.Set("Location", location)
			return r, nil
		}))
		w := serve(proxy, "GET", "/revisions/v1/", nil)
		if w.Code != 502 || w.Body.String() != "Upstream request failed.\n" || w.Header().Get("Location") != "" || !closed.closed {
			t.Errorf("malformed URL was not safely rejected: %q", location)
		}
	}
	for _, name := range []string{"Location", "Content-Location"} {
		proxy := newProxy(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
			r := response(302, "private backend body")
			r.Header.Add(name, "/documents")
			r.Header.Add(name, backendURL+"/documents")
			return r, nil
		}))
		if got := serve(proxy, "GET", "/revisions/v1/", nil).Code; got != 502 {
			t.Errorf("duplicate %s was accepted", name)
		}
	}
}

func TestResponseCachePolicy(t *testing.T) {
	type cacheCase struct {
		method, path, control, contentType string
		status                             int
		extra                              http.Header
	}
	for _, test := range []struct {
		name   string
		change func(*cacheCase)
		want   string
	}{
		{"hashed JS", func(*cacheCase) {}, "private, max-age=86400, immutable"},
		{"private upstream", func(c *cacheCase) { c.control = "private, max-age=3600, immutable" }, "private, max-age=3600, immutable"},
		{"HEAD", func(c *cacheCase) { c.method = "HEAD" }, "private, max-age=86400, immutable"},
		{"partial asset", func(c *cacheCase) { c.status = 206 }, "private, max-age=86400, immutable"},
		{"hashed CSS", func(c *cacheCase) {
			c.path = "/revisions/v1/assets/client-Abcd1234.css"
			c.contentType = "text/css; charset=utf-8"
		}, "private, max-age=86400, immutable"},
		{"quoted age", func(c *cacheCase) { c.control = `public, max-age="3600", immutable` }, "private, max-age=3600, immutable"},
		{"age capped", func(c *cacheCase) { c.control = "public, max-age=4000000000, immutable" }, "private, max-age=31536000, immutable"},
		{"HTML", func(c *cacheCase) { c.path = "/revisions/v1/documents"; c.contentType = "text/html" }, "no-store"},
		{"API", func(c *cacheCase) { c.path = "/revisions/v1/__sadoku/data"; c.contentType = "application/json" }, "no-store"},
		{"SSE", func(c *cacheCase) { c.contentType = "text/event-stream" }, "no-store"},
		{"HTML with hashed name", func(c *cacheCase) { c.contentType = "text/html" }, "no-store"},
		{"fixed asset", func(c *cacheCase) { c.path = "/revisions/v1/assets/icon-512.png"; c.contentType = "image/png" }, "no-store"},
		{"manifest", func(c *cacheCase) {
			c.path = "/revisions/v1/assets/.vite/manifest.json"
			c.contentType = "application/json"
		}, "no-store"},
		{"outside assets", func(c *cacheCase) { c.path = "/revisions/v1/private/client-Abcd1234.js" }, "no-store"},
		{"encoded asset", func(c *cacheCase) { c.path = "/revisions/v1/assets/cl%69ent-Abcd1234.js" }, "no-store"},
		{"query", func(c *cacheCase) { c.path += "?user=alice" }, "no-store"},
		{"empty query", func(c *cacheCase) { c.path += "?" }, "no-store"},
		{"POST", func(c *cacheCase) { c.method = "POST" }, "no-store"},
		{"asset error", func(c *cacheCase) { c.status = 404 }, "no-store"},
		{"asset redirect", func(c *cacheCase) { c.status = 302; c.extra.Set("Location", "/documents") }, "no-store"},
		{"no policy", func(c *cacheCase) { c.control = "" }, "no-store"},
		{"no immutable", func(c *cacheCase) { c.control = "public, max-age=86400" }, "no-store"},
		{"no max age", func(c *cacheCase) { c.control = "public, immutable" }, "no-store"},
		{"no-store wins", func(c *cacheCase) { c.control += ", no-store" }, "no-store"},
		{"no-cache wins", func(c *cacheCase) { c.control += ", no-cache" }, "no-store"},
		{"zero age", func(c *cacheCase) { c.control = "public, max-age=0, immutable" }, "no-store"},
		{"negative age", func(c *cacheCase) { c.control = "public, max-age=-1, immutable" }, "no-store"},
		{"invalid age", func(c *cacheCase) { c.control = "public, max-age=oops, immutable" }, "no-store"},
		{"duplicate age", func(c *cacheCase) { c.control += ", max-age=3600" }, "no-store"},
		{"invalid immutable", func(c *cacheCase) { c.control = "public, max-age=86400, immutable=1" }, "no-store"},
		{"missing type", func(c *cacheCase) { c.contentType = "" }, "no-store"},
		{"vary wildcard", func(c *cacheCase) { c.extra.Set("Vary", "*") }, "no-store"},
		{"cookie", func(c *cacheCase) { c.extra.Set("Set-Cookie", "session=test; Path=/; Secure") }, "no-store"},
		{"pragma", func(c *cacheCase) { c.extra.Set("Pragma", "no-cache") }, "no-store"},
	} {
		t.Run(test.name, func(t *testing.T) {
			c := cacheCase{method: "GET", path: "/revisions/v1/assets/client-Abcd1234.js", status: 200,
				control: "public, max-age=86400, immutable", contentType: "text/javascript", extra: make(http.Header)}
			test.change(&c)
			proxy := newProxy(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
				r := response(c.status, "unchanged payload")
				r.Header = c.extra.Clone()
				r.Header.Set("Cache-Control", c.control)
				r.Header.Set("Content-Type", c.contentType)
				r.Header.Set("CDN-Cache-Control", "public, max-age=3600")
				r.Header.Set("Cloudflare-CDN-Cache-Control", "public, max-age=3600")
				r.Header.Set("Surrogate-Control", "max-age=3600")
				r.Header.Set("Expires", "Wed, 01 Jan 2031 00:00:00 GMT")
				r.Header.Set("Age", "300")
				r.Header.Set("ETag", `"asset-version"`)
				return r, nil
			}))
			w := serve(proxy, c.method, c.path, nil)
			if w.Code != c.status || w.Header().Get("Cache-Control") != test.want {
				t.Fatalf("response = %d, cache = %q, want %q", w.Code, w.Header().Get("Cache-Control"), test.want)
			}
			for _, name := range []string{"CDN-Cache-Control", "Cloudflare-CDN-Cache-Control", "Surrogate-Control"} {
				if w.Header().Get(name) != "no-store" {
					t.Errorf("shared cache override survived: %s", name)
				}
			}
			for _, name := range []string{"Age", "Expires", "Pragma"} {
				if w.Header().Get(name) != "" {
					t.Errorf("obsolete cache metadata survived: %s", name)
				}
			}
			if w.Header().Get("Set-Cookie") != c.extra.Get("Set-Cookie") || w.Header().Get("ETag") != `"asset-version"` {
				t.Error("unrelated response headers changed")
			}
		})
	}
}

func TestResponsePoliciesStayIsolatedAcrossConcurrentTags(t *testing.T) {
	proxy := newProxy(t, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		prefix := r.Header.Get("X-Forwarded-Prefix")
		res := response(302, prefix)
		res.Header.Set("Location", "/documents")
		res.Header.Set("Cache-Control", "public, max-age=3600")
		return res, nil
	}))
	var wg sync.WaitGroup
	for range 20 {
		for _, tag := range []string{"v1", "staging"} {
			wg.Go(func() {
				w := serve(proxy, "GET", "/revisions/"+tag+"/", nil)
				if w.Code != 302 || w.Body.String() != "/revisions/"+tag ||
					w.Header().Get("Location") != publicOrigin+"/revisions/"+tag+"/documents" ||
					w.Header().Get("Cache-Control") != "no-store" {
					t.Error("response policy crossed revision boundaries")
				}
			})
		}
	}
	wg.Wait()
}

func TestLocalProxyResponsesPreventSharedCaching(t *testing.T) {
	proxy := newProxy(t, nil)
	for _, path := range []string{"/", "/revisions/INVALID/", "/revisions/v1"} {
		w := httptest.NewRecorder()
		proxy.ServeHTTP(w, httptest.NewRequest("GET", publicOrigin+path, nil))
		if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("CDN-Cache-Control") != "no-store" {
			t.Error("local error or canonical redirect permits caching")
		}
	}
}
