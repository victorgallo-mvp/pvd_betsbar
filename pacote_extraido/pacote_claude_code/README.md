# Pacote para Claude Code — Sistema PDV

## Como usar

1. Abre o terminal na pasta onde vai criar o projeto:
   ```bash
   mkdir pdv && cd pdv
   claude
   ```

2. No Claude Code, arrasta TODA a pasta `pacote_claude_code/` no chat (ou seleciona todos os arquivos)

3. Manda esta mensagem inicial:
   > "Lê o `PROMPT.md`, analisa as imagens em `frames/` e as transcrições em `transcricoes/`. Depois confirma o entendimento e começa pela Fase 1."

## O que tem aqui

- `PROMPT.md` — instruções completas (stack, fluxos, regras, schema, ordem de implementação)
- `frames/` — 10 capturas das telas do sistema de referência
- `transcricoes/` — 4 narrações dos vídeos de demo (em PT-BR, com timestamps)
