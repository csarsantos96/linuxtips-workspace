# trilha-svc — multi-stage Dockerfile

FROM denoland/deno:2.1.4 AS builder
WORKDIR /app
COPY deno.json deno.json
COPY src ./src
RUN deno cache src/main.ts

FROM denoland/deno:2.1.4 AS runtime
WORKDIR /app
ENV PORT=8084
COPY --from=builder /deno-dir /deno-dir
COPY --from=builder /app /app
EXPOSE 8084
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD deno eval "fetch('http://localhost:'+(Deno.env.get('PORT')||'8084')+'/healthz').then(r=>Deno.exit(r.ok?0:1)).catch(()=>Deno.exit(1))"
USER deno
CMD ["task", "start"]
