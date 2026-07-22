# Meta Business Agent API — Index

Base domain: `https://api.facebook.com`
API Version header: `X-API-Version: 2.0.0`
Auth: `Authorization: Bearer {token}`
entity_id: WhatsApp Business Phone Number ID

---

## API Surface

| File | Base Path | Methods | Purpose |
|------|-----------|---------|---------|
| eligibility.md | `/{entity_id}/agent_eligibility` | GET | Check if phone number can use Meta Business Agent |
| settings.md | `/{entity_id}/agent_config/settings` | GET, PUT | Enable/disable agent, handoff, followup, audience |
| allowlist.md | `/{entity_id}/agent_config/allowlist` | GET, POST, DELETE | Restrict agent to specific consumer phone numbers |
| skills.md | `/{entity_id}/agent_config/skills` | GET, POST, PUT, DELETE | Agent behavior instructions (tone, triggers, flows) |
| faq.md | `/{entity_id}/agent_config/faq` | GET, POST, PUT, DELETE | Q&A knowledge base |
| files.md | `/{entity_id}/agent_config/files` | GET, POST, DELETE | Document uploads (PDF, DOCX, images, CSV, XLSX) |
| websites.md | `/{entity_id}/agent_config/websites` | GET, POST, PUT, DELETE | URLs for agent to crawl |
| connectors.md | `/{entity_id}/agent_connectors` | GET, POST, PUT, DELETE + auth upserts + logs | External API integrations |
| connector-tools.md | `/{entity_id}/agent_connectors/{connector_id}/tools` | GET, POST, PUT, DELETE, run | Individual operations per connector |
| agent-eval.md | `/{entity_id}/agent-eval` | GET /cases, GET /details, GET /run, GET /summary, POST /run | Test and evaluate agent performance |
| agent-test.md | `/{entity_id}/agent_test` | POST | Send test messages, get agent response, multi-turn support |
| agent-event.md | `/{entity_id}/agent_event` | POST, GET /{id} | Trigger agent from business events (payment, delivery, etc.) |
| thread-control.md | `/business/whatsapp/phone_numbers/{id}/thread_control` | POST | Hand conversation back to Meta Business Agent (release action) |

---

## Setup Sequence (correct order)

```
1. GET  /agent_eligibility          → verify phone number is eligible
2. PUT  /agent_config/settings      → create agent (disabled)
3. POST /agent_config/skills        → configure behavior/tone
4. POST /agent_config/faq           → add knowledge (Q&A)
5. POST /agent_config/files         → add knowledge (documents)
6. POST /agent_config/websites      → add knowledge (URLs to crawl)
7. POST /agent_connectors           → connect external APIs
8. POST /agent_connectors/{id}/tools → define connector operations
9. PUT  /agent_config/settings      → enable agent (rollout.enabled = true)
10. POST /agent-eval/run            → run evaluation before going live
```

---

## Key Design Facts

- `entity_id` is always the **WhatsApp Business Phone Number ID** — not business ID
- Settings `PUT` is a **full replace** — send all fields every time
- Disabling agent stops responses to ALL threads — re-enabling only picks up NEW threads
- Skills: conflicting skills on same trigger → agent produces inconsistent responses — consolidate
- FAQ answers must be self-contained — agent retrieves each entry independently
- Connector tools: always provide `description` on every param node — agent extracts values from conversation using descriptions
- `ai_audience`: WhatsApp only. `EVERYONE` (default) or `ALLOWLISTED_ONLY`
- Supported channels: email, instagram, line, messenger, sms, tiktok, webchat, whatsapp

---

## Auth Types for Connectors

| Type | When to use |
|------|-------------|
| `OAUTH2_CLIENT_CREDENTIALS` | Machine-to-machine OAuth |
| `API_KEY` | Static API key in header/query/body |
| `NONE` | No auth (public APIs) |
| `OAUTH2`, `BASIC`, `CUSTOM` | Defined but NOT currently supported |

---

## Still Missing (paste when available)
- [ ] Onboarding API
- [ ] Business Info API
- [ ] Webhook payload schemas (messages, standby, messaging_handovers)
