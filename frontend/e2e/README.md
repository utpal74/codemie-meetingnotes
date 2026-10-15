# Receptionist UI tests (Playwright)

Specs for EPMCDMETST-69392: `booking-random.spec.ts`, `manage-appointment.spec.ts`, `sms-banner.spec.ts`.

Every `/api/*` call is stubbed with `page.route()` (see `support/mockApi.ts`), so the specs need only the Vite dev
server - no backend and no Postgres. They verify the UI contract (request payloads, rendering, SMS banner states);
they do not replace backend integration tests.

```bash
cd frontend/e2e
npm install
npx playwright install chromium     # or set PW_CHANNEL=msedge / chrome to use an installed browser
npm run test:e2e                    # starts `npm run dev` in frontend/ automatically
npm run test:e2e -- booking-random.spec.ts
```

Set `E2E_BASE_URL` to test an already running instance (the stubs still apply).
Requires @playwright/test >= 1.45 (`page.clock`).
