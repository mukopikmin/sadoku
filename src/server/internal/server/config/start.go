package config

import (
	"fmt"
	"maps"
	"slices"
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

// ReadForStart validates the config file before the CLI applies overrides.
func ReadForStart() (Settings, StartDefaults, error) {
	path := Path()
	settings, values, err := readConfig(path, true)
	if err != nil {
		return settings, StartDefaults{}, err
	}
	defaults, err := parseStartDefaults(values)
	if err != nil {
		return settings, defaults, fmt.Errorf("%s: %w", path, err)
	}
	return settings, defaults, nil
}

func parseStartDefaults(values map[string]any) (StartDefaults, error) {
	defaults := StartDefaults{Host: DefaultStartHost, Port: DefaultStartPort}
	value, exists := values["start"]
	if !exists {
		return defaults, nil
	}
	start, ok := value.(map[string]any)
	if !ok {
		return defaults, fmt.Errorf("start must be a table")
	}
	booleans := map[string]*bool{
		"no_open":                &defaults.NoOpen,
		"keep_alive":             &defaults.KeepAlive,
		"no_sync":                &defaults.NoSync,
		"trust_forwarded_prefix": &defaults.TrustForwardedPrefix,
	}
	for _, key := range slices.Sorted(maps.Keys(start)) {
		value := start[key]
		switch key {
		case "host":
			host, ok := value.(string)
			if !ok || strings.TrimSpace(host) == "" {
				return defaults, fmt.Errorf("start.host must be a non-empty string")
			}
			defaults.Host = host
		case "port":
			port, ok := value.(int64)
			if !ok || port < 1 || port > 65535 {
				return defaults, fmt.Errorf("start.port must be an integer between 1 and 65535")
			}
			defaults.Port = int(port)
		default:
			target, ok := booleans[key]
			if !ok {
				return defaults, fmt.Errorf("unknown setting %q", "start."+key)
			}
			enabled, ok := value.(bool)
			if !ok {
				return defaults, fmt.Errorf("start.%s must be a boolean", key)
			}
			*target = enabled
		}
	}
	return defaults, nil
}
