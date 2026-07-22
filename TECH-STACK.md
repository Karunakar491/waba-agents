# TECH-STACK.md — Canonical Technology Stack
## Meta Business Agent Platform

> This is the approved technology registry. Every agent, developer, and Claude session reads this before making any engineering decision.
> To add a new tool: Engineering Manager approves → entry added here → CLAUDE.md changelog updated.

---

## Application Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Backend language | Java | 21 LTS | Core application runtime |
| Backend framework | Spring Boot | 3.x LTS | REST APIs, dependency injection, security |
| Frontend language | TypeScript | 5.x | Strict mode — no `any` |
| Frontend framework | React | 18.x | UI rendering |
| UI component library | Shadcn/ui | — | Copied into src/components/ui/ — owned by project, built on Radix UI |
| Utility-first CSS | Tailwind CSS | 3.x | All styling — no inline styles, no CSS modules |
| Frontend state (server) | TanStack Query | 5.x | API data fetching and caching |
| Frontend state (client) | Zustand | 4.x | Lightweight client state |
| Frontend routing | React Router | 6.x | SPA routing |
| HTTP client (frontend) | Axios | 1.x | Wrapped in central API client |

---

## Data Layer

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Primary database | MySQL | 8.x | All relational, transactional data |
| Cache | Redis | 7.x | Sessions, rate limiting, ephemeral state |
| Schema migrations | Flyway | 10.x | All MySQL schema changes — never manual |
| ORM | JPA + Hibernate | (via Spring Boot) | MySQL access from Java |

---

## Infrastructure

| Component | Technology | Version | Purpose |
|---|---|---|---|
| OS | RHEL | 8.10 | Production servers |
| Container runtime | Containerd | 1.7.25 | Pod execution |
| Orchestration | Kubernetes | 1.31.x | Deployments, scaling, namespacing |
| Network | Calico | 3.29 | Pod networking, network policies |
| Ingress | Nginx Ingress Controller | v1.11.4 | External traffic routing, TLS termination |
| Web server | Nginx | 1.27.x | Static file serving, reverse proxy |
| Messaging | RabbitMQ | 3.12.x | Async webhook processing from Meta |

---

## Observability

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Log collection | Fluentbit | 3.1.9 | Node-level log shipping (DaemonSet) |
| Log aggregation | Fluentd | 1.16.5 | Centralized log routing |
| Metrics | Prometheus + Grafana | — | System and application metrics |
| Tracing | OpenTelemetry + Jaeger | — | Distributed tracing across services |

---

## Backend Libraries (approved for `pom.xml`)

| Library | Purpose | Notes |
|---|---|---|
| `spring-boot-starter-web` | REST APIs | — |
| `spring-boot-starter-security` | Auth, CSRF, headers | OAuth 2.0 + JWT |
| `spring-boot-starter-data-jpa` | MySQL ORM | — |
| `spring-boot-starter-data-redis` | Redis client | — |
| `spring-boot-starter-amqp` | RabbitMQ | — |
| `spring-boot-starter-actuator` | Health, metrics | Prometheus endpoint enabled |
| `flyway-core` | DB migrations | — |
| `lombok` | Boilerplate reduction | Records preferred for DTOs in Java 21 |
| `mapstruct` | DTO mapping | — |
| `jjwt` | JWT generation/validation | RS256 signing |
| `spring-boot-starter-validation` | Input validation | Bean Validation 3.x |
| `testcontainers` | Integration test DB | Real MySQL in tests — no mocks |
| `junit-jupiter` | Unit testing | JUnit 5 |
| `mockito-core` | Mocking | — |
| `anthropic-sdk-java` | Claude API — wizard-time generation only | Never in the message pipeline (2026-07-19 decision). EM approved 2026-07-21 |

---

## Frontend Libraries (approved for `package.json`)

| Library | Purpose | Notes |
|---|---|---|
| `tailwindcss` | Utility-first CSS | v3.x |
| `radix-ui/*` | Headless accessible primitives | Via Shadcn installs |
| `class-variance-authority` | Component variant management | — |
| `clsx` | Conditional class utility | — |
| `tailwind-merge` | Tailwind class conflict resolution | — |
| `react-hook-form` | Form state + validation | 7.x — used via Shadcn Form |
| `zod` | Schema validation | Pairs with react-hook-form |
| `lucide-react` | Icons | Shadcn default icon set |
| `@tanstack/react-query` | Server state | — |
| `zustand` | Client state | — |
| `react-router-dom` | Routing | v6 |
| `axios` | HTTP | Wrapped — never called directly |
| `dayjs` | Date handling | Ant Design peer dep |
| `jest` + `@testing-library/react` | Unit tests | — |
| `playwright` | E2E tests | Critical user flows only |

---

## Explicitly Forbidden

| Technology | Reason |
|---|---|
| MongoDB Community Edition | SSPL license — incompatible with enterprise/banking clients |
| Oracle JDK | Commercial license required for production — use Eclipse Temurin 21 (Adoptium) or Amazon Corretto 21 |
| Ant Design | Replaced by Shadcn/ui + Tailwind — generic look, not appropriate for this product |
| Redux / Redux Toolkit | Zustand is sufficient; Redux adds unnecessary complexity |
| Any library not on Maven Central | Cannot verify integrity or provenance |
| Any npm package not on npmjs.com | Cannot verify integrity or provenance |
| Tools with proprietary telemetry enabled by default | Privacy and compliance risk |
| Spring Boot 2.x | End of life — use 3.x only |
| `var` keyword abuse in Java | Use explicit types for clarity |
| `any` type in TypeScript | Defeats the purpose of TypeScript strict mode |

---

## Migration Notes (Karix Platform Merge)

| Component | Current (this repo) | Target (Karix infra) | Action |
|---|---|---|---|
| Redis | OSS 7.x | Karix Enterprise Redis | Migrate on platform merge — API-compatible, zero code changes |
| Grafana | OSS (AGPL) | Karix Enterprise Grafana | Migrate dashboards on platform merge — no AGPL exposure in production |

---

## Adding a New Technology

1. Engineering Manager evaluates: necessity, license, security posture, support lifecycle
2. Security Head reviews: known CVEs, data handling, compliance impact
3. Entry added to this file with version pinned
4. CLAUDE.md changelog updated with date and reason
5. No code using the new technology merges before steps 1-4 are complete

---

## Version Pinning Policy

- All versions pinned to minor (e.g., `3.12.x`) — patch updates are automatic
- Major version upgrades require Engineering Manager sign-off
- End-of-life versions must be upgraded within 90 days of EOL announcement
