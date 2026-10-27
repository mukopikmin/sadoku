package cli

import (
	"reflect"
	"testing"
)

func TestCustomBrowserCommand(t *testing.T) {
	for _, test := range []struct {
		custom, command string
		args            []string
	}{{`"/path with spaces/browser" --new-window %s`, "/path with spaces/browser", []string{"--new-window", "http://127.0.0.1:3334"}}, {`browser --private`, "browser", []string{"--private", "http://127.0.0.1:3334"}}} {
		command, args := browserCommand("http://127.0.0.1:3334", "linux", test.custom)
		if command != test.command || !reflect.DeepEqual(args, test.args) {
			t.Fatal(command, args)
		}
	}
}
