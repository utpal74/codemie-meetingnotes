# Local Deployment Runbook - EPMCDMETST-69392

Receptionist manages appointments + patient SMS notifications
Branch: `feature/EPMCDMETST-69392-meetingnotes` - Stage 6 (DevOps)

Status legend: steps marked **[TO BE VERIFIED BY A HUMAN]** were NOT executed by the author (no Postgres running, docker daemon had only unrelated containers). Only the items in section 1.4 were actually run.

## 1. Review outcome and what was actually checked

### 1.1 Infrastructure delta of this ticket (checked with `git diff origin/main...HEAD`)

| Item | Result |
|---|---|
| `backend/prisma/` (schema + migrations) | no change - no new migration to apply |
| `.env.example` / env vars read by code | no new variables. Twilio vars stay optional |
| `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` | unchanged, reviewed, correct (see 1.3) |
| `backend/package.json`, `frontend/package.json` | unchanged. The new Playwright package is isolated in `frontend/e2e/package.json` and is not part of any image |
| Backend source | changed (AppointmentService, NotificationService, routes, schemas, errors) - picked up by rebuilding the `api` image |
| Frontend source | changed (BookingForm, CancelReschedule, SmsBanner, useSmsStatus) - picked up by rebuilding the `frontend` image |

### 1.2 Changes made in this stage (small, defect-driven)

1. **Password hash corrupted by Docker Compose (real defect, reproduced).** `docker-compose.yml` loads `.env` through `env_file`. Compose expands `$name` in values, so an unquoted bcrypt hash (`$2b$10$...`) is mangled; `docker compose config` printed `The "W067FU19fpt6QZWzObWZ" variable is not set` for this checkout's `.env`. In full-Docker mode the receptionist login would then fail. Verified in a temp directory that the single-quoted form `RECEPTIONIST_PASSWORD_HASH='$2b$10$...'` passes through Compose intact and is still read correctly by `xargs` (run.sh) and by dotenv.
   - `scripts/run.sh`: writes the generated hash single-quoted and quotes an existing unquoted hash.
   - `scripts/run.ps1`: same, and `Import-EnvFile` now strips matching surrounding quotes (the PowerShell loader did not).
   - `backend/scripts/hash-password.js`: prints the line single-quoted.
   - `.env.example`: comment explaining the quoting requirement.
2. **`docker-compose.yml`**: removed the obsolete `version: '3.9'` key (Compose warned it is ignored) and pinned `name: doc-appointment-booking`. Reason: `backend/__tests__/setup/globalSetup.js` runs `docker exec doc-appointment-booking-db-1 psql ...`; with no fixed name Compose derives the project name from the folder (`codemie-meetingnotes`), the container becomes `codemie-meetingnotes-db-1`, and `npm test` / `npm run test:integration` fail in globalSetup. Side effect: the data volume becomes `doc-appointment-booking_pg_data`; a volume created earlier under the old project name is orphaned (dev data only - remove with `docker volume rm <old>_pg_data` if wanted).

### 1.3 Reviewed and left unchanged

- `backend/Dockerfile`: node:20-alpine, `prisma generate` at build, CMD runs `prisma migrate deploy && prisma db seed && node src/server.js`. Seed is idempotent (upsert departments, find-or-create doctors), so restarts are safe.
- `frontend/Dockerfile` + `nginx.conf`: multi-stage Vite build served by nginx on 3000; `/api` and `/health` are proxied to `api:4000`; SPA fallback via `try_files`. The frontend client uses relative `/api`, so `VITE_API_URL` in compose is unused (harmless).
- Known minor, not changed: in `./scripts/run.sh --docker` the script `wait` returns immediately and the EXIT trap prints "Shutting down" while the containers keep running (started with `-d`). Use `--stop` to stop them. `--docker` mode needs `backend/node_modules` (bcrypt) only to generate a missing hash.

### 1.4 Commands actually executed in this stage

| Command | Real result |
|---|---|
| `git status`, `git log -3`, `git diff --name-only origin/main...HEAD` | on the feature branch, commits bfcdbfa / 9685195 / f705899 present; no infra/schema/env files in the diff |
| `docker compose config -q` (before edits) | exit 0; warnings: obsolete `version`, unset variable from the mangled hash |
| `docker compose config -q` (after edits) | exit 0; `version` warning gone; hash warnings remain only because the local `.env` still holds the unquoted hash (the updated run script fixes it on next run, or quote it by hand - section 3.1) |
| Temp-dir Compose test of quoted vs unquoted hash | unquoted: mangled + warnings; quoted: intact, no warnings |
| `bash -n scripts/run.sh`; PowerShell parser on `scripts/run.ps1`; `node --check backend/scripts/hash-password.js`; PS quote/unquote snippet | syntax OK; snippet produced the quoted line and recovered the original hash |

NOT run: `docker compose up`, image builds, health checks, login, any API call, any backend integration test, Playwright.

## 2. Prerequisites

- Docker Desktop with Compose v2 (`docker compose`), Node 20 (for tests/scripts outside containers), free ports 3000, 4000, 5432 (stop any local Postgres).
- `.env` at the repo root (copied from `.env.example`). Twilio values may stay blank.

## 3. Start the stack

### 3.1 Prepare `.env`

```bash
cp .env.example .env          # skip if .env already exists
```

`RECEPTIONIST_PASSWORD_HASH` must be single-quoted. Either run the script (it generates/quotes it), or edit by hand:

```
RECEPTIONIST_PASSWORD_HASH='$2b$10$....'
```

Generate a hash for `admin123`: `node backend/scripts/hash-password.js admin123`.

### 3.2 Full Docker stack (db + api + frontend)

```bash
./scripts/run.sh --docker            # Git Bash / WSL
.\scripts\run.ps1 -Docker            # PowerShell
# or directly:
docker compose up --build -d
```

**[TO BE VERIFIED BY A HUMAN]** Expected: `docker compose ps` shows `db` healthy, `api` and `frontend` running. Follow startup with `docker compose logs -f api` - expect Prisma "Applying migration" lines (first run), "Seeding database...", then the server listening on 4000.

### 3.3 Dev mode alternative (Docker Postgres + native npm servers)

```bash
./scripts/run.sh                     # no flag;  PowerShell: .\scripts\run.ps1
```

## 4. Health checks **[TO BE VERIFIED BY A HUMAN]**

```bash
curl -i http://localhost:4000/health       # direct to API
curl -i http://localhost:3000/health       # through nginx
```

Expected: `200` and `{"status":"ok","db":"connected","uptime":<n>}`. `503` with `"db":"disconnected"` means the API cannot reach Postgres (check `docker compose ps db` and `DATABASE_URL`).

Also: open http://localhost:3000 - the login page renders; `docker compose ps` shows no restarting containers.

## 5. Log in as the receptionist **[TO BE VERIFIED BY A HUMAN]**

UI: http://localhost:3000, username `receptionist`, password `admin123` (when the hash was generated for `admin123`).

CLI (the cookie jar is reused by later steps):

```bash
curl -i -c jar.txt -H "Content-Type: application/json" \
  -d '{"username":"receptionist","password":"admin123"}' http://localhost:4000/api/auth/login
curl -b jar.txt http://localhost:4000/api/auth/me      # {"authenticated":true}
```

Expected: `200 {"message":"Login successful"}`. `401` = wrong credentials or a corrupted hash (see 1.2); `503 SERVER_MISCONFIGURED` = hash empty. Login is rate limited to 10 attempts per 15 minutes.

Without the cookie, `GET /api/appointments/...` must return `401`.

## 6. Verify the new behaviour (EPMCDMETST-69392) **[TO BE VERIFIED BY A HUMAN]**

Get ids first:

```bash
curl -b jar.txt http://localhost:4000/api/departments        # note a department id
curl -b jar.txt http://localhost:4000/api/doctors            # note a doctor id in that department
```

Use a working day (Mon-Sat), a future date, and a slot on the 10:00-18:30 grid.

| # | Check | How | Expected |
|---|---|---|---|
| 1 | Book with department only (random doctor + random slot) | UI: Book, pick department, tick **Any doctor** and **Any available slot**. API: `POST /api/appointments` body `{"patientName":"Test","patientPhone":"9876543210","departmentId":"<dept>","appointmentDate":"YYYY-MM-DD"}` | `201`, `"status":"CONFIRMED"`, a doctor from that department and a valid `slotTime` are assigned, `smsStatus` present |
| 2 | Any doctor with a chosen slot (API only, see caveat) | same body plus `"slotTime":"10:30"` | `201`, doctor assigned among those free at that slot; if none free `409 NO_DOCTOR_AVAILABLE` |
| 3 | Chosen doctor + Any slot | UI: pick doctor, tick **Any available slot**; API: body with `doctorId` and no `slotTime` | `201` with a free slot; fully booked day gives `409 NO_SLOTS_AVAILABLE` |
| 4 | Backward compatibility | body with `doctorId` + `slotTime` | `201` as before; double-booking the same slot gives `409 SLOT_UNAVAILABLE` |
| 5 | Sunday / invalid date | `appointmentDate` on a Sunday | `422` with the error envelope |
| 6 | SMS status endpoint | `GET /api/appointments/<id>/sms` | `200 {"appointmentId","latest":{messageType,status,attemptCount,updatedAt},"failedAfterRetries":bool}` |
| 7 | SMS banner, Twilio unset (default) | read the banner after booking | gray "SMS notifications are disabled", `data-sms-state="DISABLED"`, response `"smsStatus":"DISABLED"` |
| 8 | SMS banner, Twilio configured and delivering | set the three `TWILIO_*` vars in `.env`, `docker compose up -d api` | green "SMS sent to the patient" |
| 9 | SMS banner failure states | set deliberately invalid Twilio credentials, restart `api`, book/cancel/reschedule | amber "SMS still sending" (`PENDING_RETRY`) or red "SMS not delivered" (`FAILED`); once the latest log is `FAILED` with `attemptCount >= 3`, `/sms` returns `failedAfterRetries:true` and the banner becomes red "contact patient manually" (not dismissable) |
| 10 | Cancel and reschedule | UI Manage appointment, or `PATCH /api/appointments/<id>/cancel` and `/reschedule` | cancel: `CANCELLED`, slot released, SMS status returned; reschedule: `201`, new appointment linked via `previousAppointmentId` |

Note for check 7: with Twilio unset the code marks the SMS log `FAILED` with `attemptCount` 1 while the booking response says `DISABLED`; `/sms` therefore reports `latest.status:"FAILED"`, `failedAfterRetries:false` (read from the code, not observed).

### Known caveat (open defect, not a deployment problem)

In the booking form, ticking **Any doctor** without **Any available slot** leaves the slot select disabled but the form posts `slotTime: ""`, so the API answers `422` "Slot time must be in HH:MM format". Workaround in the UI: tick both boxes. The API itself supports department + slot without a doctor (check 2). Tracked as a `test.fixme` in `frontend/e2e/tests/booking-random.spec.ts` and in the test execution report (finding 1).

Other known behaviour gaps (`artifacts/test-reports/test-execution-report-EPMCDMETST-69392.md`, findings 2-4): a CANCELLED appointment can be rescheduled; slot-grid violations report `INVALID_DATE`; Sunday/past-date checks use UTC.

## 7. Run the backend tests against the compose Postgres **[TO BE VERIFIED BY A HUMAN]**

All Jest suites (including unit) go through `globalSetup`, which needs Postgres on `localhost:5432` and the container `doc-appointment-booking-db-1` (guaranteed by the `name:` key in `docker-compose.yml`). It drops/creates the `appointments_test` database, runs migrations and seeds; it never touches the `appointments` database.

```bash
docker compose up -d db                      # wait until healthy: docker compose ps
cd backend
npm install                                  # if node_modules is missing
npm run test:unit
npm run test:integration                     # runs --runInBand (files delete all appointments in beforeEach)
npm test                                     # unit + integration
```

Reference: the author's earlier unit-only run (temporary config without globalSetup) was 109/109 passed in 7 suites. No integration result exists yet; first-run failures are possible. Do not run integration files in parallel.

Playwright UI specs (isolated package, mocked API, no backend needed): `cd frontend/e2e && npm install && npx playwright install chromium && npm run test:e2e` (Playwright 1.45+ needed for `page.clock`).

## 8. Rollback and teardown

| Goal | Command | Effect |
|---|---|---|
| Stop, keep data | `docker compose stop` or `./scripts/run.sh --stop` | containers stopped, volume kept |
| Remove containers, keep data | `docker compose down` | volume `doc-appointment-booking_pg_data` kept |
| Full reset (DELETES all appointment data) | `docker compose down -v` or `./scripts/run.sh --clean` | containers, network and DB volume removed |
| Roll back this ticket's code | revert the ticket commits (or redeploy the previous commit from `main`), then `docker compose up --build -d` | no DB rollback needed: no schema migration; SMS status reads the existing SmsLog table |
| Revert infra edits only | `git checkout origin/main -- docker-compose.yml scripts/run.sh scripts/run.ps1 .env.example backend/scripts/hash-password.js` | restores old behaviour, including the unquoted-hash defect and the container-name mismatch for tests |

If the test database is left behind: `docker exec doc-appointment-booking-db-1 psql -U postgres -c "DROP DATABASE IF EXISTS appointments_test"`.

## 9. Troubleshooting

- Login returns 401 in Docker mode: hash not single-quoted in `.env` (section 1.2). Fix, then `docker compose up -d api`.
- `api` exits at start: `docker compose logs api`; usual causes are the DB not healthy yet, a port clash on 5432, or a missing `.env` (compose `env_file` requires it).
- Jest globalSetup error `No such container: doc-appointment-booking-db-1`: the db service is not running or was started from a checkout without the `name:` key.
- Source edits not visible in the frontend container: it serves a built bundle; rebuild with `docker compose up --build -d frontend`. The `api` service bind-mounts `./backend` but needs `docker compose restart api` to pick up changes.
