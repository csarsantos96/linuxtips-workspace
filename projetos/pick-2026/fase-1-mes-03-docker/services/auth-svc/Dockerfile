# auth-svc — imagem multi-stage.
# Stage builder: baixa dependências e compila um binário standalone via `deno compile`.
# Stage runtime: distroless cc (precisa de glibc + libgcc para o binário Deno).

# ---- builder ----
FROM denoland/deno:2.1.4 AS builder
WORKDIR /app

# Cache de deps primeiro (melhor uso de layer cache do Docker).
COPY deno.json ./
COPY src ./src
RUN deno cache src/main.ts

# Compila binário standalone.
RUN deno compile \
    --allow-net --allow-env --allow-read \
    --output /app/auth-svc \
    src/main.ts

# ---- runtime ----
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app
COPY --from=builder /app/auth-svc /app/auth-svc
# Migrations precisam ser embarcadas pois o binário lê do FS em runtime.
COPY --from=builder /app/src/db/migrations /app/src/db/migrations

ENV PORT=8081
EXPOSE 8081

USER nonroot:nonroot

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/app/auth-svc", "--healthcheck"] || exit 1

ENTRYPOINT ["/app/auth-svc"]
