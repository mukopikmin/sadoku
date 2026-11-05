package session

// SubscribeInvalidation observes remote session refreshes without polling.
// A buffered signal coalesces refreshes while a slow client is writing an event.
func (s *Session) SubscribeInvalidation() (<-chan struct{}, func()) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if s.invalidations == nil {
		s.invalidations = map[chan struct{}]struct{}{}
	}
	updates := make(chan struct{}, 1)
	s.invalidations[updates] = struct{}{}
	return updates, func() {
		s.Mu.Lock()
		defer s.Mu.Unlock()
		delete(s.invalidations, updates)
	}
}

func (s *Session) Invalidate() {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	for updates := range s.invalidations {
		select {
		case updates <- struct{}{}:
		default:
		}
	}
}
