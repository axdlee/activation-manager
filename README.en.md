# Activation Manager

> A unified license operations console for **multi-project**, **dual licensing models (TIME / COUNT)** and **production-grade plugin / desktop / client integrations**.
> One service covers **project isolation, code issuance, activation, status checks, metered consumption, a full sales loop (store + payments + auto fulfillment), multi-channel notifications, log troubleshooting, rebind governance and public API documentation**.

<p>
  <img src="https://img.shields.io/badge/Next.js-14-111827?logo=nextdotjs" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/React-18-087EA4?logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma" alt="Prisma 5" />
  <img src="https://img.shields.io/badge/SQLite%20%7C%20PostgreSQL-DB-0F172A" alt="Database" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-15803D?logo=nodedotjs" alt="Node.js >= 22" />
  <img src="https://img.shields.io/badge/Tests-690%2B-16A34A" alt="Tests" />
  <img src="https://img.shields.io/badge/SDK-16%20Languages-7C3AED" alt="SDK" />
</p>

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Analytics dashboard" width="860" />
</p>

English | [简体中文](./README.md)

---

## Table of Contents

- [Core Capabilities](#core-capabilities)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [Public API & SDKs](#public-api--sdks)
- [Admin Console Modules](#admin-console-modules)
- [Themes & i18n](#themes--i18n)
- [Testing & Quality](#testing--quality)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

## Core Capabilities

### Licensing Core
- **Dual licensing models**: `TIME` (validity starts at first activation) and `COUNT` (idempotent deduction via `requestId`)
- **Multi-project isolation**: `projectKey` separates code pools, enablement and governance policies per product / customer
- **Rebind governance**: per-code rebind policy (inherit / custom cooldown and max count), force unbind / force rebind, binding history and admin audit timelines
- **Response signature**: set `licenseResponseSecret` and public API responses carry HMAC-SHA256 signatures (5-minute window), one-line verification in every SDK

### Public API & Clients
- **Official endpoints**: `/api/license/activate` · `/api/license/status` · `/api/license/consume` (rate limiting, retry semantics, response signature)
- **Legacy endpoint**: `/api/verify` (snake_case protocol for smooth migration)
- **SDKs in 16 languages**: TypeScript / Python / Go / Java / C# / PHP / Ruby / Rust / Kotlin / Swift / Dart / C / C++ / Scala / Groovy / Lua / Perl — unified timeouts, retries, response normalization and signature verification; single-file copy-and-use
- **Online API docs**: `/docs/api` — full parameter, error-code and signature docs with sample code for integrators

### Sales Loop (Store)
- **Public store page**: per-project products, order → pay → auto fulfillment → license delivered by email
- **Payment channels**: manual confirmation / YiPay / WeChat Pay / Alipay, per-channel enablement and config-completeness checks
- **Predefined code pool anti-oversell**: products bound to code pools with real-time stock; orders auto-cancel on timeout and release stock
- **Order operations**: confirm fulfillment, resend email, order cleanup — all audited

### Notification System
- **Multi-channel delivery**: Webhook / Email (SMTP) / SMS can be enabled simultaneously; key events (license expiry, order fulfillment, timeout cancel) pushed in real time
- **Auto license delivery**: paid orders email the license code to the buyer automatically
- **Expiry scan**: one-click scan of soon-to-expire licenses with reminders

### Admin Console
- **14 admin pages**: analytics, projects, code generation, license management, consumption logs, audit center, API docs, store (products / orders / payments), system settings, account security
- **Analytics cockpit**: KPI cards, 7-day consumption trend, license composition donut, License API metrics (5-minute window), per-project stats table
- **Audit & export**: admin operations, consumption logs and license lists all support CSV export
- **14 themes × 10 languages**: entire UI hot-swaps via `data-theme`; runtime switch across zh / en / ja / ko / de / fr / es / pt / ru / ar (RTL included)

## Screenshots

| Analytics cockpit | Code generation |
| --- | --- |
| ![Analytics](docs/screenshots/dashboard.png) | ![Generate](docs/screenshots/generate.png) |

| License management | API docs |
| --- | --- |
| ![Licenses](docs/screenshots/licenses.png) | ![API docs](docs/screenshots/api-docs.png) |

| Settings (section nav) | Notification channel tabs |
| --- | --- |
| ![Settings](docs/screenshots/settings-overview.png) | ![Notifications](docs/screenshots/settings-notification.png) |

| Payment channel tabs | Mobile |
| --- | --- |
| ![Payments](docs/screenshots/shop-payment.png) | ![Mobile](docs/screenshots/dashboard-mobile.png) |

> More screenshots in [`docs/screenshots/`](docs/screenshots/).

## Quick Start

> Requires Node.js ≥ 22.

```bash
# 1. Install dependencies
npm ci

# 2. Prepare database (SQLite by default; dev bootstrap creates tables and admin account)
npx prisma generate

# 3. Start dev server
npm run dev

# 4. Production build & start
npm run build
npm start
```

| Entry | URL |
| --- | --- |
| Home / store | `http://localhost:3000` |
| Admin login | `http://localhost:3000/admin/login` |
| Public API docs | `http://localhost:3000/docs/api` |

- **Dev environment** bootstraps `admin / 123456` on first run (in production `ADMIN_INITIAL_PASSWORD` is **required** — bootstrap aborts with an error when missing, no random password is generated)
- Change the password in **Settings → Account Security** (re-login required afterwards)

## Docker Deployment

```bash
# Published image (:latest kept in sync)
docker pull xdlee/activation-manager:v2.9.0

# Or one command with compose (SQLite volume included)
docker compose up -d
```

`docker-compose.yml` ships with a SQLite persistence volume; PostgreSQL migration guide in [`docs/postgres.md`](docs/postgres.md).

## GitHub Actions → DockerHub

Pushes to `main` or `v*` tags trigger **Quality Gate (tsc + full tests + 85% branch threshold) → Playwright E2E Smoke → Docker Compose Smoke → Build & Push**:

| Trigger | Produced tags |
| --- | --- |
| push `main` | `:latest` |
| push `v*` tag | `:vX.Y.Z` + `:sha-<short>` |

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | Prisma connection (SQLite `file:./dev.db` or PostgreSQL URL) | `file:./dev.db` |
| `PORT` | Server port | `3000` |
| `ADMIN_INITIAL_PASSWORD` | Initial admin password in production | unset (required in production; bootstrap aborts if missing) |
| `LICENSE_API_RATE_LIMIT_MAX` / `LICENSE_API_RATE_LIMIT_WINDOW_MS` | Public API rate limit | built-in |
| `LICENSE_RESPONSE_SECRET` | Response signature secret (configurable in console) | empty (off) |

See [`docs/operations.md`](docs/operations.md) for deployment details.

## Public API & SDKs

| Endpoint | Description |
| --- | --- |
| `POST /api/license/activate` | Activate: bind machine; TIME starts validity, COUNT does not deduct |
| `POST /api/license/status` | Query: remaining count / expiry / bound state |
| `POST /api/license/consume` | Consume: COUNT deducts 1 (`requestId` idempotent), TIME validates only |
| `POST /api/verify` | Legacy snake_case endpoint — new integrations should use the official ones |

All requests carry `projectKey + code + machineId`; full parameters, error codes and signature docs live in the console **API docs** page (`/docs/api`).

**SDKs** (`sdk/` directory — single-file, standard-library only, signature verification included):

| Ecosystem | Languages |
| --- | --- |
| Frontend / scripting | TypeScript · Python · PHP · Ruby · Perl · Lua |
| Systems / server | Go · Java · Kotlin · Scala · Groovy · C# · Rust · Dart |
| Native / mobile | C · C++ · Swift |

Go example:

```go
client := activationmanager.NewClient(activationmanager.ClientOptions{
    BaseURL: "http://localhost:3000", ProjectKey: "demo",
})
result, err := client.Activate(ctx, "A1B2C3D4E5F6G7H8", "machine-001", nil)
```

Samples for every language live in the console **API docs → Examples**, or the README in each [`sdk/`](sdk/) directory.

## Admin Console Modules

| Module | Capabilities |
| --- | --- |
| Analytics | KPI cards, 7-day consumption trend, license composition donut, License API metrics, per-project stats |
| Projects | Create / edit / enable projects, default rebind policy, delete protection |
| Code generation | TIME / COUNT modes, project + card type binding, batch generate & export |
| License management | Multi-dimension filters, detail drawer (binding history + audit timeline + danger zone), rebind settings, force unbind / rebind, export |
| Consumption logs | `requestId` lookup, filters, trend linkage, export |
| Audit center | Full admin operation audit, detail drawer, CSV export |
| API docs | Public endpoint docs, 16-language SDK samples, debug commands, signature guide |
| Store | Product management (pool binding / shelf toggle / restock), order management (confirm / resend / cleanup), payment channel config |
| System settings | Access control (IP allowlist), rebind policy, auth & sessions, branding, notification channels (Webhook/Email/SMS), advanced config — section nav with unsaved-changes bar |
| Account security | Admin password change (re-login required) |

## Themes & i18n

- **14 themes**: Dark Tech / Midnight / Graphite / Emerald / Violet / Crimson / Ocean / Amber / Sakura / Forest / Sunrise / Sepia / Mono / Aurora — all CSS-variable based with instant switching, validated by an automated WCAG contrast audit
- **10 UI languages**: 简体中文 / English / 日本語 / 한국어 / Deutsch / Français / Español / Português / Русский / العربية (RTL), runtime switching without reload

## Testing & Quality

```bash
# Full unit + behavior suites (node:test, 690+ cases)
npm test

# With thresholds (lines 90% / branches 85% / funcs 90%) — same as CI quality gate
npm run test:coverage

# Playwright E2E (smoke + page behavior + responsive)
npx playwright test
```

The Docker Publish pipeline runs **Quality Gate (tsc + tests + coverage thresholds) → Playwright E2E Smoke → Docker Compose Smoke → Build & Push**; any failure blocks the release.

## Project Structure

```
├── src/
│   ├── app/                # Next.js App Router (admin / public pages / API routes)
│   ├── components/         # admin task pages, ui-admin primitives, public components
│   ├── lib/                # domain services (license-*), hooks, i18n, UI page models
│   └── i18n/               # 10-language dictionaries (client/server)
├── sdk/                    # official SDKs in 16 languages (single-file, copy-to-use)
├── tests/                  # 690+ cases (node:test + RTL): unit / behavior / route handlers
├── e2e/                    # Playwright smoke & page behavior tests
├── docs/                   # operations, PostgreSQL migration, screenshots
├── scripts/                # theme contrast audit, full-theme screenshot matrix
├── docker-compose.yml      # one-command SQLite deployment
└── .github/workflows/      # quality gate + e2e + automated DockerHub publishing
```

## Documentation

| Doc | Content |
| --- | --- |
| [`docs/operations.md`](docs/operations.md) | Deployment & operations handbook |
| [`docs/postgres.md`](docs/postgres.md) | SQLite → PostgreSQL migration |
| [`docs/admin-console-operations.md`](docs/admin-console-operations.md) | Admin console operations guide |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Roadmap |
| [`sdk/README.md`](sdk/README.md) | SDK overview & integration |

---

## Acknowledgements

Thanks to the [Linux.do](https://linux.do/) community for its support — especially the generous folks who provided free Codex 5.4 access for this project.

---

## Stargazers over time

[![Stargazers over time](https://starchart.cc/axdlee/activation-manager.svg?variant=adaptive)](https://starchart.cc/axdlee/activation-manager)
