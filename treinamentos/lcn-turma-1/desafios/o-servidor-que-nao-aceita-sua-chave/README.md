# O Servidor que Não Aceita Sua Chave
Você assumiu time SRE. O staging tem sshd inseguro herdado. Hardene e abra acesso pro time.
---
## Instrucoes

# 🔐 O Servidor que Não Aceita Sua Chave

> **Cenário:** Você assumiu o time SRE. Te entregaram o IP de um servidor staging
> mas você ainda não tem acesso. O sshd_config que você herdou tá vergonhoso —
> PasswordAuth ligado, PermitRootLogin yes. Vai dar palestra de segurança pro time
> na sexta. Comece pelo próprio servidor.

## Sua missão em 4 passos

1. **Crie seu usuário** no servidor (ex: `jeferson`) com home + bash + senha forte.
2. **Gere um par de chaves SSH** (preferencialmente ed25519) e adicione a pública
   em `~/.ssh/authorized_keys` do seu usuário.
3. **Hardene o sshd_config**: desliga `PermitRootLogin`, desliga
   `PasswordAuthentication`, deixa só `PubkeyAuthentication yes`. Valida com
   `sshd -t` antes de subir.
4. **Configure o grupo `dev`** + sudoers em `/etc/sudoers.d/dev` permitindo
   sudo sem senha pra membros do grupo.

Sobe o sshd com `systemctl start ssh` e confirma `systemctl status ssh` active.

## Como entregar

Pra cada ação, cole no painel de evidências:
- Comando rodado
- Output relevante (status do serviço, conteúdo de arquivos chave)

## Dicas

- `ssh-keygen -t ed25519` gera par moderno e curto.
- `ssh-copy-id` não vai funcionar pq sshd tá desligado — você vai escrever o
  authorized_keys na unha (`echo "<pub>" >> /home/jeferson/.ssh/authorized_keys`).
- Permissões do `~/.ssh` precisam ser **rigorosas**: `700` na pasta, `600` no
  authorized_keys. Sshd recusa se tiverem permissivas demais.
- `sshd -t` testa o config sem rodar — use SEMPRE antes de restart.
- `visudo -c -f /etc/sudoers.d/dev` valida sintaxe do sudoers.

## Tom

Esse é o seu primeiro passo de SRE — não tem como pular. Se um item da
checklist ficou no escuro, volta no Módulo 1 e relê.

---
*Desafio LINUXtips - lcn-turma-1*