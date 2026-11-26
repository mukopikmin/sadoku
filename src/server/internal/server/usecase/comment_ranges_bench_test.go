package usecase

import (
	"fmt"
	"strings"
	"testing"
)

func BenchmarkResolveUnchangedComments(b *testing.B) {
	markdown := strings.Repeat("reviewed line\n", 2000)
	for _, count := range []int{1, 100} {
		b.Run(fmt.Sprint(count), func(b *testing.B) {
			doc := Comments{SourceSnapshot: &markdown, Comments: make([]Comment, count)}
			for i := range doc.Comments {
				doc.Comments[i] = Comment{StartLine: i + 1, EndLine: i + 1}
			}
			b.ReportAllocs()
			for b.Loop() {
				ResolveComments(doc, markdown)
			}
		})
	}
}
