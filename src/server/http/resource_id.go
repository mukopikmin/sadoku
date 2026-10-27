package http

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	u "github.com/mukopikmin/sadoku/src/server/usecase"
)

var restDecimal = regexp.MustCompile(`^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$`)
var restRadix = regexp.MustCompile(`^(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+)$`)

// Child resource routes used JavaScript Number(), while document routes also
// require the canonical decimal spelling before calling this parser.
func parseRESTResourceID(value string) (int64, error) {
	value = u.TrimSpace(value)
	if restRadix.MatchString(value) {
		n, err := strconv.ParseUint(value, 0, 64)
		if err == nil && n < 1<<63 {
			return int64(n), nil
		}
		return 0, fmt.Errorf("invalid resource ID")
	}
	if !restDecimal.MatchString(value) {
		return 0, fmt.Errorf("invalid resource ID")
	}
	n, err := strconv.ParseFloat(strings.TrimPrefix(value, "+"), 64)
	if err != nil || math.IsNaN(n) || math.IsInf(n, 0) || math.Trunc(n) != n || n >= math.Exp2(63) || n < 0 {
		return 0, fmt.Errorf("invalid resource ID")
	}
	return int64(n), nil
}
