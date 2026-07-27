# Capítulo 3 — Edição de Texto (Vim, leitura de arquivos, logs)

> **Referência:** _Descomplicando Linux para Cloud Native_, Capítulo 3.
> **Pré-requisitos:** Capítulo 2 concluído — código do giropops-status já está em `/opt/giropops-status/app/` na VM e na EC2.

## Objetivo da semana

Você ainda não vai _rodar_ a aplicação (isso é o cap 5, com `systemd`). Esta semana você vai praticar a disciplina que separa profissional de amador em ops: **ler antes de editar, fazer backup antes de alterar, conferir com `diff` depois de salvar**.

No final da semana, você deve conseguir:

1. Ler `app.py` no servidor sem abrir VS Code, navegando com `less`, `head`, `tail`, `cat -n`.
2. Editar arquivos no Vim (modos Normal/Insert, salvar, sair, desfazer, buscar/substituir) **sem entrar em pânico**.
3. Conectar via VS Code Remote SSH para edição confortável.
4. Acompanhar logs em tempo real com `tail -f` enquanto a aplicação executa.

## O que fazer com o giropops-status nesta semana

### 1. Leia o código antes de tocar

Vá para `/opt/giropops-status/app/` na sua VM (terminal SSH puro, sem VS Code):

```bash
cd /opt/giropops-status/app/
ls -lah
wc -l app.py
file app.py
```

Quantas linhas tem `app.py`? Anote no seu `NOTAS.md`.

Agora leia, com **as 4 ferramentas do capítulo**, sem editar:

```bash
cat -n app.py            # tudo de uma vez, com numero de linha
less app.py              # paginado: / para buscar, n proximo, q sair
head -n 30 app.py        # primeiras 30 linhas (imports + config)
tail -n 20 app.py        # ultimas 20 linhas (rota /version e o app.run)
```

Dentro do `less`, busque por `def check_service` digitando `/def check_service` e Enter. Pule entre ocorrências com `n` e `N`. Saia com `q`.

**Pergunte-se enquanto lê:** que variáveis de ambiente a aplicação espera? (`grep '^[A-Z_]* = os.environ' app.py` te dá a resposta sem precisar abrir o arquivo).

### 2. Instale seu `.vimrc`

O pacote traz um `.vimrc` didático. Copie para o seu home:

```bash
cp /opt/giropops-status/app/dotfiles/vimrc.example ~/.vimrc
cat ~/.vimrc                          # leia o que voce acabou de adotar
```

Da próxima vez que abrir o Vim, você vai ter número de linha, coloração de sintaxe e indentação certa.

### 3. Primeira edição com backup e diff

A regra é sagrada: **backup, edita, confere**.

```bash
cd /opt/giropops-status/app/
cp app.py app.py.bak
vim app.py
```

Dentro do Vim, faça **apenas duas alterações**:

1. Vá para a linha que define `APP_VERSION` (use `/APP_VERSION =` para buscar). Troque `"1.0.0"` por `"1.0.0-seunome"`.
2. Encontre a função `version()` (use `/def version`). Modo Insert (`i`), e adicione um novo campo no JSON: `"editado_por": "seunome",`. Saia do Insert (`Esc`).

Salve e saia: `:wq`. Confira o que mudou:

```bash
diff app.py.bak app.py
diff -u app.py.bak app.py    # mesmo formato do git diff
```

Você deve ver apenas as duas linhas alteradas. Se mudou mais coisa, abre de novo e corrige.

### 4. Busca e substituição no Vim

Agora pratique `:%s` num arquivo descartável. Crie um arquivo simulado:

```bash
cat > /tmp/services.txt << 'EOF'
api-staging   https://api-staging.exemplo.com/health
db-staging    https://db-staging.exemplo.com/ping
cache-staging https://cache-staging.exemplo.com/health
EOF
```

Abra com `vim /tmp/services.txt` e troque **todas** as ocorrências de `staging` por `production`:

```
:%s/staging/production/g
```

Salve (`:wq`), confira com `cat /tmp/services.txt`. Se quiser, peça confirmação a cada ocorrência usando o sufixo `c`: `:%s/staging/production/gc`.

### 5. Logs em tempo real com `tail -f`

A aplicação agora suporta logging em arquivo via variável `LOG_FILE`. Você ainda não tem systemd (cap 5), mas pode subir manualmente para praticar:

```bash
cd /opt/giropops-status/app/
python3 -m venv .venv               # caso ainda nao tenha (sera oficializado no cap 5)
source .venv/bin/activate
pip install -r requirements.txt
# precisa de um Redis local: sudo apt install redis-server -y && sudo systemctl start redis

# logging em arquivo
mkdir -p /tmp/giropops-logs
LOG_FILE=/tmp/giropops-logs/app.log python3 app.py &
```

Em **outro terminal** (Ctrl+Alt+T, ou outra aba SSH):

```bash
tail -f /tmp/giropops-logs/app.log
```

No primeiro terminal, faça requisições para gerar logs:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"name":"google","url":"https://google.com"}' \
  http://localhost:5000/api/services

curl -X POST http://localhost:5000/api/check
```

Observe as linhas aparecendo **ao vivo** no `tail -f` do outro terminal. Agora filtre só o que importa:

```bash
tail -f /tmp/giropops-logs/app.log | grep -i 'check'
```

Saia com `Ctrl+C`. Pare a aplicação com `kill %1` no terminal em que ela subiu.

### 6. Conecte com VS Code Remote SSH

Na sua máquina local, abra o VS Code, instale a extensão **Remote - SSH** (Microsoft), `Ctrl+Shift+P` → "Remote-SSH: Connect to Host" → selecione `vm` (o alias que você configurou no cap 1).

Abra a pasta `/opt/giropops-status/`. Faça uma edição trivial em `app.py` (ex: adicionar uma linha em branco), salve. Volte para o terminal e rode `diff` contra o `.bak` que você criou no passo 3. Você vai ver a alteração feita pelo VS Code.

Abra o terminal integrado do VS Code (`` Ctrl+` ``) — ele já está logado no servidor.

## Novidades do pacote desta semana

- `dotfiles/vimrc.example` — o `.vimrc` que você copia para o `~/.vimrc`.
- `app.py` agora tem **logging configurável** via `LOG_FILE` e `LOG_LEVEL`. Isso te dá o que monitorar com `tail -f`.
- `.env.example` foi reescrito com comentários — leia cada linha; você vai cruzar com isso de novo no cap 5.

## Entrega

- [ ] Print do `diff -u app.py.bak app.py` mostrando suas duas alterações (`APP_VERSION` e `editado_por`).
- [ ] Print de dois terminais lado a lado: `tail -f` à esquerda, `curl` gerando requisições à direita, com logs aparecendo em tempo real.
- [ ] Print do VS Code Remote SSH conectado à VM, com `app.py` aberto e o terminal integrado mostrando `pwd` retornando `/opt/giropops-status/app`.
- [ ] No `NOTAS.md`: liste os 5 comandos do Vim que você usou nesta semana e o que cada um faz.

Poste no canal da turma com a tag `#cap-03-entrega`.

## Pegadinhas frequentes

- **"Travei no Vim e não consigo sair"** → `Esc` `Esc` `Esc`, depois `:q!` e Enter. Sempre funciona.
- **`tail -f` não mostra novas linhas** → confira se `LOG_FILE` foi exportado **antes** de subir o `python3 app.py`. Variável definida só na sessão errada não vale.
- **`diff` reclama de "No such file"** → você esqueceu de fazer o `.bak` antes. Recrie o arquivo a partir do git (`git checkout app.py`) e refaça com backup desta vez.
- **Permissão negada ao editar** → você está editando como o usuário errado. Não use `chmod 777`. No cap 4 a gente arruma isso direito.

## Referências no livro

- **Capítulo 3**, seções "Lendo Antes de Editar" (`cat`, `less`, `head`, `tail`, `tail -f`, `wc`, `diff`), "Vim: o Modo Sobrevivência" (modos, `:wq`, `dd`, `u`, `/`, `:%s`), "VS Code Remote SSH" e "Expressões Regulares".
- O **Apêndice A** (Troubleshooting) tem o cenário 5 sobre Vim travado, se aparecer.

## Próximo passo

No **Capítulo 4** você sai do anonimato: cria um usuário de serviço chamado `giropops`, organiza grupos, aplica `chmod`/`chown` na estrutura, restringe o `.env` com 0600 e fecha o SSH. É o capítulo em que o servidor para de ser "tudo aberto para todo mundo".
