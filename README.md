# Doctor Appointment Booking System

A phone-based clinic appointment booking system built end-to-end via an **Agentic SDLC cycle** using Claude Agent Mode.

Receptionists receive calls, open the browser UI, and book, cancel, or reschedule patient appointments. Patients receive an automatic SMS confirmation after every action.

---

## Quick Start

```bash
# 1 — Copy env file and fill in your values
cp .env.example .env

# 2 — Start the database
docker compose up -d db

# 3 — Run migrations and seed
cd backend
npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appointments \
  npx prisma migrate deploy && npx prisma db seed

# 4 — Generate a bcrypt hash for the receptionist password
node scripts/hash-password.js admin123
# → copy the hash into .env as RECEPTIONIST_PASSWORD_HASH

# 5 — Start the API (port 4000)
npm run dev

# 6 — Start the frontend (port 3000, new terminal)
cd ../frontend && npm install && npm run dev
```

Open **http://localhost:3000** — log in with `receptionist / admin123`.

---

## Running Tests

```bash
cd backend
npm test              # 109 unit + integration tests
```

```bash
node scripts/check-docs.js   # 181 document quality checks
```

---

## Project Documents

| Document | Purpose |
|---|---|
| [requirements.md](artifacts/requirements.md) | FR-01–FR-08 and NFR-01–NFR-08 |
| [architecture.md](artifacts/architecture.md) | System design, ER diagram, ADRs |
| [design-review.md](artifacts/design-review.md) | Pre-code architecture review (12 findings) |
| [impl-plan.md](artifacts/impl-plan.md) | 41-task dependency-ordered implementation plan |
| [code-review.md](artifacts/code-review.md) | Post-implementation peer review (10 findings, all fixed) |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Architecture

```
Browser (Receptionist)
  └── React 18 + Tailwind CSS
        └── POST/GET/PATCH /api/*
              └── Express 4 + Prisma 5
                    ├── PostgreSQL 16  (appointments, doctors, SMS logs)
                    └── Twilio SMS API (patient notifications)
```

Key design decisions: [architecture.md § ADRs](artifacts/architecture.md#10-key-architecture-decisions)

---

## Departments & Doctors (seeded)

| Department | Doctors |
|---|---|
| Cardiology | Dr. Arjun Mehta, Dr. Nisha Kapoor |
| General Medicine | Dr. Priya Sharma, Dr. Suresh Iyer |
| Bone Health | Dr. Rajesh Patel, Dr. Ananya Bose |

---

## Environment Variables

See [.env.example](.env.example) for all required variables. Key ones:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing secret (required in production) |
| `PHONE_ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM phone encryption |
| `PHONE_HMAC_SECRET` | HMAC secret for phone number lookup hashing |
| `TWILIO_*` | Twilio credentials (leave blank to disable SMS in dev) |

---

## CI / CD

GitHub Actions workflows in [`.github/workflows/`](.github/workflows/):

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | Pull requests to `main` and pushes to `main` | Backend tests · Doc quality · Frontend build |

Claude Agent definitions are in [`.claude/agents/`](.claude/agents/). Shared and stage-specific instructions are in [`.claude/instructions/`](.claude/instructions/), shared and path-scoped rules are in [`.claude/rules/`](.claude/rules/), and reusable project skills are in [`.claude/skills/`](.claude/skills/) as `SKILL.md` files. Agent hooks are in [`.claude/hooks/`](.claude/hooks/); every agent runs `pre-tool-guard.js` before shell and file-write tools to block broad staging, force pushes, destructive resets/cleans, and writes to secret files. Pre- and post-merge check instructions are in [`.github/hooks/`](.github/hooks/).

### GitHub MCP server (Claude Code)

The shared [`.mcp.json`](.mcp.json) gives Claude Code (and the `pr-creator` agent) the GitHub MCP server. It contains no token or account details; each developer supplies their own fine-grained GitHub personal access token through an environment variable:

1. Install and start Docker (the server runs as `ghcr.io/github/github-mcp-server`).
2. Create a GitHub PAT with access to this repository (Contents, Pull requests, and Issues read/write).
3. Set the token in your shell before launching Claude Code — never commit it:
   - PowerShell: `$env:GITHUB_PERSONAL_ACCESS_TOKEN = Read-Host -AsSecureString "GitHub PAT" | ConvertFrom-SecureString -AsPlainText` (PowerShell 7+)
   - bash/zsh: `read -rs GITHUB_PERSONAL_ACCESS_TOKEN && export GITHUB_PERSONAL_ACCESS_TOKEN`
4. Run `claude` in the repo and approve the `github` project server when prompted. Check it with `/mcp`.

If the variable is not set, Claude Code shows a missing-variable warning for the `github` server in `/mcp`.

---

## Agentic SDLC Cycle

This project was built following a structured agentic cycle:

1. **Requirements** — Clarifying Q&A → `artifacts/requirements.md`
2. **Architecture** — Component diagrams, tech choices, ADRs → `artifacts/architecture.md`
3. **Design Review** — Pre-code review of architecture (12 findings) → `artifacts/design-review.md`
4. **Implementation Plan** — 41 dependency-ordered tasks → `artifacts/impl-plan.md`
5. **Implementation** — Full backend + frontend (53 files, ~7,500 LOC)
6. **Code Review** — Peer review (10 findings, all fixed) → `artifacts/code-review.md`
7. **Tests** — 109 Jest tests + 181 doc checks
8. **PR** — This pull request, created by Claude Agent Mode

---

*Built with [Claude Agent Mode](https://claude.ai/code) · Anthropic*
