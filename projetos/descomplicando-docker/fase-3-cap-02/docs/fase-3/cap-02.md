# Capítulo 2: Imagem profissional (multi-stage, usuário sem privilégio, HEALTHCHECK, labels)

> **Referência:** treinamento _Descomplicando Docker_, aulas sobre Dockerfile avançado: multi-stage build, `USER`, `HEALTHCHECK`, `LABEL`, e boas práticas para imagens enxutas.
> **Pré-requisitos:** Capítulo 1 concluído. Você tem um `Dockerfile` que constrói, um `.dockerignore` e sabe subir app + Redis numa rede sua.

## Objetivo da semana

O `Dockerfile` do cap 1 funciona, mas é uma imagem de laboratório: roda como **root**, carrega o `pip` e o cache de build na imagem final, ninguém sabe de onde ela veio e o Docker não tem como saber se a aplicação está viva ou só ocupando memória. Em produção, cada um desses pontos é um problema real: root dentro do container é root no kernel do host se algo escapar; imagem gorda é deploy lento e superfície de ataque; sem `HEALTHCHECK`, um orquestrador continua mandando tráfego para um processo travado.

Esta semana você transforma a imagem em algo que você colocaria num registry com o seu nome:

1. Separar o build em **dois estágios**: um instala as dependências, o outro só carrega o resultado.
2. Criar um **usuário sem privilégio** dentro da imagem e rodar a aplicação com ele (o `giropops` da Fase 1 volta).
3. Adicionar um **`HEALTHCHECK`** que bate em `/health`, para o container ficar `healthy` sozinho.
4. Identificar a imagem com **labels OCI** (`org.opencontainers.image.*`).
5. Fechar a imagem em **menos de 250 MB**.
6. **Prova de fogo:** `docker inspect` mostra `healthy`, `id -u` dentro do container não é `0` e `/health` responde `200`.

## O que fazer com o giropops-status nesta semana

### 1. Meça o ponto de partida

Antes de otimizar, meça. Construa a imagem do cap 1 na pasta deste capítulo (copie o `Dockerfile` e o `.dockerignore` que você escreveu) e veja o tamanho e as camadas:

```bash
cd ~/linuxtips-workspace/projetos/descomplicando-docker/fase-3-cap-02/
docker build -t giropops-status:cap02-antes .
docker image ls giropops-status:cap02-antes
docker image history giropops-status:cap02-antes --no-trunc | head -20
```

Anote o tamanho no `NOTAS.md`. Repare no layer do `pip install`: ele carrega o cache do pip, metadados e, dependendo da base, ferramentas de compilação que a aplicação nunca vai usar em runtime.

Veja também quem é o usuário atual:

```bash
docker container run --rm giropops-status:cap02-antes id
# uid=0(root) gid=0(root) groups=0(root)
```

Esse é o problema número um.

### 2. Multi-stage: separe quem constrói de quem roda

A ideia é simples: o **primeiro estágio** (`builder`) tem tudo o que precisa para instalar as dependências. O **segundo estágio** começa de uma base limpa e copia **só o resultado** do primeiro. O que sobrou no `builder` (cache, wheels, compiladores) fica para trás.

Estrutura que a verificação espera: pelo menos **duas instruções `FROM`**, a primeira com um nome (`AS builder`).

```dockerfile
# Estágio 1: instala as dependências num prefixo isolado
FROM python:3.13-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Estágio 2: imagem final, só com o que roda
FROM python:3.13-slim
WORKDIR /app
COPY --from=builder /install /usr/local
# ... o que falta: usuário, código, ENV, EXPOSE, HEALTHCHECK, LABEL, USER, CMD
```

> **Por que `--prefix=/install`?** O `pip` instala os pacotes num diretório separado, e o `COPY --from=builder /install /usr/local` traz `lib/python3.13/site-packages` e `bin/` para o lugar onde o Python do estágio final procura. Outra abordagem válida é um virtualenv em `/opt/venv` copiado inteiro e `ENV PATH="/opt/venv/bin:$PATH"`. Escolha uma e entenda por que ela funciona; as duas passam.

> **As duas bases precisam ser a mesma versão de Python.** Se o `builder` é `3.13` e o final é `3.12`, os pacotes vão parar em `python3.13/site-packages` e o Python `3.12` nunca vai achar. Fixe a mesma tag nos dois `FROM`.

### 3. Usuário sem privilégio

A regra é a mesma do cap 4 da Fase 1: a aplicação não roda como root. Dentro da imagem, você cria o usuário **antes** de trocar para ele, e troca **depois** de tudo o que precisa de root (instalar pacotes, copiar arquivos).

```dockerfile
RUN groupadd --system --gid 1000 giropops \
 && useradd --system --uid 1000 --gid giropops --no-create-home --shell /usr/sbin/nologin giropops
```

Depois dos `COPY`, e antes do `CMD`:

```dockerfile
USER giropops
```

> **Por que `--uid 1000` explícito?** Porque o cap 7 vai montar volumes e `tmpfs` e o uid precisa ser previsível. Também facilita a verificação: o MESA roda `id -u` dentro do container e espera qualquer coisa diferente de `0`.

> **Ordem importa.** `USER` vale para todas as instruções seguintes, inclusive `RUN`. Se você colocar `USER giropops` antes do `pip install`, o `pip` não consegue escrever em `/usr/local` e o build quebra. Root constrói, `giropops` roda.

Confira depois do build:

```bash
docker container run --rm giropops-status:cap02 id
# uid=1000(giropops) gid=1000(giropops) groups=1000(giropops)
docker image inspect giropops-status:cap02 --format '{{.Config.User}}'
# giropops
```

### 4. `HEALTHCHECK`

O Docker só sabe se o **processo** está rodando. Um Flask travado num deadlock é um processo rodando. O `HEALTHCHECK` ensina o Docker a perguntar para a aplicação, do mesmo jeito que você fazia com o `health-check.sh` da Fase 1.

Problema: a imagem `slim` **não tem `curl`**. Você tem duas opções:

- Instalar `curl` com `apt-get` no estágio final (custa uns 10 MB e mais pacotes para o Trivy do cap 7 reclamar).
- Usar o próprio Python, que já está lá, com `urllib` (custa zero).

```dockerfile
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:5000/health', timeout=2).status == 200 else 1)"
```

| Parâmetro | Por quê |
|---|---|
| `--interval=10s` | a verificação espera `healthy` em até 60 s; com o padrão de 30 s você chega no limite |
| `--timeout=3s` | se `/health` não responder em 3 s, conta como falha |
| `--start-period=5s` | tolerância para o Python subir antes de começar a contar falhas |
| `--retries=3` | três falhas seguidas viram `unhealthy` |

> **`/health` depende do Redis.** Sem Redis, a rota devolve `503` e o `urlopen` levanta exceção (saída diferente de zero). Ou seja: o container só fica `healthy` com o Redis do lado. É exatamente o comportamento que você quer, e é assim que a verificação testa.

### 5. Labels OCI

Labels são metadados dentro da imagem. O padrão da Open Container Initiative define nomes que ferramentas (registries, scanners, dashboards) entendem. A verificação exige `org.opencontainers.image.source`; coloque também os outros que fazem sentido:

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/<seu-login>/linuxtips-workspace" \
      org.opencontainers.image.title="giropops-status" \
      org.opencontainers.image.description="Dashboard de status de serviços (LINUXtips)" \
      org.opencontainers.image.licenses="MIT"
```

> **Por que `source` importa?** No GHCR (cap 6), esse label é o que liga a imagem ao repositório e faz o pacote aparecer na página do repo. Sem ele, a imagem fica órfã.

Confira:

```bash
docker image inspect giropops-status:cap02 --format '{{json .Config.Labels}}' | python3 -m json.tool
```

### 6. Construa e meça de novo

```bash
docker build -t giropops-status:cap02 .
docker image ls giropops-status
```

Compare com o `cap02-antes`. Se ainda estiver acima de 250 MB, revise:

- A base final é `slim` (não `python:3.13` completa)?
- O `pip install` roda **só no builder**?
- O `.dockerignore` continua na pasta (o `.git` não entrou no `COPY . .`)?
- Você instalou algo com `apt-get` no estágio final sem `rm -rf /var/lib/apt/lists/*`?

Para ver o que pesa, layer por layer:

```bash
docker image history giropops-status:cap02
```

### 7. Suba e valide o `healthy`

Mesma rede e mesmo Redis do cap 1 (crie de novo se limpou):

```bash
docker network create giropops 2>/dev/null || true
docker container run -d --name redis --network giropops redis:7-alpine

docker container run -d --name giropops-status --network giropops \
  -e REDIS_HOST=redis -p 5000:5000 giropops-status:cap02

# Acompanhe a coluna STATUS: (health: starting) -> (healthy)
watch -n 2 docker container ls
```

Valide os três pontos que o MESA olha:

```bash
docker container inspect giropops-status --format '{{.State.Health.Status}}'
# healthy

docker container exec giropops-status id -u
# 1000 (qualquer coisa diferente de 0)

curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5000/health
# 200
```

### 8. Bônus: veja o `HEALTHCHECK` trabalhar

Pare o Redis e observe o container virar `unhealthy` em cerca de 30 segundos (3 tentativas de 10 s):

```bash
docker container stop redis
sleep 35
docker container inspect giropops-status --format '{{.State.Health.Status}}'
# unhealthy
docker container inspect giropops-status --format '{{json .State.Health.Log}}' | python3 -m json.tool | tail -20

docker container start redis
sleep 15
docker container inspect giropops-status --format '{{.State.Health.Status}}'
# healthy
```

O container **não reiniciou**: `HEALTHCHECK` só reporta. Quem age em cima disso é o Compose (cap 3, `depends_on` com `condition: service_healthy`) e, mais adiante, o Kubernetes.

## Novidades do pacote desta semana

- `docs/fase-3/cap-02.md`: este roteiro.
- A branch continua **sem** `Dockerfile`: você traz o seu do cap 1 e evolui aqui. Copiar o arquivo entre as pastas dos capítulos é parte do fluxo; cada capítulo é uma entrega independente.

## Entrega

A verificação do MESA roda, dentro da pasta do capítulo, exatamente isto:

- [ ] `docker build` conclui sem erro.
- [ ] O `Dockerfile` tem pelo menos 2 instruções `FROM` (multi-stage).
- [ ] A imagem define `USER` diferente de root (`Config.User` não vazio, e não `root` nem `0`).
- [ ] A imagem tem `HEALTHCHECK` e o container fica `healthy` em até 60 segundos.
- [ ] A imagem tem a label `org.opencontainers.image.source`.
- [ ] A imagem tem menos de 250 MB.
- [ ] O processo dentro do container roda com uid diferente de 0.
- [ ] `/health` responde `200`.

Faça commit e push na pasta do capítulo e clique em **Verificar** no MESA.

```bash
git add Dockerfile .dockerignore
git commit -m "fase-3 cap-02: imagem multi-stage, usuário giropops, HEALTHCHECK e labels OCI"
git push
```

## Pegadinhas frequentes

- **`ModuleNotFoundError: No module named 'flask'` no estágio final**: o `COPY --from=builder` copiou para o lugar errado, ou as duas bases têm versões diferentes de Python. Entre no container (`docker container run --rm -it giropops-status:cap02 sh`) e procure `site-packages`.
- **`Permission denied` durante o build**: `USER giropops` está antes de um `RUN` ou `COPY` que precisa de root. Mova o `USER` para logo antes do `CMD`.
- **Container nunca sai de `(health: starting)`**: o `start-period` é longo demais, ou o comando do `HEALTHCHECK` está errado e nem executa. `docker container inspect --format '{{json .State.Health.Log}}'` mostra a saída de cada tentativa.
- **`unhealthy` mas `curl` do host funciona**: o `HEALTHCHECK` roda **dentro** do container. `localhost` ali é o container. Se você mudou `APP_PORT`, o `HEALTHCHECK` precisa acompanhar.
- **Imagem com 300 MB**: `apt-get install` no estágio final sem limpar as listas, ou base completa em vez de `slim`. `docker image history` aponta o layer culpado.
- **`Config.User` vazio no inspect**: você criou o usuário mas esqueceu a instrução `USER`. Criar não é usar.
- **`useradd: UID 1000 is not unique`**: a base já tem um usuário com uid 1000 (algumas imagens têm). Use outro uid, ou reaproveite o existente com `USER 1000`.
- **Label não aparece**: barra invertida faltando na continuação de linha do `LABEL`, e a segunda label virou instrução inválida. Confira com `docker image inspect --format '{{json .Config.Labels}}'`.

## Referências no treinamento

- **Descomplicando Docker**, aulas sobre **multi-stage build**: por que separar build e runtime, `FROM ... AS`, `COPY --from`.
- Aulas sobre **`USER`** e por que não rodar container como root.
- Aulas sobre **`HEALTHCHECK`**: `--interval`, `--timeout`, `--start-period`, `--retries`, e os estados `starting`, `healthy`, `unhealthy`.
- Aulas sobre **`LABEL`** e boas práticas de imagem (base pequena, poucos layers, limpeza de cache).
- **Fase 1, cap 4**: o usuário de serviço `giropops` sem shell. É o mesmo conceito, agora dentro da imagem.

## Próximo passo

No **Capítulo 3** você para de digitar `docker container run` com dez flags e descreve app + Redis num arquivo **Compose**. E resolve um problema que está escondido desde o cap 1: hoje, `docker container rm redis` apaga todos os serviços que você cadastrou. Você vai colocar os dados do Redis num **volume nomeado** e provar que eles sobrevivem a `docker compose down` e `up`.
