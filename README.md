# RPG SaaS

A web platform for tabletop RPG players and game masters — built to handle everything that happens around the table, digitally.

## The Problem

Running a tabletop RPG session online is fragmented. Game masters juggle spreadsheets for campaign notes, image editors for maps, separate dice rollers, and chat apps just to share character sheets. Players have no single place to manage their characters, and finding a community to share custom content with is even harder.

## What We're Building

A collaborative platform where game masters and players can run full RPG sessions without leaving the browser.

**For game masters**, that means creating and managing campaigns, building interactive maps, controlling NPCs, monsters, allies and villains through their own character sheets, and keeping a full view of every player's stats and progression at all times.

**For players**, that means having a character sheet tailored to whatever system they're playing — D&D, Call of Cthulhu, or anything in between — moving their character on the shared map, rolling dice, and having everything sync in real time with the rest of the table.

**For the community**, that means a place to contribute. Upload custom artwork for characters and map tokens. Create and share full character sheet templates for any RPG system — official or homebrew. If someone wants to run a Naruto-themed campaign and builds the system for it, anyone else who wants to play it can just pick it up and go.

## Who It's For

Anyone who plays tabletop RPGs online and is tired of stitching together five different tools to run a single session. Whether you're a veteran game master running weekly campaigns or a player sitting down for your first adventure.

## Status

Currently in early development.

## Desenvolvimento local

Backend (NestJS) e frontend (Next.js) rodam na sua máquina, mas o banco de dados, o Redis e o Mongo continuam sendo os serviços do ambiente **dev** no Railway — nada muda no fluxo de deploy (push → Railway + Vercel).

### Pré-requisitos

- Node.js >= 22.12.0
- Connection strings **públicas** do ambiente dev do Railway (aba *Data/Connect* no dashboard do projeto). URLs `*.railway.internal` **não** funcionam fora da rede do Railway.

### Configuração

1. **Servidor** — em `server/.env` (arquivo gitignored, nunca vai pro deploy):
   - `DATABASE_URL` — connection string pública do Postgres do ambiente **dev**
   - `MONGO_URL` — connection string pública do Mongo (armazenamento de imagens)
   - `REDIS_URL` — connection string pública do Redis (rate limiting + cache)
2. **Frontend** — em `client/.env.local` (gitignored), o valor local já está pronto:
   - `NEXT_PUBLIC_API_URL=http://localhost:3001/api`

### Rodando

```bash
npm install          # raiz (orquestrador) — ou `npm run setup` para instalar tudo
npm run dev          # sobe backend (porta 3001) e frontend (porta 3000) juntos
# ou separado: npm run dev:server / npm run dev:client
```

### E quando subir pra produção?

Nada muda: `git push` continua deployando igual hoje (Railway para o `server/`, Vercel para o `client/`). Os arquivos `.env` locais são gitignored e não afetam os deploys
