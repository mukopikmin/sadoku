FROM golang:1.26.9-bookworm AS builder
WORKDIR /src
COPY go.mod ./
COPY *.go ./
COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOTOOLCHAIN=local GOPROXY=off \
    go build -trimpath -ldflags="-s -w" -o /revision-proxy ./cmd/revision-proxy

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /revision-proxy /revision-proxy
ENV LISTEN_HOST=0.0.0.0 PORT=8080
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/revision-proxy"]
