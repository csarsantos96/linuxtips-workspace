# Capítulo 4 — Permissões e Segurança (usuário `giropops`, grupos, chmod, SSH hardening)

> **Referência:** _Descomplicando Linux para Cloud Native_, Capítulo 4.
> **Pré-requisitos:** Capítulo 3 concluído — você sabe ler arquivos, editar com Vim e acompanhar logs com `tail -f`.

## Objetivo da semana

Até agora, **tudo no `/opt/giropops-status/` está aberto** — seu usuário é dono de tudo, qualquer um no servidor poderia ler o que quisesse. Não dá. Esta semana você vai estabelecer o modelo de acesso que vai valer **até o fim da Fase 1**:

1. Criar o usuário de serviço `giropops` (sem login interativo) que vai rodar a aplicação a partir do cap 5.
2. Criar o grupo `giropops` e adicionar seu usuário humano a ele.
3. Aplicar `chown`/`chmod` corretos em `/opt/giropops-status/`, com SGID nos diretórios compartilhados.
4. Restringir o `.env` para `0600` — segredos têm que doer pra outros lerem.
5. Endurecer o SSH (`PermitRootLogin no`, `PasswordAuthentication no`).
6. Configurar sudo NOPASSWD para `systemctl restart giropops` (prepara o terreno do cap 5).

## O que fazer com o giropops-status nesta semana

### 1. Confira o estado inicial (e por que ele é ruim)

Na VM e na EC2:

```bash
ls -lah /opt/giropops-status/
ls -lah /opt/giropops-status/app/
```

Provavelmente está tudo como o **seu** usuário, com permissão `755` ou `775`. Se você criar um arquivo `.env` agora com uma senha de Redis nele, qualquer outro usuário do sistema lê. Anota mentalmente: isso é o "antes". O "depois" é o que vamos construir.

### 2. Crie o usuário e o grupo de serviço

A aplicação **não deve** rodar com seu usuário humano. Em produção (e a partir do cap 5), ela roda sob um usuário de sistema dedicado, sem shell de login. Isso limita o estrago caso a aplicação seja comprometida.

Você pode rodar manualmente os comandos abaixo **ou** usar o script que já vem no pacote (faz a mesma coisa, idempotente):

```bash
sudo /opt/giropops-status/app/scripts/setup-permissions.sh
```

Se preferir entender comando por comando (recomendado na primeira passada):

```bash
# Grupo
sudo groupadd --system giropops

# Usuario de servico (sem home pessoal, sem shell de login)
sudo useradd --system \
    --gid giropops \
    --home-dir /opt/giropops-status \
    --no-create-home \
    --shell /usr/sbin/nologin \
    giropops

# Confira
id giropops
getent passwd giropops
```

Repare na saída de `getent passwd giropops`: o shell é `/usr/sbin/nologin`. Tente logar como ele:

```bash
sudo su - giropops
```

Resposta esperada: `This account is currently not available.` É exatamente isso que queremos.

### 3. Adicione o seu usuário ao grupo `giropops`

Você (humano) ainda precisa _editar_ os arquivos do projeto. A forma profissional é entrar no grupo, não dar `777`:

```bash
sudo usermod -aG giropops $USER
```

> O `-a` é **crítico**. Sem ele, `usermod -G` **remove você dos outros grupos** (inclusive do `sudo`). Você se trancaria fora do servidor. Já avisei.

Para o grupo entrar em vigor, **abra uma nova sessão SSH**. Confira:

```bash
id
groups
```

Você deve ver `giropops` no resultado.

### 4. Aplique `chown` e `chmod` no `/opt/giropops-status`

Modelo que vamos aplicar:

| Caminho | Dono | Grupo | Modo | Por quê |
|---|---|---|---|---|
| `/opt/giropops-status/` | giropops | giropops | `2750` | SGID + dono RWX, grupo RX, outros nada |
| `/opt/giropops-status/app/` | giropops | giropops | `2750` | código — só dono escreve, grupo lê |
| `/opt/giropops-status/config/` | giropops | giropops | `2750` | configs — só dono escreve, grupo lê |
| `/opt/giropops-status/config/.env` | giropops | giropops | `0600` | **segredos** — só o dono lê |
| `/opt/giropops-status/logs/` | giropops | giropops | `2770` | logs — grupo também escreve (SGID herda grupo) |
| `/opt/giropops-status/backups/` | giropops | giropops | `2770` | backups — grupo também escreve |

Comandos (rode com `sudo` na VM e na EC2):

```bash
sudo chown -R giropops:giropops /opt/giropops-status/
sudo chmod 2750 /opt/giropops-status/{,app,config}
sudo chmod 2770 /opt/giropops-status/{logs,backups}
sudo find /opt/giropops-status -type f -exec chmod 0640 {} \;
```

Crie um `.env` real a partir do exemplo e tranque ele:

```bash
sudo install -o giropops -g giropops -m 0600 \
    /opt/giropops-status/app/.env.example \
    /opt/giropops-status/config/.env

ls -l /opt/giropops-status/config/.env
```

A saída tem que mostrar `-rw------- 1 giropops giropops`. Esse é o `0600` que protege o segredo.

### 5. Confirme que o SGID está funcionando

Logado como você (no grupo `giropops`), crie um arquivo dentro de `logs/` e veja o **grupo** dele:

```bash
cd /opt/giropops-status/logs/
touch teste-sgid.log
ls -l teste-sgid.log
```

Saída esperada: o **grupo** do arquivo é `giropops`, **não** o seu grupo primário. Isso é o SGID em ação — o `2` na frente do `770` no diretório fez o arquivo herdar o grupo do diretório, e não o seu grupo primário. Sem isso, daqui a um capítulo, um processo do `giropops` e outro do seu usuário humano não conseguiriam escrever no mesmo log sem briga.

Limpe o teste:

```bash
rm teste-sgid.log
```

### 6. Por que `chmod 777` está banido (prove para si mesmo)

Tente, **só para entender**, o que aconteceria. Crie um arquivo com 777:

```bash
sudo touch /tmp/coisa-aberta
sudo chmod 777 /tmp/coisa-aberta
ls -l /tmp/coisa-aberta
```

Permissão `-rwxrwxrwx`: qualquer usuário do sistema lê, escreve e executa. Agora imagine que esse arquivo é o seu `.env` com a senha do Redis. Qualquer processo comprometido (até um `www-data` invadido) leria essa senha. Por isso `0600` no `.env` não é exagero — é o **mínimo**.

Apague o experimento:

```bash
sudo rm /tmp/coisa-aberta
```

### 7. Sudo NOPASSWD para `systemctl` da aplicação (prepara o cap 5)

No cap 5 você vai usar `sudo systemctl restart giropops` várias vezes para testar mudanças. Você **não** vai querer digitar senha a cada vez. Mas também **não** vai liberar NOPASSWD para tudo — só pro que precisa.

Edite o sudoers de forma segura:

```bash
sudo visudo -f /etc/sudoers.d/giropops
```

Cole (substitua `seu-usuario` pelo seu login):

```
seu-usuario ALL=(root) NOPASSWD: /bin/systemctl restart giropops, /bin/systemctl status giropops, /bin/systemctl start giropops, /bin/systemctl stop giropops, /bin/journalctl -u giropops*
```

Salve e saia. O `visudo` valida a sintaxe antes de gravar — se errou, ele avisa e oferece corrigir. **Nunca** edite o sudoers com `vim` direto.

Teste agora (o serviço ainda não existe, mas o sudo já deve aceitar sem pedir senha):

```bash
sudo systemctl status giropops
```

Você vai ver "Unit giropops.service could not be found" — perfeito. O importante é que **não pediu senha**.

### 8. SSH hardening

Backup primeiro (cap 3):

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo vim /etc/ssh/sshd_config
```

Garanta as três linhas (use `/Diretiva` no Vim para buscar):

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Salve (`:wq`) e aplique:

```bash
sudo systemctl restart ssh
```

> **Regra de sobrevivência:** mantenha a sessão SSH atual aberta. Abra uma **segunda** sessão e teste a conexão com a nova configuração. Se a segunda funcionar, fecha tudo tranquilo. Se não funcionar, você ainda tem a primeira aberta para reverter. Já vi gente perder uma EC2 inteira por não fazer isso.

Confira o que mudou:

```bash
diff /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
```

## Novidades do pacote desta semana

- `scripts/setup-permissions.sh` — automatiza criação de usuário/grupo e aplicação das permissões. Idempotente: pode rodar de novo sem quebrar.
- `scripts/health-check.sh` — wrapper de `curl /health` com exit codes (vai ser usado no cap 5 dentro do `systemd` e no cap 10 dentro de cron).

## Entrega

- [ ] `id giropops` retorna `uid=... gid=...(giropops) groups=...(giropops)` **com shell nologin**.
- [ ] `ls -ld /opt/giropops-status/{app,config,logs,backups}` mostra modo `2750` ou `2770` conforme a tabela.
- [ ] `ls -l /opt/giropops-status/config/.env` mostra `-rw-------` (0600) com dono `giropops`.
- [ ] `groups` (no seu usuário) lista `giropops` entre os grupos.
- [ ] `sudo systemctl status giropops` **não pede senha** (mesmo retornando que o service não existe).
- [ ] `diff /etc/ssh/sshd_config.bak /etc/ssh/sshd_config` mostra `PermitRootLogin no` e `PasswordAuthentication no`.
- [ ] Você consegue criar arquivo em `/opt/giropops-status/logs/` e o grupo dele é `giropops` (prova do SGID).

Print de todos os comandos acima no canal da turma com tag `#cap-04-entrega`.

## Pegadinhas frequentes

- **`Permission denied` ao tentar `cd /opt/giropops-status/`** → você não entrou em uma nova sessão SSH depois do `usermod -aG`. Saia e entre de novo.
- **"Mas o arquivo é meu, por que não consigo deletar?"** → para deletar um arquivo, você precisa de `w` **no diretório**, não no arquivo. Veja `ls -ld` do diretório pai.
- **`sudo` parou de funcionar** → você esqueceu o `-a` no `usermod -G sudo`. Use o usuário root recovery do provedor (na AWS, console + EC2 Instance Connect) ou restaure de snapshot.
- **`sshd_config` mudou e agora não consigo entrar** → ainda tem a primeira sessão aberta? Volte nela, restaure o `.bak`, `systemctl restart ssh`. Por isso a regra das duas sessões.

## Referências no livro

- **Capítulo 4**, seções "Root vs Mortais", "Gerenciando Usuários e Grupos" (`adduser`/`useradd`, `usermod -aG`, `id`), "O Guardião: Sudo" (`visudo`, NOPASSWD), "Entendendo Permissões (RWX)", "Umask", "SUID, SGID e Sticky Bit", "Hardening SSH".
- O **Apêndice A** (Troubleshooting) tem cenários sobre `Permission denied` e SSH inacessível.

## Próximo passo

No **Capítulo 5** a aplicação finalmente **roda como serviço**. Você vai instalar Redis via `apt`, criar o `giropops.service` no systemd, configurar `Environment=` apontando para o `/opt/giropops-status/config/.env` que você acabou de trancar com `0600`, e habilitar o boot automático. Tudo o que você fez aqui vira a fundação ali.
