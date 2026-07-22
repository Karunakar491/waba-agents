# Meta Business Agent — Agent Eval API

## Base URL
`https://api.facebook.com/{entity_id}/agent-eval`

## Authentication
Bearer token in header: `Authorization: Bearer {token}`

Required: one of:
- Capability: `bizai_wa_enterprise_api_3p_access`
- Permission: `whatsapp_business_messaging`

Header on all requests: `X-API-Version: 2.0.0`

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cases` | List all eval case configurations for the entity |
| GET | `/details` | Get per-conversation evaluation results by eval IDs |
| GET | `/run` | Poll status of a previously submitted evaluation job |
| GET | `/summary` | Get aggregated insight reports by summary IDs |
| POST | `/run` | Submit a combo evaluation job |

---

## GET /cases

**Path params:** `entity_id` (string, required)

**Response 200:**
```json
{
  "eval_cases": [ BizAIEvalCaseResponse ]
}
```

---

## GET /details

**Path params:** `entity_id` (string, required)
**Query params:** `eval_ids` (string, required) — comma-separated evaluation IDs

**Response 200:**
```json
{
  "evaluations": [ BizAIEvalDetailResponse ]
}
```

---

## GET /run

**Path params:** `entity_id` (string, required)
**Query params:** `job_id` (string, required)

**Response 200:** `BizAIComboJobStatusResponse`

---

## GET /summary

**Path params:** `entity_id` (string, required)
**Query params:** `summary_ids` (string, required) — comma-separated

**Response 200:**
```json
{
  "insights": [ BizAIEvalSummaryResponse ]
}
```

---

## POST /run

**Path params:** `entity_id` (string, required)
**Query params:** `eval_case_ids` (string, required) — comma-separated pfbid format IDs
**Body:** `BizAIComboRunRequest`

**Response 200:** `BizAIComboRunResponse`

---

## Schemas

### BizAIEvalCaseResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Eval case entity ID |
| scenario | string | ✓ | Free-form task/constraint text for user simulator |
| categories | string[] | | Category strings for the test scenario |
| max_turns | integer | | Max conversation turns allowed |
| success_criteria | string[] | | Criteria agent must meet to pass |

### BizAIComboRunRequest
No additional properties allowed. Schema TBD — paste when available.

### BizAIComboRunResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| job_id | string | ✓ | pfbid format |
| status | string | ✓ | Initial: `QUEUED` |

### BizAIComboJobStatusResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| status | string | ✓ | `QUEUED` \| `RUNNING` \| `COMPLETED` \| `FAILED` |
| progress | Progress | | Present while running |
| result | BizAIComboJobResult | | Present when COMPLETED |
| error | Error | | Present when FAILED |

### Progress
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| completed | integer | ✓ | Eval cases completed |
| total | integer | ✓ | Total eval cases in job |
| current_stage | string | ✓ | `simulation` \| `evaluation` \| `insights` \| `done` |

### BizAIComboJobResult
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| summary_id | string | ✓ | |
| avg_conversation_score | number | | Range 1-5 |
| avg_turn_score | number | | Range 1-5, finer granularity |
| summary | string | ✓ | Natural language performance summary |
| highlights | string | | JSON array of highlight objects |
| top_failure_categories | string | | JSON array: category, eval IDs, recommended actions |
| eval_ids_by_score | string | | JSON object grouping eval IDs by score |
| creation_time | integer | ✓ | Unix timestamp |
| update_time | integer | ✓ | Unix timestamp |

### BizAIEvalDetailResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Evaluation ID |
| score | integer | | Overall score from judge LLM |
| per_turn_labels | string | ✓ | JSON array of per-turn label integers |
| reasons | string | ✓ | JSON array: {category, score, description, recommended_actions} |
| custom_success_criteria | string | | JSON array of client-specified criteria strings |
| eval_case_id | string | | ID of defining eval case |
| transcript | string | | JSON: system_prompt + transcript_turns |
| creation_time | integer | ✓ | Unix timestamp |
| update_time | integer | ✓ | Unix timestamp |

### BizAIEvalSummaryResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Insight report ID |
| avg_conversation_score | number | | |
| avg_turn_score | number | | |
| summary | string | ✓ | Natural language summary |
| highlights | string | | JSON array |
| top_failure_categories | string | | JSON array |
| eval_ids_by_score | string | | JSON object |
| creation_time | integer | ✓ | Unix timestamp |
| update_time | integer | ✓ | Unix timestamp |

### StandardError
| Field | Type | Required |
|-------|------|----------|
| title | string | ✓ |
| detail | string | ✓ |
| type | string | |
| status | integer | |

---

## Error Codes
| HTTP | Meaning |
|------|---------|
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Server error |
