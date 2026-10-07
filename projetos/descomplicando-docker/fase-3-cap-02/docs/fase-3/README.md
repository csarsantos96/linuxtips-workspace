# Fase 3 (Docker): roteiros por capítulo

Esta pasta contém, para cada capítulo da Fase 3 do projeto Giropops Status, o roteiro de **"o que fazer com o giropops-status nesta semana"**. A Fase 3 acompanha o treinamento **Descomplicando Docker** da LINUXtips.

> Os roteiros **não substituem o treinamento**. Assista às aulas do tema primeiro; o roteiro aqui só diz como aplicar o conteúdo ao projeto prático e como passar na verificação automática do MESA.

## O que muda em relação às Fases 1 e 2

Na Fase 1 você operou o Giropops Status na mão, num servidor Linux: usuário de serviço, systemd, Nginx, firewall, shell script. Na Fase 2 você descreveu a infraestrutura em código com Terraform. Agora a aplicação sai do servidor e entra num **container**: a mesma aplicação (Python/Flask + Redis), mas empacotada numa imagem que roda igual na sua máquina, na EC2 e, mais adiante, no Kubernetes.

Ao longo dos 8 capítulos você vai:

1. Escrever o primeiro `Dockerfile` e ligar app e Redis numa rede de containers.
2. Transformar essa imagem numa imagem profissional (multi-stage, usuário sem privilégio, `HEALTHCHECK`, labels OCI).
3. Persistir os dados do Redis num volume nomeado.
4. Isolar a rede: Redis sem porta publicada, resolvido por DNS.
5. Montar um Compose de produção com Nginx na frente, `.env`, restart policy e limites de recurso.
6. Publicar a imagem num registry com tag semântica.
7. Endurecer o container e proteger o Redis com senha.
8. Colocar o Prometheus para coletar as métricas `giropops_*` da aplicação.

## Índice

| Cap | Tema | Roteiro |
|:---:|---|---|
| 1 | Primeiro container: do systemd para o Docker | [cap-01.md](cap-01.md) |
| 2 | Imagem profissional: multi-stage, usuário, HEALTHCHECK, labels | [cap-02.md](cap-02.md) |
| 3 | Volumes e persistência com Compose | [cap-03.md](cap-03.md) |
| 4 | Redes e isolamento | [cap-04.md](cap-04.md) |
| 5 | Compose de produção: Nginx, `.env`, restart, limites | [cap-05.md](cap-05.md) |
| 6 | Registry e tags semânticas | [cap-06.md](cap-06.md) |
| 7 | Segurança: container endurecido e Redis com senha | [cap-07.md](cap-07.md) |
| 8 | Observabilidade: Prometheus (e Grafana opcional) | [cap-08.md](cap-08.md) |

## Como funciona a Fase 3 no MESA

O fluxo é o mesmo para os 8 capítulos:

1. **Aceite o desafio.** No MESA, abra o capítulo e clique em **Aceitar Desafio**. O MESA copia a branch `fase-3-cap-NN` do repositório `linuxtips/giropops-status` para dentro do **seu workspace no GitHub** (`linuxtips-workspace`), na pasta `projetos/<slug-do-treinamento>/fase-3-cap-NN/`. Exemplo: `projetos/descomplicando-docker/fase-3-cap-01/`.
2. **Trabalhe na pasta do capítulo.** Clone (ou atualize) o seu workspace, entre na pasta do capítulo e siga o roteiro `docs/fase-3/cap-NN.md`. Tudo o que o roteiro pede (Dockerfile, compose, `.env`, arquivos em `docker/`) fica **dentro dessa pasta**, não na raiz do workspace.
3. **Faça commit e push.** A verificação lê o que está no GitHub, não o que está na sua máquina. Sem push, não tem verificação.
4. **Clique em Verificar no MESA.** O MESA clona o seu workspace num pod com Docker (Docker-in-Docker), entra na pasta do capítulo e roda os checks daquele capítulo.

### O que a verificação olha

A verificação é **automática e objetiva**. Cada capítulo tem uma lista fixa de checks (ela está reproduzida na seção "Entrega" de cada roteiro). Alguns exemplos do que o MESA faz dentro da pasta do capítulo:

- Confere se arquivos existem (`Dockerfile`, `.dockerignore`, `docker/IMAGEM.txt`, `docker/prometheus/prometheus.yml`).
- Lê o conteúdo com regras simples (a tag do `FROM` não pode ser `latest`, o serviço `redis` não pode ter `ports`, o serviço da app precisa de `deploy.resources.limits.memory`).
- Roda `docker build`, `docker compose config`, `docker compose up -d` e espera a aplicação responder.
- Faz requisições HTTP reais em `/health`, `/version`, `/metrics` e `/api/services`, e consulta a API do Prometheus.
- Inspeciona a imagem (`docker image inspect`) para ver `USER`, `HEALTHCHECK`, labels e tamanho.
- Executa comandos dentro do container (`id -u`, resolução DNS de `redis`, `redis-cli ping`).

O capítulo é aprovado **somente com todos os checks verdes**. Cada capítulo aprovado vale **100 XP**. Se um check falhar, o MESA mostra qual foi; corrija, faça novo commit e push e clique em Verificar de novo. Não há limite de tentativas.

### Convenções que os checks assumem

Para a verificação encontrar o que você fez, siga estas convenções (elas se repetem em todos os roteiros):

- O **diretório de trabalho** dos checks é a pasta do capítulo. Caminhos relativos no compose (`build: .`, `./docker/nginx/...`) partem dela.
- O arquivo Compose pode se chamar `compose.yaml`, `compose.yml`, `docker-compose.yaml` ou `docker-compose.yml`. Use um só.
- O **serviço da aplicação** é o que tem `build:`. O MESA não procura pelo nome; procura pelo `build:`.
- O **Redis** é o serviço chamado exatamente `redis`. Esse nome também é o hostname que a aplicação usa em `REDIS_HOST`.
- A aplicação escuta na porta `5000` dentro do container (variável `APP_PORT`, padrão `5000`).

## Estrutura padrão dos roteiros

Cada `cap-NN.md` segue este modelo:

- **Objetivo da semana**: para que serve este capítulo no projeto.
- **O que fazer com o giropops-status nesta semana**: passos numerados, com comandos e o porquê de cada decisão.
- **Novidades do pacote desta semana**: o que a branch do capítulo traz de novo.
- **Entrega**: checklist com exatamente os checks que o MESA roda, terminando com o commit, o push e o clique em Verificar.
- **Pegadinhas frequentes**: os erros que mais reprovam na verificação.
- **Referências no treinamento**: quais aulas do Descomplicando Docker embasam os passos.
- **Próximo passo**: o que o capítulo seguinte constrói em cima deste.

## Ferramentas que você precisa ter na sua máquina

- **Docker Engine** com o plugin **Docker Compose v2** (`docker compose version` responde). Docker Desktop também serve.
- **Git** configurado com acesso ao seu workspace no GitHub.
- `curl` para testar as rotas.
- A partir do cap 6: conta no **Docker Hub** ou no **GitHub Container Registry (GHCR)**.
- A partir do cap 7: **Trivy** instalado (ou rodado via container).

## Uma regra de ouro

**Não copie e cole sem entender.** A verificação é automática, mas o objetivo do projeto não é passar no check: é você saber explicar por que o `FROM` tem tag fixa, por que o Redis não publica porta, por que a app roda sem root. Se algo funcionou e você não sabe por quê, volte ao treinamento antes de clicar em Verificar.
