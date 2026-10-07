# Capítulo 1 — Setup Híbrido (VM + EC2) & SSH

> **Referência:** _Descomplicando Linux para Cloud Native_, Capítulo 1.
> **Pré-requisitos:** Capítulo 0 (Dia Zero) concluído — VirtualBox instalado, conta AWS Free Tier ativa, Ubuntu ISO baixada.

## Objetivo da semana

Preparar **dois ambientes Linux** que vão hospedar o Giropops Status durante todo o curso:

1. Uma **VM local** (Ubuntu Server no VirtualBox) — seu laboratório sem risco
2. Uma **EC2 t2.micro na AWS** — seu ambiente de "produção"

Ao final da semana você deve conseguir abrir dois terminais simultâneos — um conectado a cada ambiente — e rodar `apt update` nos dois.

## Por que dois ambientes?

O livro segue uma filosofia híbrida: tudo que você aprende vai ser praticado **na VM primeiro** (onde quebrar é grátis) e **replicado na EC2** (onde é o ambiente real). Neste capítulo você só monta o setup. Nos próximos, vai usar os dois.

## O que fazer com o giropops-status nesta semana

**Nada além de guardar o pacote.** Neste capítulo o projeto ainda não é instalado — você está preparando a casa que vai recebê-lo.

Os arquivos da aplicação (`app.py`, `templates/`, `static/`, `requirements.txt`) já estão neste pacote. Eles ficam em stand-by até o Capítulo 2, quando você vai transferi-los para o servidor.

## Checklist da semana (capítulo 1 do livro)

- [ ] VM local criada no VirtualBox (ou UTM) com Ubuntu Server LTS
- [ ] EC2 t2.micro provisionada na AWS, Free Tier confirmado
- [ ] Key pair SSH criada (`ssh-keygen` se ainda não tiver)
- [ ] `~/.ssh/config` com aliases para `vm` e `ec2`
- [ ] `ssh-copy-id` funcionando nos dois ambientes
- [ ] Consegue abrir dois terminais em paralelo e rodar `apt update` em ambos
- [ ] (Bonus) `rsync` testado entre as máquinas

## Entrega

Print ou vídeo curto mostrando:

1. Dois terminais lado a lado, um na VM local e outro na EC2
2. Ambos com `apt update` executando com sucesso
3. `cat ~/.ssh/config` no seu notebook mostrando os aliases dos dois hosts

Poste no canal da turma com a tag `#cap-01-entrega`.

## Próximo passo

No **Capítulo 2** você vai sair do diretório home e aprender a navegar o sistema como um profissional. Lá começa a estrutura de diretórios do projeto em `/opt/giropops-status/`.

## Referências no livro

- **Capítulo 1**, seções "VirtualBox Headless", "EC2 Free Tier", "SSH config file", "ssh-copy-id", "rsync".
- Se SSH travou ou não conecta, veja também o **Apêndice A** (Troubleshooting) — cenários 1 a 4.
