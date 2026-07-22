---
title: API
tags: [api, index, backend]
---

# Backend API

**Base URL:** `http://server:8080` (no context path on dev — server application.yml omits it)
**Auth:** JWT in httpOnly cookie (`access_token`), RS256, 15min expiry

## Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Returns JWT in httpOnly cookie |
| POST | `/auth/refresh` | Rotate access token |
| POST | `/auth/logout` | Clears cookie (maxAge=0) |

## Agents
| Method | Path | Description |
|---|---|---|
| GET | `/agents` | List agents for account |
| POST | `/agents` | Create agent |
| GET | `/agents/{id}` | Get agent detail |
| PUT | `/agents/{id}` | Update agent |
| DELETE | `/agents/{id}` | Soft delete |
| POST | `/agents/{id}/deploy` | Deploy to Meta (Meta API first, DB second) |
| POST | `/agents/{id}/pause` | Pause agent |

## Webhook (Meta → us)
| Method | Path | Description |
|---|---|---|
| GET | `/webhook` | Verification handshake |
| POST | `/webhook` | Inbound messages (persist first, process async) |

## Health
| Method | Path | Description |
|---|---|---|
| GET | `/actuator/health` | App health (403 without auth on dev) |
| GET | `/actuator/prometheus` | Metrics |
