package config

import (
	"fmt"
	"strings"
)

const (
	DefaultStartHost = "127.0.0.1"
	DefaultStartPort = 3334
)

type StartDefaults struct {
	Host                                            string
	Port                                            int
	NoOpen, KeepAlive, NoSync, TrustForwardedPrefix bool
}

// ParseStartDefaults validates the start table only for the start command.
func ParseStartDefaults(values map[string]any) (StartDefaults, error) {
	defaults := StartDefaults{Host: DefaultStartHost, Port: DefaultStartPort}
	value, exists := values["start"]
	if !exists {
		return defaults, nil
	}
	start, ok := value.(map[string]any)
	if !ok {
		return defaults, fmt.Errorf("%s: start must be a table", Path())
	}
	if value, exists := start["host"]; exists {
		host, ok := value.(string)
		if !ok || strings.TrimSpace(host) == "" {
			return defaults, fmt.Errorf("%s: start.host must be a non-empty string", Path())
		}
		defaults.Host = host
	}
	if value, exists := start["port"]; exists {
		port, ok := value.(int64)
		if !ok || port < 1 || port > 65535 {
			return defaults, fmt.Errorf("%s: start.port must be an integer between 1 and 65535", Path())
		}
		defaults.Port = int(port)
	}
	for _, field := range []struct {
		key    string
		target *bool
	}{
		{"no_open", &defaults.NoOpen},
		{"keep_alive", &defaults.KeepAlive},
		{"no_sync", &defaults.NoSync},
		{"trust_forwarded_prefix", &defaults.TrustForwardedPrefix},
	} {
		if value, exists := start[field.key]; exists {
			enabled, ok := value.(bool)
			if !ok {
				return defaults, fmt.Errorf("%s: start.%s must be a boolean", Path(), field.key)
			}
			*field.target = enabled
		}
	}
	return defaults, nil
}
