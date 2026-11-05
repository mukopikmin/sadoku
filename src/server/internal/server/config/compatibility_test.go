package config

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestLegacyConfigurationTranscripts(t *testing.T) {
	var fixture struct {
		Reference string
		Cases     []struct {
			Content  string
			Expected struct {
				Error    string
				Settings Settings
			}
		}
	}
	data, err := os.ReadFile("testdata/legacy_config.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.Reference != "368b47eb1ae18a84d428ce4367d25cb815584968" {
		t.Fatal("unknown configuration reference")
	}
	t.Setenv("APPDATA", "")
	for _, test := range fixture.Cases {
		t.Run(test.Content, func(t *testing.T) {
			t.Setenv("XDG_CONFIG_HOME", t.TempDir())
			if err := AtomicWrite(Path(), []byte(test.Content), 0600); err != nil {
				t.Fatal(err)
			}
			actual, _, err := Read()
			if test.Expected.Error != "" {
				if err == nil || err.Error() != test.Expected.Error {
					t.Fatalf("error: %v; want %q", err, test.Expected.Error)
				}
			} else if err != nil || !reflect.DeepEqual(actual, test.Expected.Settings) {
				t.Fatalf("settings: %+v %v; want %+v", actual, err, test.Expected.Settings)
			}
		})
	}
}
