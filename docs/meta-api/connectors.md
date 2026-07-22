# Connectors API
Base URL: `https://api.facebook.com/{entity_id}/agent_connectors`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all connectors |
| POST | / | Create a connector |
| GET | /{connector_id} | Get a specific connector |
| PUT | /{connector_id} | Update a connector |
| DELETE | /{connector_id} | Delete a connector |
| GET | /{connector_id}/logs | Get connector error logs |
| POST | /{connector_id}/upsertApiKey | Set/rotate API key credentials |
| POST | /{connector_id}/upsertCertificate | Set/rotate mTLS certificate |
| POST | /{connector_id}/upsertOAuth | Set/rotate OAuth 2.0 credentials |

---

## GET /
**Response 200:** array of `BizAIOmniChannelConnectorResponse`

## POST /
**Body:** `BizAIOmniChannelConnectorRequest`
**Response 201:** `BizAIOmniChannelConnectorResponse`

## GET /{connector_id}
**Response 200:** `BizAIOmniChannelConnectorResponse`

## PUT /{connector_id}
**Body:** `BizAIOmniChannelConnectorRequest`
**Response 200:** `BizAIOmniChannelConnectorResponse`

## DELETE /{connector_id}
**Response 204:** No content

## GET /{connector_id}/logs
**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| start_time | integer | Unix timestamp. Default: 24h ago. Max range: 7 days |
| end_time | integer | Unix timestamp. Default: now |
| limit | integer | 1-1000. Default: 100 |
| tool_id | string | Filter to specific tool |
| include_stats | boolean | Include success rate, latency percentiles. Default: false |
| summary_only | boolean | Return failure patterns ranked by occurrence. Default: false |
| top_n | integer | Top N failure patterns when summary_only=true. 1-50. Default: 10 |

**Response 200:** `BizAIOmniChannelConnectorLogStatsResponse`

## POST /{connector_id}/upsertApiKey
**Body:** `BizAIOmniChannelConnectorUpsertApiKeyRequest`
**Response 200:** `BizAIOmniChannelConnectorResponse`

## POST /{connector_id}/upsertCertificate
**Body:** `BizAIOmniChannelConnectorCertificateRequest`
**Response 200:** `BizAIOmniChannelConnectorResponse`

## POST /{connector_id}/upsertOAuth
**Body:** `BizAIOmniChannelConnectorUpsertOAuthRequest`
**Response 200:** `BizAIOmniChannelConnectorResponse`

---

## Schemas

### BizAIOmniChannelConnectorRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✓ | e.g. "Shopify Order Management" |
| description | string | ✓ | Agent uses this to understand capabilities |
| base_url | string | ✓ | External API base URL |
| auth_type | string | ✓ | "OAUTH2_CLIENT_CREDENTIALS" \| "API_KEY" \| "NONE" (others defined but only these 3 supported) |
| auth_config | BizAIOmniChannelConnectorAuthConfig | | |
| user_auth_injection_config | object | | Where/how to inject user auth token |
| requires_certificate | boolean | | mTLS required → use upsertCertificate |

### BizAIOmniChannelConnectorResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique connector ID |
| name | string | ✓ | |
| description | string | ✓ | |
| base_url | string | ✓ | |
| auth_type | string | ✓ | |
| auth_config | object | | |
| mtls_config | object | | Private key never exposed |
| connection_status | object | ✓ | status: "PENDING_OAUTH"\|"ACTIVE"\|"EXPIRED"\|"ERROR" |
| user_auth_injection_config | object | | |

### Auth Configs

**API Key (BizAIOmniChannelConnectorApiKeyAuthConfig):**
- `headers` — array of `{field_name, value, prefix?}`
- `query_params` — array of `{field_name, value, prefix?}`
- `body_params` — array of `{field_name, value, prefix?}`

**OAuth2 Client Credentials:**
| Field | Type | Required |
|-------|------|----------|
| token_url | string | ✓ |
| scopes_to_request | string[] | ✓ |
| token_request_content_type | string | | Default: `application/x-www-form-urlencoded` |
| client_id | string | ✓ |
| client_secret | string | ✓ |

### mTLS Certificate (BizAIOmniChannelConnectorCertificateRequest)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| client_certificate | string | ✓ | PEM. Begins with "-----BEGIN CERTIFICATE-----" |
| client_key | string | ✓ | PEM. PKCS8, RSA, or EC format |
| ca_certificate | string | | Optional CA cert for non-public CA servers |

### User Auth Injection Config
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| location | string | ✓ | "body" \| "headers" \| "path" \| "query" |
| field_name | string | ✓ | e.g. "X-User-Token" |
| prefix | string | ✓ | e.g. "Bearer " |

### Log Stats Response
- `data` — array of log entries or failure patterns
- `stats` (when include_stats=true): `start_count`, `success_count`, `exception_count`, `success_rate`, `avg_latency_s`, `p95_latency_s`, `p99_latency_s`, `time_window_seconds`

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
