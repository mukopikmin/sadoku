package usecase

import "strings"

// UnescapeJSONSeparators preserves JSON.stringify output without changing literal
// backslash sequences in user strings.
func UnescapeJSONSeparators(value string) string {
	s := value
	var result strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			if strings.HasPrefix(s[i:], `\u2028`) {
				result.WriteRune('\u2028')
				i += 5
				continue
			}
			if strings.HasPrefix(s[i:], `\u2029`) {
				result.WriteRune('\u2029')
				i += 5
				continue
			}
			result.WriteString(s[i : i+2])
			i++
			continue
		}
		result.WriteByte(s[i])
	}
	return result.String()
}
