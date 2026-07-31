# Capítulo 2 — Shell Survival e Navegação

> **Referência:** _Descomplicando Linux para Cloud Native_, Capítulo 2.
> **Pré-requisitos:** Capítulo 1 concluído — VM e EC2 acessíveis via SSH.

## Objetivo da semana

Sair da pasta home e **criar a estrutura definitiva** do Giropops Status no seu servidor:

```
/opt/giropops-status/
├── app/        # o codigo da aplicacao
├── logs/       # logs da app (cap 7)
├── config/     # variaveis de ambiente (cap 5)
└── backups/    # backups futuros (cap 10)
```

Essa estrutura vai te acompanhar **até o fim da Fase 1** (11 capítulos). Trate-a com carinho.

## O que fazer com o giropops-status nesta semana

### 1. Criar a estrutura de diretórios (na VM e na EC2)

```bash
sudo mkdir -p /opt/giropops-status/{app,logs,config,backups}
sudo chown -R $USER:$USER /opt/giropops-status
ls -lah /opt/giropops-status
```

### 2. Empacotar o código e transferir para o servidor

No seu notebook (fora do pacote extraído):

```bash
# Cria um tar.gz enxuto so com o codigo (sem docs e releases)
tar -czf /tmp/giropops-app.tar.gz \
  --exclude='docs' --exclude='releases' --exclude='.git*' \
  -C giropops-status-fase-1-cap-02/ \
  app.py requirements.txt static templates tests
```

Transfira com `rsync`:

```bash
rsync -avz /tmp/giropops-app.tar.gz vm:/tmp/
rsync -avz /tmp/giropops-app.tar.gz ec2:/tmp/
```

### 3. Extrair dentro de `/opt/giropops-status/app/`

No servidor:

```bash
cd /opt/giropops-status/app/
tar -xzf /tmp/giropops-app.tar.gz
ls -lah
```

### 4. Explorar com as ferramentas do capítulo

Pratique os comandos do livro **neste diretório**:

```bash
pwd
ls -lah
find . -name "*.py" -type f
find . -type f -name "*.html"
file app.py
which python3
type ls
```

## Novidades do pacote desta semana

- `docs/fase-1/cap-02.md` (este roteiro)
- O código base da aplicação continua o mesmo do cap 1; você ainda não vai rodá-lo — só **mover** para o lugar certo no servidor

## Entrega

- [ ] Estrutura `/opt/giropops-status/{app,logs,config,backups}` criada nos dois ambientes
- [ ] Código transferido para `/opt/giropops-status/app/` via `rsync`
- [ ] `ls -lah /opt/giropops-status/app/` mostra `app.py`, `requirements.txt`, `static/`, `templates/`, `tests/`
- [ ] Você consegue explicar o que cada flag de `ls -lah` significa

Print do `tree /opt/giropops-status` (instale `tree` se precisar) no canal da turma com tag `#cap-02-entrega`.

## Referências no livro

- **Capítulo 2**, seções "FHS", "Navegação: cd/ls/pwd", "Criando com mkdir -p", "find", "tar", "rsync".
- A missão deste capítulo no livro ("baixar tar.gz, descompactar, organizar") é **literalmente** o que você faz aqui.
