# @pickstack/web

Frontend do **PICKStack** — plataforma SaaS modular de operações de estudo do PICK 2026 (LINUXtips).

Stack: **SvelteKit 2** (SSR + CSR, adapter-node), **TypeScript**, **Tailwind 3**, **Vite**, **lucide-svelte**, **pnpm**.

---

## Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Sobe o servidor de desenvolvimento Vite em `http://localhost:5173`. |
| `pnpm build` | Compila para produção em `build/` via adapter-node. |
| `pnpm preview` | Roda o build localmente (porta 4173). |
| `pnpm check` | Type-check + svelte-check no projeto inteiro. |
| `pnpm check:watch` | Mesmo que `check`, em modo watch. |
| `pnpm format` | Formata todos os arquivos com Prettier. |
| `pnpm lint` | Verifica formatação (Prettier `--check`). |
| `pnpm test` | Roda testes unitários via Vitest. |

---

## Variáveis de ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

| Variável | Default | Onde é usada |
| --- | --- | --- |
| `PUBLIC_API_URL` | `http://localhost:8080` | URL do `api-gateway` (lida no client e no SSR). |
| `BODY_SIZE_LIMIT` | `10485760` (10 MiB) | Limite do body no runtime do adapter-node. |
| `PORT` | `3000` | Porta do servidor Node em produção (não usada por `pnpm dev`). |

> Em SvelteKit, variáveis prefixadas com `PUBLIC_` são bundled no client. Se você mudar `PUBLIC_API_URL` após build, **precisa rebuildar** (ou usar a imagem com a build-arg correta).

---

## Estrutura

```
src/
├── app.html               # Document HTML (Inter, dark by default)
├── app.css                # Tailwind + paleta giropops-style
├── app.d.ts               # tipos globais
├── lib/
│   ├── api/               # clientes HTTP por módulo
│   │   ├── client.ts      # fetch wrapper, refresh-token, ApiError, safeRequest
│   │   ├── auth.ts
│   │   ├── focus.ts
│   │   ├── cards.ts
│   │   └── trilha.ts
│   ├── stores/
│   │   ├── auth.ts        # writable<{user, token, refreshToken}> + localStorage
│   │   └── ui.ts          # sidebar, theme (dark/light), toasts
│   ├── components/
│   │   ├── Button.svelte  Input.svelte  Modal.svelte  Empty.svelte
│   │   ├── Sidebar.svelte Topbar.svelte
│   │   ├── StatCard.svelte Heatmap.svelte
│   │   ├── PomodoroTimer.svelte
│   │   ├── CardReview.svelte
│   │   └── RoadmapGraph.svelte
│   └── utils/format.ts    # datas, durações, countdown
└── routes/
    ├── +layout.{ts,svelte}     # shell global + hidratação de auth
    ├── +page.svelte            # landing (redireciona logado p/ dashboard)
    ├── +error.svelte
    ├── login/+page.svelte
    ├── signup/+page.svelte
    └── (app)/                  # rotas autenticadas (sidebar + topbar)
        ├── +layout.{ts,svelte} # ssr:false; redireciona p/ /login se sem token
        ├── dashboard/          # stats + heatmap + últimas ações
        ├── focus/              # timer + sessões do dia
        ├── focus/history/      # heatmap 180d + tabela paginada
        ├── cards/              # lista de decks + modal "novo deck"
        ├── cards/[deck_id]/    # CRUD inline de cards
        ├── cards/[deck_id]/review/   # modo review (mostra resposta + 0-5)
        ├── trilha/             # lista de roadmaps
        ├── trilha/[id]/        # nodes hierárquicos com toggle todo/learning/done
        └── settings/           # perfil + trocar senha (placeholder) + logout
```

---

## Como funciona o auth

- **Tokens em `localStorage`:**
  - `pickstack.token` — JWT de acesso.
  - `pickstack.refresh_token` — refresh token (Redis no backend).
  - `pickstack.user` — cache do usuário (rehidratado via `/api/auth/me` no boot se faltar).
- **Refresh transparente:** o cliente em `src/lib/api/client.ts` intercepta `401`, chama `POST /api/auth/refresh` **uma única vez** (deduplicado por `refreshInFlight`), atualiza o token no store e re-tenta o request original. Se o refresh também falhar, o store é limpo e o browser é redirecionado para `/login`.
- **Guard de rotas:** o grupo `(app)/` tem `ssr = false` e checa `auth.token` no `onMount` do layout; sem token, `goto('/login')`.

---

## Degradação graciosa

> O frontend assume que **a API pode estar offline em dev**.

- Cada `+page.ts` usa `safeRequest()` em vez de `request()` — um helper que retorna `{ ok: false, unavailable: true }` em vez de lançar erro.
- Os templates renderizam um `<Empty variant="unavailable" />` quando o flag é `true`, em vez de quebrar a página inteira.
- Mutations (POST/PATCH/DELETE) ainda usam o cliente "normal" e mostram um toast de erro se falharem.

---

## Tema

- Dark por padrão (classe `.dark` no `<html>`).
- Toggle no Topbar (componente `Topbar.svelte`) alterna entre dark e light e persiste em `localStorage` (`pickstack.theme`).
- Paleta inspirada no giropops-status:
  - bg base `#0d1117`, surface `#161b22`, border `#30363d`
  - accent `#58a6ff`
  - success `#3fb950`, danger `#f85149`, warning `#d29922`

---

## Build Docker

Multi-stage (`Dockerfile` na raiz do pacote):

```bash
# Build com a URL do gateway que será usada em runtime (PUBLIC_* é bundled no client).
docker build \
  --build-arg PUBLIC_API_URL=https://api.pickstack.example.com \
  -t pickstack/web:dev \
  .

docker run --rm -p 3000:3000 pickstack/web:dev
```

A imagem final:
- baseia-se em `node:20-alpine`,
- roda como usuário não-root `app`,
- usa `tini` como PID 1,
- expõe a porta 3000,
- inclui `HEALTHCHECK` via `curl http://127.0.0.1:3000/`.

---

## Troubleshooting

### Porta 5173 já está em uso

```
Error: Port 5173 is already in use
```

Mate o processo (`lsof -i :5173 | awk 'NR>1 {print $2}' | xargs kill`) **ou** suba em outra porta:

```bash
pnpm dev --port 5174
```

### CORS bloqueando requests para o gateway

O `api-gateway` precisa permitir a origem do frontend. Em dev, o gateway deve incluir `http://localhost:5173` na lista de origens permitidas (`CORS_ORIGIN` no env do gateway). Verifique também se está respondendo o preflight (`OPTIONS`).

### Token expirado / redireciona pra /login em loop

1. Limpe o `localStorage`:
   ```js
   ['pickstack.token','pickstack.refresh_token','pickstack.user'].forEach(k => localStorage.removeItem(k));
   ```
2. Recarregue a página e refaça login.

Se o loop persistir, o `auth-svc` provavelmente está rejeitando o JWT (clock skew, chave pública desatualizada). Confira logs do gateway/auth-svc.

### Páginas mostram "indisponível"

O frontend degrada graciosamente quando a API responde com erro de rede ou 5xx. Suba o stack do backend:

```bash
cd ..
docker compose -f infra/docker-compose.dev.yml up -d
```

E recarregue a página (o load roda no `fetch` do SvelteKit — uma simple reload basta).

### `pnpm install` muito lento atrás de proxy

Use o store global do pnpm e cache do Docker (`--mount=type=cache,...` já está no Dockerfile). Em dev local, configure `~/.npmrc` com o seu mirror.

---

## O que **não** está aqui

- Testes E2E (Playwright) — TODO.
- SSR autenticado de fato (hoje o grupo `(app)/` é CSR-only). Para SSR auth completo seria preciso mover token para cookies HttpOnly + hook server-side.
- Service worker / offline-first.
- i18n — strings hardcoded em pt-BR.

Contribuições e issues são bem-vindas no repositório principal.
