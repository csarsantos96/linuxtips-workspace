# Giropops Status

> **Projeto prático oficial do livro _Descomplicando Linux para Cloud Native_** (série Descomplicando, LINUXtips) — a aplicação que acompanha você do primeiro comando até o cluster de produção.

[![LINUXtips](https://img.shields.io/badge/LINUXtips-Descomplicando%20Linux-orange)](https://linuxtips.io)
[![Fase Atual](https://img.shields.io/badge/fase-1%20Linux-blue)](docs/fase-1/)

O **Giropops Status** é uma aplicação web Python/Flask + Redis que monitora a saúde de serviços HTTP: cadastra endpoints, dispara health checks, armazena histórico e expõe métricas no formato Prometheus. Um dashboard simples mostra o status em tempo real.

Mais do que um projeto de código, ele é um **desafio prático faseado** que acompanha cada capítulo do livro. Cada sub-fase é distribuída como um `.tar.gz` separado — o instrutor libera conforme a turma avança.

---

## Roadmap

O programa inteiro se divide em 4 grandes fases (uma por livro/treinamento da série Descomplicando):

| Fase | Livro | Foco |
|:---:|---|---|
| **1** | **Descomplicando Linux** (atual) | Rodar a aplicação manualmente em um servidor Linux real |
| 2 | Descomplicando Docker *(em breve)* | Empacotar em containers profissionais |
| 3 | Descomplicando Terraform *(em breve)* | Infraestrutura como código |
| 4 | Descomplicando AWS *(em breve)* | Produção em cloud |

> Só a **Fase 1** está publicada neste momento. As demais serão liberadas conforme os livros correspondentes forem publicados.

---

## Fase 1 — Linux (11 capítulos)

A Fase 1 acompanha os 11 capítulos do livro. Cada capítulo tem seu próprio pacote — o aluno recebe do instrutor conforme a turma avança:

| Cap | Tema | Pacote | O que o aluno faz com o giropops-status |
|:---:|---|---|---|
| 1 | Setup Híbrido (VM + EC2) & SSH | `fase-1-cap-01.tar.gz` | Prepara o ambiente que vai rodar a aplicação |
| 2 | Shell Survival e Navegação | `fase-1-cap-02.tar.gz` | Cria a estrutura `/opt/giropops-status/{app,logs,config,backups}` |
| 3 | Edição de Texto (Vim + VS Code) | `fase-1-cap-03.tar.gz` | Edita o código no servidor; lê logs em tempo real |
| 4 | Permissões e Segurança | `fase-1-cap-04.tar.gz` | Cria usuário `giropops`, permissões, hardening SSH |
| 5 | Pacotes (APT) e Systemd | `fase-1-cap-05.tar.gz` | Instala deps, cria o `.service`, habilita no boot |
| 6 | Processos e Monitoramento | `fase-1-cap-06.tar.gz` | Monitora, simula carga, limita memória via systemd |
| 7 | Storage e Filesystem | `fase-1-cap-07.tar.gz` | Volume dedicado, logrotate, backups |
| 8 | Streams, Pipes e Filtros | `fase-1-cap-08.tar.gz` | Analisa logs e métricas com `grep/awk/jq` |
| 9 | Networking Cloud Native | `fase-1-cap-09.tar.gz` | `ufw`, Nginx reverse proxy, HTTPS |
| 10 | Automação com Shell Script | `fase-1-cap-10.tar.gz` | Scripts de provisão, deploy, backup e health-check |
| 11 | Containers e Projeto Final | `fase-1-cap-11.tar.gz` | Containeriza a aplicação (Dockerfile + Compose) |

Para começar uma fase, extraia o pacote recebido:

```bash
tar -xzf giropops-status-fase-1-cap-05.tar.gz
cd giropops-status-fase-1-cap-05/
```

E abra **[docs/fase-1/cap-05.md](docs/fase-1/cap-05.md)** para o roteiro da semana.

---

## Arquitetura da aplicação

```
┌──────────────┐      ┌────────────────────┐      ┌──────────┐
│   Browser    │◀────▶│  Flask (app.py)    │◀────▶│  Redis   │
└──────────────┘      │  :5000             │      │  :6379   │
                      │                    │      └──────────┘
                      │  /                 │
                      │  /api/services     │      ┌──────────┐
                      │  /api/check        │─────▶│ Targets  │
                      │  /health /metrics  │ HTTP │ monitor. │
                      └────────────────────┘      └──────────┘
```

**Stack:** Python 3.12 + Flask + Redis

**Estrutura de diretórios no servidor (definida a partir do cap 2):**

```
/opt/giropops-status/
├── app/              # codigo da aplicacao (app.py, templates, static)
├── venv/             # ambiente virtual Python (criado no cap 5)
├── config/
│   └── .env          # variaveis de ambiente (cap 5)
├── logs/             # logs locais (cap 7)
└── backups/          # backups gerados pelo shell script (cap 10)
```

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET`  | `/` | Dashboard web |
| `GET`  | `/api/services` | Lista serviços monitorados |
| `POST` | `/api/services` | Cadastra um serviço |
| `DELETE` | `/api/services/<name>` | Remove um serviço |
| `POST` | `/api/check` | Dispara check em todos os serviços |
| `POST` | `/api/check/<name>` | Dispara check em um serviço |
| `GET`  | `/api/history/<name>` | Histórico de checks |
| `GET`  | `/health` | Health check da própria aplicação |
| `GET`  | `/metrics` | Métricas Prometheus |
| `GET`  | `/version` | Versão e build info |

### Variáveis de ambiente

| Variável | Padrão | Usada a partir do |
|---|---|---|
| `REDIS_HOST` | `localhost` | cap 5 |
| `REDIS_PORT` | `6379` | cap 5 |
| `REDIS_PASSWORD` | *(vazio)* | cap 5 (hardening) |
| `APP_PORT` | `5000` | cap 5 |
| `APP_VERSION` | `1.0.0` | cap 5 |
| `CHECK_TIMEOUT` | `5` | cap 5 |
| `HISTORY_LIMIT` | `100` | cap 5 |
| `LOG_LEVEL` | `INFO` | cap 3 |
| `LOG_FILE` | *(vazio = stdout)* | cap 3 |
| `FLASK_DEBUG` | `false` | dev |

### Arquivos auxiliares

| Arquivo | Usado no | Propósito |
|---|---|---|
| `dotfiles/vimrc.example` | cap 3 | `.vimrc` didático para copiar em `~/.vimrc` |

---

## Documentação

- **[Manual do Aluno](docs/MANUAL-ALUNO.md)** — como acompanhar a Fase 1 capítulo a capítulo
- **[Roteiros por capítulo](docs/fase-1/)** — o que fazer com o giropops-status em cada capítulo

> O **Manual do Instrutor** fica apenas no repositório do mantenedor; ele é automaticamente excluído dos pacotes `.tar.gz` distribuídos aos alunos (via `.gitattributes`).

---

## Licença

MIT — use, estude, compartilhe.

---

**Giropops Status** é mantido pela comunidade **LINUXtips** como projeto prático da série Descomplicando. Feito com 💜 por quem acredita que Linux/DevOps se aprende operando, não lendo slide.
