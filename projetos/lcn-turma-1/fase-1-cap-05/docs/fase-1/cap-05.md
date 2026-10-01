# Capítulo 5 — Pacotes (APT) e Systemd (a virada do projeto)

> **Referência:** _Descomplicando Linux para Cloud Native_, Capítulo 5.
> **Pré-requisitos:** Capítulo 4 concluído — você tem o usuário `giropops` criado, o diretório `/opt/giropops-status/` com `chown` e `chmod` corretos, sudo NOPASSWD para `systemctl ... giropops`, e SSH com hardening aplicado.

## Objetivo da semana

Até agora você rodava o `app.py` na unha: abria o terminal, ativava um ambiente Python qualquer, dava `python app.py` e ficava com o processo preso à sua sessão SSH. Se a sessão caía, a aplicação morria junto. Se a VM reiniciava, ninguém subia nada. Isso é amador — e era proposital, pra você sentir o problema.

Esta semana você vira o jogo:

1. Instalar dependências (Python 3, virtualenv, Redis) com **APT** — versões assinadas, com dependências resolvidas.
2. Criar um **virtualenv dedicado** em `/opt/giropops-status/venv` com `requirements.txt` instalado.
3. Garantir que o **Redis está rodando como serviço systemd** (já vem instalado como `redis-server.service`).
4. Escrever a **unit file** `/etc/systemd/system/giropops-status.service` rodando como `giropops` (sem login), com `Restart=on-failure` e dependência do Redis.
5. Habilitar no boot com `systemctl enable --now`.
6. **Prova de fogo:** `sudo reboot`. A aplicação volta sozinha, sem você fazer nada.

Quando você fechar este capítulo, o giropops-status é um **serviço de sistema de verdade**. Igual ao SSH, igual ao Nginx, igual ao Redis. Reinicia o servidor, volta. Crasha o processo, volta. Logs centralizados no journalctl, gerenciamento via `systemctl`. Esse é o padrão profissional.

## O que fazer com o giropops-status nesta semana

### 1. Instale as dependências de sistema

Na VM e na EC2:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip redis-server
```

Confira o que foi parar onde:

```bash
which python3      # /usr/bin/python3
which redis-cli    # /usr/bin/redis-cli
dpkg -L redis-server | grep -E 'systemd|service$'
# Repare: o pacote já trouxe um redis-server.service pronto.
```

> **Pegadinha clássica:** se `apt install` reclamar de **lock** (`Could not get lock`), **não delete** o arquivo de lock. Rode `ps aux | grep -E 'apt|dpkg'` pra descobrir quem está usando. Geralmente é o `unattended-upgrades` rodando em background — espere 1–2 min e tente de novo.

### 2. Suba o Redis como serviço

O `apt install redis-server` já enable o serviço por padrão no Ubuntu, mas confirme tudo na mão pra entender o que está ligado:

```bash
sudo systemctl enable --now redis-server
systemctl status redis-server
```

Você deve ver bolinha verde, `Active: active (running)`, `Loaded: ... enabled`. Teste a comunicação:

```bash
redis-cli ping
# PONG
```

Se vier `PONG`, o Redis está vivo e ouvindo em `localhost:6379` (o default). É o que o `.env` do giropops aponta.

### 3. Crie o virtualenv da aplicação

A regra de ouro do Python em servidor: **nunca rode com `pip install` no Python do sistema**. Você quebra dependências de pacotes do próprio Ubuntu. Sempre um virtualenv dedicado por aplicação.

O virtualenv vai morar **dentro** de `/opt/giropops-status/`, junto com o resto da aplicação. Como o dono é `giropops` (cap 4), você cria o venv **como o `giropops`**, não como você nem como root:

```bash
sudo -u giropops python3 -m venv /opt/giropops-status/venv

# Confira
ls -la /opt/giropops-status/venv/
# Tudo dono do giropops:giropops
```

Agora instale as deps do projeto dentro do venv. O `pip` do venv (`venv/bin/pip`) é o **único** que você usa — nunca o `pip` do sistema:

```bash
sudo -u giropops /opt/giropops-status/venv/bin/pip install \
    --no-cache-dir -r /opt/giropops-status/app/requirements.txt
```

Verifique:

```bash
sudo -u giropops /opt/giropops-status/venv/bin/pip list
# Você deve ver flask, redis, requests, prometheus_client
```

> **Por que `--no-cache-dir`?** Servidor de produção não precisa de cache de wheels do pip ocupando espaço. Em VM com 20 GB, isso conta.

### 4. Confirme o `.env` em `/opt/giropops-status/config/.env`

Você já criou esse arquivo no cap 4 (com permissão `0640` ou `0600`, dono `giropops:giropops`). Reconfirme que ele existe e tem as variáveis mínimas:

```bash
sudo cat /opt/giropops-status/config/.env
```

Mínimo esperado (use o `linux/config/env.example` do pacote como referência):

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
APP_PORT=5000
LOG_LEVEL=INFO
FLASK_DEBUG=false
```

Se faltar algo, abra com `sudo -u giropops vim /opt/giropops-status/config/.env` e ajuste.

### 5. Escreva a unit file do giropops-status

Esse é o coração da semana. O pacote desta semana trouxe o template pronto em `linux/systemd/giropops-status.service`. **Copie pro lugar oficial do systemd** (sempre `/etc/systemd/system/` pra serviços que você cria — nunca `/lib/systemd/system/`, que é território da distro):

```bash
sudo cp /opt/giropops-status/app/linux/systemd/giropops-status.service \
        /etc/systemd/system/giropops-status.service
```

Abra e leia linha por linha (você precisa **entender** o que cada diretiva faz, não copiar e rezar):

```bash
sudo cat /etc/systemd/system/giropops-status.service
```

Anote mentalmente:

| Diretiva | Por quê |
|---|---|
| `After=network-online.target redis-server.service` | só sobe depois que a rede está online E o Redis subiu |
| `Wants=redis-server.service` | dependência fraca: se o Redis falhar, o systemd não derruba a app junto (ela vai degradar elegantemente) |
| `User=giropops` / `Group=giropops` | roda sob o usuário de serviço do cap 4, sem login, sem shell |
| `WorkingDirectory=/opt/giropops-status/app` | onde o Python procura `app.py` e arquivos relativos |
| `EnvironmentFile=/opt/giropops-status/config/.env` | carrega o `.env` (segredos não vão pro unit file!) |
| `ExecStart=/opt/giropops-status/venv/bin/python app.py` | Python do **venv**, não do sistema |
| `Restart=on-failure` / `RestartSec=5` | se crashar, espera 5s e sobe de novo |
| `NoNewPrivileges=true` | nenhum filho consegue escalar privilégios via setuid |
| `ProtectSystem=strict` + `ReadWritePaths=...` | filesystem inteiro read-only pra app, exceto os paths liberados |

### 6. Ative o serviço

Toda vez que você cria ou altera um `.service`, o systemd precisa **reler** as definições:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now giropops-status
```

> O `enable --now` é o atalho: liga **agora** e marca pra subir no boot. Equivale a `enable` + `start` num comando só.

### 7. Valide

```bash
# Status humano (bolinha verde, active, PID, últimas linhas de log)
systemctl status giropops-status

# Confirma que está enable no boot
systemctl is-enabled giropops-status   # enabled

# Logs em tempo real
journalctl -u giropops-status -f
# (Ctrl+C pra sair)

# Health check da própria aplicação
curl http://localhost:5000/health
# Esperado: {"status":"healthy","redis":"ok",...}

# Wrapper de health check do projeto (cap 4)
/opt/giropops-status/app/scripts/health-check.sh
# [OK]  HTTP 200 - aplicacao saudavel
```

Se vier `200` no `/health`, você tem um serviço de sistema rodando.

### 8. Prova de fogo: o reboot

A diferença entre amador e profissional é o que acontece depois do reboot. Vamos provar:

```bash
sudo reboot
```

Aguarde 1–2 minutos. SSH de volta na VM. **Sem** ativar venv, **sem** rodar comando, **sem** subir nada:

```bash
systemctl status giropops-status
curl http://localhost:5000/health
```

Se voltou sozinho, você ganhou. Esse é o contrato do systemd. O serviço sobrevive a reboots, a crashes, e vai estar lá daqui a um ano se ninguém mexer.

### 9. Bônus — quebre de propósito (pra entender o `Restart=on-failure`)

Mate o processo na mão e veja o systemd ressuscitar:

```bash
# Pegue o PID
systemctl show -p MainPID --value giropops-status

# Mate
sudo kill -9 <PID>

# Espere 5s (RestartSec) e confira
sleep 6 && systemctl status giropops-status
journalctl -u giropops-status -n 20 --no-pager
```

Você vai ver o systemd registrando o `Main process exited`, esperando o `RestartSec`, e iniciando de novo. Isso é o que faz a sua aplicação ser **resiliente a falhas transitórias** sem nenhuma linha de código extra.

## Novidades do pacote desta semana

- `linux/systemd/giropops-status.service` — unit file pronto pra copiar pra `/etc/systemd/system/`. Use exatamente como vem; alterações você faz via **drop-in override** (`sudo systemctl edit giropops-status`), nunca editando o arquivo direto.
- `linux/config/env.example` — referência das variáveis de ambiente em formato pronto pra produção (`/opt/giropops-status/config/.env`).

> **Drop-in override é o jeito certo de customizar.** Quer mudar `MemoryMax`, adicionar uma `Environment=`, trocar o `Restart=`? Use `sudo systemctl edit giropops-status`. Suas mudanças ficam em `/etc/systemd/system/giropops-status.service.d/override.conf` e sobrevivem à próxima vez que você sobrescrever o template original.

## Entrega

- [ ] `apt list --installed | grep -E 'python3|redis-server'` mostra ambos instalados.
- [ ] `systemctl is-enabled redis-server` retorna `enabled` e `systemctl is-active redis-server` retorna `active`.
- [ ] `ls -la /opt/giropops-status/venv/bin/python` existe e é do `giropops:giropops`.
- [ ] `sudo -u giropops /opt/giropops-status/venv/bin/pip list | grep -i flask` mostra Flask instalado.
- [ ] `ls -l /etc/systemd/system/giropops-status.service` existe.
- [ ] `systemctl is-enabled giropops-status` retorna `enabled`.
- [ ] `systemctl status giropops-status` mostra `Active: active (running)`.
- [ ] `curl http://localhost:5000/health` retorna `200 OK` com JSON `{"status":"healthy",...}`.
- [ ] **Após `sudo reboot`**, o serviço volta sozinho — `systemctl status` mostra `active` sem você ter feito nada.

Print de todos os comandos no canal da turma com tag `#cap-05-entrega`. Faça o print **depois** do reboot — sem isso, a entrega não conta.

## Pegadinhas frequentes

- **`status=203/EXEC` no `systemctl status`** → o `ExecStart` aponta pra um binário que não existe. Confira o caminho do Python no venv: `ls /opt/giropops-status/venv/bin/python`.
- **`status=200/CHDIR`** → `WorkingDirectory=` aponta pra um diretório que não existe ou o `giropops` não pode entrar (sem `x` no diretório). `ls -ld /opt/giropops-status/app`.
- **`ModuleNotFoundError: No module named 'flask'`** → você instalou o `pip install` no Python do sistema em vez do venv. Reinstale com `sudo -u giropops /opt/giropops-status/venv/bin/pip install -r ...`.
- **`Connection refused` ao chamar `/health`** → o serviço crashou. `journalctl -u giropops-status -n 50 --no-pager` mostra o stacktrace. Quase sempre é Redis fora do ar ou `.env` com variável faltando.
- **`Permission denied` lendo o `.env`** → o `EnvironmentFile=` precisa que o usuário do serviço (`giropops`) consiga ler o arquivo. Confira: `ls -l /opt/giropops-status/config/.env` deve mostrar dono `giropops`. Se você criou ele como outro usuário, `sudo chown giropops:giropops` resolve.
- **Esqueceu o `daemon-reload` depois de editar o `.service`** → systemd ainda está com a versão antiga em memória. Rode `sudo systemctl daemon-reload` antes do próximo `restart`.
- **Após reboot, o serviço não voltou** → você esqueceu o `--now` ou só rodou `start`. Confira com `systemctl is-enabled giropops-status`. Se vier `disabled`, rode `sudo systemctl enable giropops-status`.

## Referências no livro

- **Capítulo 5**, seções: "O Gerenciador de Pacotes (APT)" (5.1), "Systemd: O Dono da Casa" (5.3), "Systemd Avançado: Dependências, Targets e Boot" (5.4), "Logs Modernos: Journalctl" (5.5), "Criando seu Próprio Serviço" (5.6) — especialmente o exemplo da API Flask, que é praticamente o que você está fazendo com o giropops-status.
- **Capítulo 4** (anterior): por que o `User=giropops` na unit file só funciona porque você fez o setup do usuário de serviço lá.
- **Apêndice A** (Troubleshooting): cenários de `systemctl status` falhando.

## Próximo passo

No **Capítulo 6** você aplica `htop`, `ps`, `strace`, `lsof` e sinais Unix **sobre esse serviço que acabou de subir**. Vai matar o processo de propósito, ver o `Restart=on-failure` agir, simular carga com `curl` em loop e observar no `htop`, configurar `MemoryMax=256M` via `systemctl edit` (drop-in override em ação) e ver o systemd cortar o processo quando estourar. Tudo isso só é possível porque, esta semana, você fez o giropops virar **serviço de verdade**.
