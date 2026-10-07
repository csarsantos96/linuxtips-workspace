# Capítulo 1: Primeiro container (do systemd para o Docker)

> **Referência:** treinamento _Descomplicando Docker_, aulas sobre o que é um container, instalação do Docker, `docker container run` e a introdução ao Dockerfile.
> **Pré-requisitos:** Fase 1 concluída. Você conhece a aplicação (`app.py`, `requirements.txt`, `.env.example`), já rodou ela com systemd e sabe que ela conversa com o Redis em `REDIS_HOST:REDIS_PORT`.

## Objetivo da semana

Na Fase 1 você levou o giropops-status até virar um serviço de sistema: usuário `giropops`, virtualenv em `/opt/giropops-status/venv`, unit file, `Restart=on-failure`, Nginx na frente. Funciona, mas tem um problema: tudo isso só existe **naquele servidor**. Para subir a mesma aplicação numa segunda máquina, você repete cada passo, e qualquer diferença de versão do Python ou do Redis vira uma tarde de debug.

Esta semana você empacota a aplicação num **container**:

1. Instalar o Docker e confirmar que o daemon responde.
2. Escrever o **`.dockerignore`** para não mandar lixo (e o `.git`) para dentro da imagem.
3. Escrever o **primeiro `Dockerfile`** do giropops-status, com `FROM` de tag fixa e `WORKDIR` definido.
4. Construir a imagem com `docker build` e inspecionar o que saiu.
5. Criar uma **rede de containers** e subir o Redis nela.
6. Subir a aplicação na mesma rede, apontando `REDIS_HOST=redis`.
7. **Prova de fogo:** `GET /health` responde `200` com `"redis": "connected"`.

Quando você fechar este capítulo, o giropops-status roda com um comando em qualquer máquina que tenha Docker. O `apt install`, o `venv`, o `pip install`: tudo isso passa a acontecer **dentro da imagem**, uma vez, e nunca mais na mão.

## O que fazer com o giropops-status nesta semana

### 1. Instale o Docker e confira o daemon

Na sua máquina (VM Ubuntu, WSL 2 ou Docker Desktop), siga a instalação do treinamento. No Ubuntu, o caminho rápido é o script oficial:

```bash
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
# Abra uma nova sessão para o grupo valer
```

Confira que o cliente conversa com o daemon e que o Compose v2 está presente (você vai precisar dele no cap 3):

```bash
docker version
docker compose version
docker info | grep -E 'Server Version|Storage Driver|Cgroup'
```

> **Pegadinha clássica:** `permission denied while trying to connect to the Docker daemon socket`. Você esqueceu de abrir uma nova sessão depois do `usermod -aG docker`. É a mesma regra do cap 4 da Fase 1: grupo novo só vale em sessão nova.

### 2. Prepare a pasta do capítulo

Clique em **Aceitar Desafio** no MESA, atualize o seu workspace e entre na pasta:

```bash
cd ~/linuxtips-workspace
git pull
cd projetos/descomplicando-docker/fase-3-cap-01/
ls -la
```

Você deve ver `app.py`, `requirements.txt`, `templates/`, `.env.example` e a pasta `docs/`. **Tudo o que você criar nesta semana fica aqui dentro.** A verificação do MESA entra nesta pasta e não olha nada fora dela.

### 3. Escreva o `.dockerignore` antes do Dockerfile

Ordem proposital. O `docker build` manda o **contexto** inteiro (a pasta atual) para o daemon antes de executar qualquer instrução. Sem `.dockerignore`, o `.git`, o `venv/` de testes locais, `__pycache__/` e o seu `.env` com senha vão junto. Isso deixa o build lento e, pior, pode parar dentro da imagem num `COPY . .`.

Crie o `.dockerignore` com pelo menos estas entradas:

```
.git
.gitignore
__pycache__/
*.pyc
venv/
.venv/
.env
docs/
*.md
```

Confira que o `.git` está lá (é um dos checks):

```bash
grep -n '^\.git$' .dockerignore
```

### 4. Escreva o `Dockerfile`

Este é o coração da semana. Você vai escrever o arquivo **na mão**, entendendo cada instrução. A estrutura mínima que a verificação espera:

| Instrução | O que você decide | Por quê |
|---|---|---|
| `FROM` | imagem base Python **com tag explícita** (ex.: `python:3.13-slim`) | `latest` muda sem avisar; sem tag é `latest` disfarçado. A verificação reprova os dois. |
| `WORKDIR` | diretório de trabalho (ex.: `/app`) | Cria o diretório e faz `cd` para todas as instruções seguintes. Sem ele, o `COPY` e o `CMD` viram caminhos absolutos espalhados. |
| `COPY requirements.txt` | copiar **só** o `requirements.txt` primeiro | Cache de layers: se o código mudar e as dependências não, o `pip install` não roda de novo. |
| `RUN pip install` | `--no-cache-dir -r requirements.txt` | Mesmo motivo do cap 5 da Fase 1: cache de wheels não tem o que fazer dentro da imagem. |
| `COPY . .` | copiar o resto do código | Agora sim, o `app.py` e o `templates/`. O `.dockerignore` filtra o que não deve ir. |
| `ENV` | `PYTHONUNBUFFERED=1` | Sem isso o Python segura o log num buffer e o `docker logs` fica em branco até o buffer encher. |
| `EXPOSE` | `5000` | Documentação da porta. Não publica nada sozinho, mas todo mundo que ler a imagem sabe onde ela escuta. |
| `CMD` | comando que inicia a aplicação, no formato **exec** (lista JSON) | Formato exec faz o Python virar PID 1 e receber o `SIGTERM` do `docker stop`. Formato shell (`CMD python app.py`) coloca um `/bin/sh` na frente e o sinal morre nele. |

Um fragmento para você começar (complete o resto seguindo a tabela):

```dockerfile
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ... o que falta: copiar o código, ENV, EXPOSE e CMD
```

> **Por que `slim` e não a imagem `python:3.13` completa?** A completa tem compiladores, `git`, `man pages`: quase 1 GB. A `slim` tem só o Python e roda a aplicação do mesmo jeito. A `alpine` é menor ainda, mas usa `musl` em vez de `glibc`, e alguns pacotes Python precisam compilar. Para o giropops-status, `slim` é o meio termo seguro. No cap 2 você vai medir isso.

### 5. Construa a imagem

```bash
docker build -t giropops-status:cap01 .
```

O `.` no final é o contexto (a pasta do capítulo). O `-t` dá nome e tag. Acompanhe a saída: cada instrução vira um **layer**. Rode de novo e repare que tudo vem de `CACHED`:

```bash
docker build -t giropops-status:cap01 .
docker image ls giropops-status
docker image history giropops-status:cap01
```

O `history` mostra o tamanho de cada layer. Anote no seu `NOTAS.md` qual layer é o maior. Isso vai importar no cap 2.

### 6. Crie a rede e suba o Redis

Containers na rede `bridge` padrão **não se enxergam por nome**. Numa rede criada por você, o Docker liga um DNS interno e cada container responde pelo próprio nome. É por isso que a verificação exige uma rede sua:

```bash
docker network create giropops
docker network ls
```

Suba o Redis dentro dela, com o nome `redis` (esse nome vira o hostname):

```bash
docker container run -d \
  --name redis \
  --network giropops \
  redis:7-alpine

docker container ls
docker container exec redis redis-cli ping
# PONG
```

> **Tag do Redis também é fixa.** `redis:7-alpine` é a série 7 do Redis na base Alpine. Nunca `redis:latest`. A regra do `FROM` vale para tudo o que você roda.

### 7. Suba a aplicação na mesma rede

Lembre do `app.py`: ele lê `REDIS_HOST` (padrão `localhost`). Dentro de um container, `localhost` é o **próprio container**, não a sua máquina e não o Redis. Você precisa dizer para a aplicação que o Redis está no host `redis`:

```bash
docker container run -d \
  --name giropops-status \
  --network giropops \
  -e REDIS_HOST=redis \
  -p 5000:5000 \
  giropops-status:cap01

docker container logs giropops-status
```

O `-p 5000:5000` publica a porta: `host:container`. O `-e` injeta a variável de ambiente, do mesmo jeito que o `EnvironmentFile=` fazia no systemd.

### 8. Valide

```bash
curl -s http://localhost:5000/health
# Esperado: {"redis":"connected","status":"healthy","version":"1.0.0"}

curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5000/health
# 200

curl -s http://localhost:5000/version
```

Se vier `"redis": "connected"`, a aplicação resolveu `redis` pelo DNS da rede e conversou com ele. Se vier `503` com `"redis": "disconnected"`, veja as pegadinhas.

### 9. Bônus: quebre de propósito

Pare o Redis e veja a aplicação degradar:

```bash
docker container stop redis
curl -s -w '\n%{http_code}\n' http://localhost:5000/health
# 503 com "redis": "disconnected"

docker container start redis
curl -s -w '\n%{http_code}\n' http://localhost:5000/health
# 200 de novo, sem reiniciar a app
```

Agora derrube tudo e suba de novo do zero. Repare quanto tempo leva em relação à Fase 1:

```bash
docker container rm -f giropops-status redis
docker container run -d --name redis --network giropops redis:7-alpine
docker container run -d --name giropops-status --network giropops \
  -e REDIS_HOST=redis -p 5000:5000 giropops-status:cap01
```

Segundos. Esse é o ganho do container.

## Novidades do pacote desta semana

- A branch `fase-3-cap-01` traz a aplicação limpa: `app.py`, `requirements.txt`, `templates/`, `.env.example`. **Não** traz `Dockerfile` nem `.dockerignore`: esses são seus.
- `docs/fase-3/cap-01.md`: este roteiro.

> **Sobre o `Dockerfile` que existe na branch `main` do repositório.** Ele é um arquivo mínimo de avaliação rápida, e não passa em todos os checks da Fase 3. Não copie. Escreva o seu.

## Entrega

A verificação do MESA roda, dentro da pasta do capítulo, exatamente isto:

- [ ] `Dockerfile` existe na pasta do capítulo.
- [ ] `FROM` tem tag explícita (nunca `latest`, nunca sem tag).
- [ ] `WORKDIR` está definido.
- [ ] `.dockerignore` existe e ignora `.git`.
- [ ] `docker build -t giropops-status:cap01 .` conclui sem erro.
- [ ] O container sobe com `-e REDIS_HOST=redis` numa rede criada por você, junto com `redis:7-alpine`.
- [ ] `GET /health` responde `200` com `"redis": "connected"`.

Faça commit e push na pasta do capítulo e clique em **Verificar** no MESA.

```bash
git add Dockerfile .dockerignore
git commit -m "fase-3 cap-01: primeiro Dockerfile do giropops-status"
git push
```

## Pegadinhas frequentes

- **`"redis": "disconnected"` no `/health`**: a app não achou o Redis. Ou você esqueceu o `-e REDIS_HOST=redis`, ou o container do Redis não se chama `redis`, ou os dois não estão na mesma rede. `docker network inspect giropops` lista quem está dentro.
- **`docker build` falha em `COPY requirements.txt`**: você está rodando o build de outra pasta. O contexto é o `.` e tem que ser a pasta do capítulo.
- **Build lento e imagem gigante**: o `.git` foi parar no contexto. Confira o `.dockerignore` e rode `docker build` de novo.
- **`docker logs` vazio mas a app responde**: faltou `PYTHONUNBUFFERED=1`. O log está preso no buffer.
- **`docker stop` demora 10 segundos**: o `CMD` está no formato shell. O `SIGTERM` foi para o `sh`, o Python nunca recebeu, e o Docker matou na força depois do timeout. Troque para o formato exec (lista JSON).
- **`port is already allocated` no `-p 5000:5000`**: o giropops-status da Fase 1 ainda está rodando via systemd na mesma máquina. `sudo systemctl stop giropops-status` ou publique em outra porta (`-p 5001:5000`).
- **Verificação reprovou no `FROM`**: `FROM python` (sem tag) ou `FROM python:latest`. Coloque a versão.
- **Commitou o `.env` sem querer**: o `.gitignore` da Fase 1 ignora `.env`; se você criou um `.env` aqui, ele não sobe. Nesta semana você não precisa dele (a variável vai via `-e`).

## Referências no treinamento

- **Descomplicando Docker**, aulas iniciais: o que é um container, namespaces e cgroups, instalação do Docker, `docker container run`, `-d`, `-p`, `-e`, `--name`.
- Aulas sobre **Dockerfile**: `FROM`, `WORKDIR`, `COPY`, `RUN`, `ENV`, `EXPOSE`, `CMD`, e a diferença entre formato shell e formato exec.
- Aulas sobre **redes**: por que a `bridge` padrão não resolve nomes e o que muda numa rede criada por você (`docker network create`).
- **Fase 1, cap 5 e cap 11** (para comparar): tudo o que a unit file fazia (usuário, diretório, variáveis, comando) agora está no `Dockerfile` e nas flags do `run`.

## Próximo passo

No **Capítulo 2** você pega esse `Dockerfile` e transforma numa **imagem profissional**: build em dois estágios para não carregar o `pip` e os compiladores na imagem final, usuário sem privilégio (o `giropops` volta, agora dentro do container), `HEALTHCHECK` para o Docker saber sozinho se a app está viva, labels OCI para identificar a imagem e um teto de 250 MB. O `docker image history` que você rodou hoje vai mostrar exatamente onde cortar.
