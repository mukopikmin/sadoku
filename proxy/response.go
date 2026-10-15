package proxy

import (
	"errors"
	"mime"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var (
	errResponseURL     = errors.New("invalid upstream response URL")
	fingerprintedAsset = regexp.MustCompile(`^/assets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico|wasm)$`)
)

func rewriteResponse(response *http.Response, method string, target, public *url.URL, basePath string, serviceHosts []string) error {
	policy := "no-store"
	if age := immutableAssetAge(response, method, target); age > 0 {
		policy = "private, max-age=" + strconv.FormatUint(age, 10) + ", immutable"
	}
	setCacheHeaders(response.Header, policy)
	for _, name := range []string{"Location", "Content-Location"} {
		values := response.Header.Values(name)
		if len(values) > 1 {
			return errResponseURL
		}
		if len(values) == 0 || values[0] == "" {
			continue
		}
		location, err := publicResponseURL(values[0], target, public, basePath, serviceHosts)
		if err != nil {
			return err
		}
		response.Header.Set(name, location)
	}
	return nil
}

func publicResponseURL(raw string, target, public *url.URL, basePath string, serviceHosts []string) (string, error) {
	reference, err := url.Parse(raw)
	if err != nil || reference.User != nil || reference.Opaque != "" {
		return "", errResponseURL
	}
	resolved := target.ResolveReference(reference)
	if (resolved.Scheme != "http" && resolved.Scheme != "https") || resolved.Hostname() == "" ||
		strings.Contains(resolved.Path, `\`) || hasDotSegment(resolved.Path) {
		return "", errResponseURL
	}
	// Browsers apply IDNA mappings that net/url does not. Require ASCII host
	// spelling (punycode is accepted) so an internal host cannot evade matching.
	for _, character := range resolved.Hostname() {
		if character > 127 {
			return "", errResponseURL
		}
	}
	mount := ""
	host := strings.TrimSuffix(strings.ToLower(resolved.Hostname()), ".")
	for _, serviceHost := range serviceHosts {
		if host == serviceHost {
			mount = basePath
			break
		}
		if tag, ok := strings.CutSuffix(host, "---"+serviceHost); ok {
			firstLabel, _, _ := strings.Cut(serviceHost, ".")
			if !revisionTag.MatchString(tag) || len(tag)+3+len(firstLabel) > 63 || len(host) > 253 {
				return "", errResponseURL
			}
			mount = "/revisions/" + tag
			break
		}
	}
	if mount != "" && resolved.Port() != "" &&
		!(resolved.Scheme == "https" && resolved.Port() == "443") &&
		!(resolved.Scheme == "http" && resolved.Port() == "80") {
		return "", errResponseURL
	}
	if mount == "" && host == strings.TrimSuffix(strings.ToLower(public.Hostname()), ".") &&
		originPort(resolved) == originPort(public) {
		mount = basePath
	}
	if mount == "" {
		return raw, nil // External destinations, including OAuth providers, stay intact.
	}
	result := *resolved
	result.Scheme, result.Host = public.Scheme, public.Host
	if !hasPublicRevisionPath(result.EscapedPath()) {
		path, rawPath := result.Path, result.EscapedPath()
		if path == "" {
			path, rawPath = "/", "/"
		}
		result.Path, result.RawPath = mount+path, mount+rawPath
	}
	return result.String(), nil
}

func originPort(origin *url.URL) string {
	port := origin.Port()
	if origin.Scheme == "https" && port == "443" || origin.Scheme == "http" && port == "80" {
		return ""
	}
	return port
}

func hasPublicRevisionPath(path string) bool {
	tail, ok := strings.CutPrefix(path, "/revisions/")
	if !ok {
		return false
	}
	tag, _, _ := strings.Cut(tail, "/")
	return len(tag) <= 63 && revisionTag.MatchString(tag)
}

func setCacheHeaders(headers http.Header, policy string) {
	headers.Set("Cache-Control", policy)
	for _, name := range []string{"CDN-Cache-Control", "Cloudflare-CDN-Cache-Control", "Surrogate-Control"} {
		headers.Set(name, "no-store")
	}
	for _, name := range []string{"Age", "Expires", "Pragma"} {
		headers.Del(name)
	}
}

func immutableAssetAge(response *http.Response, method string, target *url.URL) uint64 {
	if (method != "GET" && method != "HEAD") ||
		(response.StatusCode != 200 && response.StatusCode != 206 && response.StatusCode != 304) ||
		target.RawQuery != "" || target.ForceQuery || !fingerprintedAsset.MatchString(target.EscapedPath()) ||
		response.Header.Get("Location") != "" || len(response.Header.Values("Set-Cookie")) != 0 ||
		response.Header.Get("Pragma") != "" {
		return 0
	}
	for _, vary := range strings.Split(strings.Join(response.Header.Values("Vary"), ","), ",") {
		if strings.TrimSpace(vary) == "*" {
			return 0
		}
	}
	mediaType, _, err := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if err != nil || !(strings.HasPrefix(mediaType, "image/") || strings.HasPrefix(mediaType, "font/") ||
		mediaType == "text/javascript" || mediaType == "application/javascript" || mediaType == "text/css" || mediaType == "application/wasm") {
		return 0
	}
	var immutable, hasAge bool
	var age uint64
	for _, part := range strings.Split(strings.Join(response.Header.Values("Cache-Control"), ","), ",") {
		name, value, hasValue := strings.Cut(strings.TrimSpace(part), "=")
		switch strings.ToLower(strings.TrimSpace(name)) {
		case "no-store", "no-cache":
			return 0
		case "immutable":
			if hasValue {
				return 0
			}
			immutable = true
		case "max-age":
			if hasAge || !hasValue {
				return 0
			}
			hasAge = true
			value = strings.TrimSpace(value)
			if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
				value = value[1 : len(value)-1]
			}
			age, err = strconv.ParseUint(value, 10, 32)
			if err != nil {
				return 0
			}
		}
	}
	if !immutable || !hasAge {
		return 0
	}
	return min(age, 31536000)
}
