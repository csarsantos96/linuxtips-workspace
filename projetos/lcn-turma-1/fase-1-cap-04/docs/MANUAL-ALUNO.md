# Manual do Aluno — Fase 1 (Linux)

> Este guia é para você, aluno(a) do livro **Descomplicando Linux para Cloud Native** que vai usar o **Giropops Status** como projeto prático ao longo dos 11 capítulos.

## Como este projeto funciona

O Giropops Status é uma aplicação web real (Python/Flask + Redis) que você vai colocar para rodar em um servidor Linux, **do zero e manualmente**. Ao longo dos 11 capítulos do livro, você vai evoluindo o projeto: instalar pacotes, configurar systemd, proteger com firewall, montar Nginx reverse proxy, automatizar com shell scripts e, no cap 11, containerizar com Docker.

Cada capítulo do livro tem seu **próprio pacote `.tar.gz`** — entregue pelo instrutor conforme a turma avança. O pacote do cap 5 tem só o que faz sentido no cap 5; o cap 11 tem o conteúdo acumulado de todos os capítulos anteriores.

```
giropops-status-fase-1-cap-01.tar.gz   →  Cap 1: Setup Hibrido & SSH
giropops-status-fase-1-cap-02.tar.gz   →  Cap 2: Shell Survival
giropops-status-fase-1-cap-03.tar.gz   →  Cap 3: Edicao de Texto
giropops-status-fase-1-cap-04.tar.gz   →  Cap 4: Permissoes e Seguranca
giropops-status-fase-1-cap-05.tar.gz   →  Cap 5: APT e Systemd
giropops-status-fase-1-cap-06.tar.gz   →  Cap 6: Processos e Monitoramento
giropops-status-fase-1-cap-07.tar.gz   →  Cap 7: Storage e Filesystem
giropops-status-fase-1-cap-08.tar.gz   →  Cap 8: Streams, Pipes e Filtros
giropops-status-fase-1-cap-09.tar.gz   →  Cap 9: Networking e Firewall
giropops-status-fase-1-cap-10.tar.gz   →  Cap 10: Automacao com Shell Script
giropops-status-fase-1-cap-11.tar.gz   →  Cap 11: Containers e Projeto Final
```

> Você só recebe o pacote do próximo capítulo após **entregar** o atual. Isto é proposital: garante que o aprendizado seja sequencial e impede spoilers.

## Pré-requisitos

Os pré-requisitos reais estão no **Capítulo 0** do livro (Dia Zero). Em resumo:

- Computador com **pelo menos 8 GB de RAM** e 20 GB livres em disco
- Terminal moderno (Windows Terminal + WSL 2, iTerm2, ou qualquer terminal Linux)
- **VirtualBox** (ou UTM em Apple Silicon)
- **ISO do Ubuntu Server LTS** mais recente
- **Conta AWS Free Tier** com MFA ativo
- Conhecimento mínimo: o que é IP, porta, DNS (explicado no próprio livro)

## Fluxo de trabalho por capítulo

1. **Leia o capítulo no livro.** O roteiro, comandos e explicações estão lá.
2. **Baixe o pacote** do capítulo no canal da turma.
3. **Extraia e entre no diretório:**
   ```bash
   tar -xzf giropops-status-fase-1-cap-05.tar.gz
   cd giropops-status-fase-1-cap-05/
   ```
4. **Abra `docs/fase-1/cap-05.md`** — é o roteiro curto do "o que fazer com o giropops-status nesta semana". Ele complementa o livro, não substitui.
5. **Aplique o conteúdo do capítulo no projeto.** O livro ensina o conceito com exemplos (Nginx, scripts de teste, etc.); o roteiro diz como transferir isso para o giropops-status.
6. **Entregue** conforme indicado na seção "Entrega" do roteiro da semana.
7. **Peça o pacote do próximo capítulo** ao instrutor depois da entrega aprovada.

## Como estudar com este projeto

**Não copie e cole sem entender.** Se um comando funcionou mas você não sabe por quê, volte ao livro. Pergunte ao instrutor. Leia o `man`. Faça-o de novo manualmente.

**Quebre de propósito.** Depois que funcionou, derrube o Redis. Mude uma variável de ambiente errada. Tire permissão do diretório. Observe a aplicação reagir, encontre o erro, conserte. Isso vale dez tutoriais.

**Documente seu caminho.** Crie um arquivo `NOTAS.md` pessoal onde você anota comandos que funcionaram, erros que encontrou, o que te confundiu. Isto vira seu **runbook** pessoal — um artefato valioso na sua carreira.

**Não pule capítulos.** O capítulo 5 (systemd) só faz sentido depois dos caps 1–4. O capítulo 9 (Nginx reverse proxy) depende do cap 5 estar rodando. O capítulo 11 (Docker) é o Gran Finale — espere chegar lá.

## Critérios de avaliação por capítulo

Cada roteiro tem sua própria seção "Entrega". Em geral, esperamos que ao final de cada capítulo você consiga:

- Rodar a aplicação (ou o artefato do capítulo) conforme o objetivo
- Explicar em voz alta **o que cada comando faz** (não aceitamos "eu copiei")
- Ter registrado a evolução no seu `NOTAS.md` ou num fork do projeto
- Submeter um print/vídeo curto/commit no canal da turma

## FAQ

**Posso usar macOS/Windows nativo?**
Não. Você precisa estar operando Linux (VM local ou EC2). O livro é explicitamente prático — o aluno opera Linux real.

**Posso pular o livro e só seguir os roteiros do giropops-status?**
Não funciona. Os roteiros são **curtos de propósito**: eles assumem que você acabou de ler o capítulo do livro. Sem o livro, você não tem o contexto.

**Perdi a entrega de uma semana, posso fazer depois?**
Pode. Fale com o instrutor — o pacote da semana continua disponível.

**Posso modificar a aplicação (o `app.py`)?**
Durante cada capítulo, siga o que o roteiro pede. Depois da entrega, modifique à vontade. É seu laboratório.

**Achei um bug no projeto ou no livro.**
Avise o instrutor. Ele consolida as correções nas próximas turmas.

## Recursos extras

- **Livro** _Descomplicando Linux para Cloud Native_ — a fonte de verdade do conteúdo
- [Documentação oficial do systemd](https://systemd.io/)
- [Nginx documentation](https://nginx.org/en/docs/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [LINUXtips no YouTube](https://www.youtube.com/@LINUXtips)

---

**Bom desafio. Se embole, respire, pesquise, e tente de novo. Linux se aprende errando — e você vai errar muito. Está tudo bem.**
