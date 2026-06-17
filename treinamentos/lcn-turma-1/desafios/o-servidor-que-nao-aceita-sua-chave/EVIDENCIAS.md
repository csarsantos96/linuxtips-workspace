# Evidências — O Servidor que Não Aceita Sua Chave

> Submetido em 2026-06-17T13:33:52.191Z

## ✅ Criou usuário do time com home + shell **(obrigatório)**

- **id:** `user-criado`
- **tipo:** Comando rodado no terminal ⌨️
- **dica:** useradd -m -s /bin/bash <nome> + passwd

```
sudo adduser jeferson
```

## ✅ Gerou par de chaves SSH (ed25519 recomendado) **(obrigatório)**

- **id:** `ssh-keygen`
- **tipo:** Comando rodado no terminal ⌨️
- **dica:** ssh-keygen -t ed25519 -C 'plantão-sre'

```
ssh-keygen -t ed25519 -C "plantao-sre"
```

## ✅ Pubkey instalada em ~/.ssh/authorized_keys com permissões 700/600 **(obrigatório)**

- **id:** `authorized-keys`
- **tipo:** Arquivo no repositorio 📄
- **dica:** chmod 700 ~/.ssh + chmod 600 authorized_keys

-rw------- 1 jeferson jeferson   93 Jun 17 13:15 authorized_keys

## ✅ sshd_config: PermitRootLogin no **(obrigatório)**

- **id:** `sshd-permitroot-no`
- **tipo:** Mudanca em arquivo ✏️
- **dica:** sed -i ou vim em /etc/ssh/sshd_config

```
cp /etc/ssh/sshd_config /etc/ssh/sshd_config-seg
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
grep -n '^PermitRootLogin' /etc/ssh/sshd_config

33:PermitRootLogin no
```

## ✅ sshd_config: PasswordAuthentication no **(obrigatório)**

- **id:** `sshd-passauth-no`
- **tipo:** Mudanca em arquivo ✏️
- **dica:** mesma linha de raciocínio do anterior

```
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
grep -n '^PasswordAuthentication' /etc/ssh/sshd_config

57:PasswordAuthentication no
```

## ✅ Validou config com sshd -t ANTES do restart **(obrigatório)**

- **id:** `sshd-validacao`
- **tipo:** Comando rodado no terminal ⌨️
- **dica:** nunca restartar sshd sem testar config

```
sshd -t && echo "config OK"

config OK
```

## ✅ sshd reiniciou e está active **(obrigatório)**

- **id:** `sshd-up`
- **tipo:** Comando rodado no terminal ⌨️
- **dica:** systemctl start ssh + systemctl status ssh

```
service ssh restart
service ssh status

Restarting OpenBSD Secure Shell server: sshd.
sshd is running.
```

## ✅ Grupo dev criado + sudoers /etc/sudoers.d/dev validado **(obrigatório)**

- **id:** `grupo-dev-sudoers`
- **tipo:** Comando rodado no terminal ⌨️
- **dica:** groupadd dev + visudo -c -f /etc/sudoers.d/dev

```
echo '%dev ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/dev
chmod 440 /etc/sudoers.d/dev
visudo -c -f /etc/sudoers.d/dev
cat /etc/sudoers.d/dev

/etc/sudoers.d/dev: parsed OK
%dev ALL=(ALL) NOPASSWD:ALL
```

## ✅ ~/.ssh/config local com alias pro servidor (bônus)

- **id:** `ssh-config-local`
- **tipo:** Arquivo no repositorio 📄
- **dica:** Host staging\n  HostName ...\n  User ...

echo '%dev ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/dev
chmod 440 /etc/sudoers.d/dev
visudo -c -f /etc/sudoers.d/dev
cat /etc/sudoers.d/dev

## ✅ Relatório explicando o hardening (por que pubkey > senha)

- **id:** `relatorio`
- **tipo:** Resposta em texto 📝
- **dica:** narrativa curta

Foi criado um usuário nominal chamado jeferson, evitando uso direto do root. Também foi configurado acesso SSH por chave pública em /home/jeferson/.ssh/authorized_keys com permissões restritas.

No sshd_config, o login direto como root foi desabilitado com PermitRootLogin no, a autenticação por senha foi desativada com PasswordAuthentication no, e o uso de chave pública foi garantido com PubkeyAuthentication yes. Também foi desabilitado X11Forwarding e limitado o acesso SSH ao grupo dev com AllowGroups dev.

Esse hardening é mais seguro porque chaves SSH são muito mais difíceis de serem quebradas por força bruta do que senhas. Além disso, bloquear o root reduz o impacto de ataques diretos contra usuários privilegiados, e restringir o login ao grupo dev diminui a superfície de acesso ao servidor.
