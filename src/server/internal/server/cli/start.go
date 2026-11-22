package cli

import "github.com/mukopikmin/sadoku/internal/server/config"

func startOptions(o Options, defaults config.StartDefaults) (StartOptions, error) {
	options := StartOptions{
		Source:               o.Words[1],
		Host:                 defaults.Host,
		Port:                 defaults.Port,
		Open:                 !defaults.NoOpen,
		KeepAlive:            defaults.KeepAlive,
		NoSync:               defaults.NoSync,
		TrustForwardedPrefix: defaults.TrustForwardedPrefix,
	}
	if host := o.Values["host"]; host != "" {
		options.Host = host
	}
	if port, exists := o.Values["port"]; exists {
		// validate has already checked the port's syntax and range.
		n, _ := cliInteger(port)
		options.Port = int(n)
	}
	if noOpen, exists := o.Flags["no-open"]; exists {
		options.Open = !noOpen
	}
	if keepAlive, exists := o.Flags["keep-alive"]; exists {
		options.KeepAlive = keepAlive
	}
	if noSync, exists := o.Flags["no-sync"]; exists {
		options.NoSync = noSync
	}
	if trust, exists := o.Flags["trust-forwarded-prefix"]; exists {
		options.TrustForwardedPrefix = trust
	}
	if depth, exists := o.Values["max-depth"]; exists {
		value, err := number(depth, "max-depth", 0)
		if err != nil {
			return options, err
		}
		limit := int(value)
		options.MaxDepth = &limit
	}
	if files, exists := o.Values["max-files"]; exists {
		value, err := number(files, "max-files", 1)
		if err != nil {
			return options, err
		}
		limit := int(value)
		options.MaxFiles = &limit
	}
	return options, nil
}
