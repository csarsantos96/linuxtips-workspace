# syntax=docker/dockerfile:1.7

FROM denoland/deno:2.1.4 AS builder

WORKDIR /app

ENV DENO_DIR=/deno-dir

COPY deno.json ./
COPY src ./src

RUN --mount=type=cache,target=/deno-dir \
    deno cache src/main.ts && \
    deno compile \
      --allow-env \
      --allow-net \
      --allow-read \
      --include src/db/migrations \
      --output /focus-svc \
      src/main.ts

FROM gcr.io/distroless/cc-debian12:nonroot AS runtime

WORKDIR /app

ENV PORT=8082

EXPOSE 8082

COPY --from=builder \
  --chown=nonroot:nonroot \
  /focus-svc \
  /app/focus-svc

USER nonroot:nonroot

ENTRYPOINT ["/app/focus-svc"]
