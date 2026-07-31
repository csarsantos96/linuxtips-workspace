# api-gateway — imagem multi-stage.

# ---- builder ----
FROM denoland/deno:2.1.4 AS builder
WORKDIR /app

COPY deno.json ./
COPY src ./src
RUN deno cache src/main.ts

RUN deno compile \
    --allow-net --allow-env --allow-read \
    --output /app/api-gateway \
    src/main.ts

# ---- runtime ----
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app
COPY --from=builder /app/api-gateway /app/api-gateway

ENV PORT=8080
EXPOSE 8080

USER nonroot:nonroot

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/app/api-gateway", "--healthcheck"] || exit 1

ENTRYPOINT ["/app/api-gateway"]
