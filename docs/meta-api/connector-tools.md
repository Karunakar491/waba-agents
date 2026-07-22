# Connector Tools API
Base URL: `https://api.facebook.com/{entity_id}/agent_connectors/{connector_id}/tools`

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all tools for a connector |
| POST | / | Create a new tool |
| GET | /{tool_id} | Get a specific tool |
| PUT | /{tool_id} | Update a specific tool |
| DELETE | /{tool_id} | Delete a specific tool |
| POST | /{tool_id}/run | Execute a tool (test run) |

---

## GET /
**Response 200:** array of `BizAIOmniChannelConnectorToolResponse`

## POST /
**Body:** `BizAIOmniChannelConnectorToolRequest`
**Response 201:** `BizAIOmniChannelConnectorToolResponse`

## GET /{tool_id}
**Response 200:** `BizAIOmniChannelConnectorToolResponse`

## PUT /{tool_id}
**Body:** `BizAIOmniChannelConnectorToolRequest`
**Response 200:** `BizAIOmniChannelConnectorToolResponse`

## DELETE /{tool_id}
**Response 204:** No content

## POST /{tool_id}/run
**Body:** `BizAIOmniChannelConnectorToolRunRequest`
**Response 200:** `BizAIOmniChannelConnectorToolRunResponse`

---

## Schemas

### BizAIOmniChannelConnectorToolRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✓ | Stable key visible to agent. e.g. `check_order_status`. No generic names. |
| description | string | ✓ | Agent uses this to decide WHEN to invoke. Be specific: action, inputs, what it returns. Vague = wrong invocations. |
| request_definition | BizAIOmniChannelConnectorToolRequestDefinition | ✓ | |
| user_auth_required | boolean | ✓ | If true, Meta injects stored user auth at runtime |
| user_auth_action_config | BizAIOmniChannelConnectorToolUserAuthToolConfig | | For login/refresh tools |

### BizAIOmniChannelConnectorToolRequestDefinition
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| method | string | ✓ | "GET"\|"POST"\|"PUT"\|"DELETE"\|"PATCH" |
| path | string | ✓ | Path template with `{placeholder}` for path params |
| path_parameters | object | | Keys match placeholder names in path |
| query_parameters | object | | Keys are query param names |
| headers | object | | Keys are header names |
| body | BizAIOmniChannelConnectorToolRequestBodyDefinition | | Omit when no body |

### BizAIOmniChannelConnectorToolRequestBodyDefinition
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| content_type | "application/json" | ✓ | Only JSON supported currently |
| params | object | ✓ | Top-level body fields (keys = field names, values = BodyNode) |
| required | string[] | | Required top-level field names |

### Parameter/Body Node Types

**BizAIOmniChannelConnectorToolParameterNode** (for path/query/header params):
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | string | ✓ | "string"\|"integer"\|"number"\|"boolean" |
| description | string | | Agent uses this to extract value from conversation |
| required | boolean | | Ignored for path params (always required) |
| binding | ParameterBinding | | Meta-owned value — omit for agent-filled fields |

**BizAIOmniChannelConnectorToolBodyNode** (for request body):
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | string | ✓ | "object"\|"array"\|"string"\|"integer"\|"number"\|"boolean" |
| description | string | | Always provide — agent uses to understand what to extract |
| required | string[] | | Required properties (object only) |
| properties | object | | Child fields for object type. Always define explicitly — agent needs full schema |
| items | string | | BodyNode for array elements |
| binding | ParameterBinding | | Meta-owned value |

### ParameterBinding
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| kind | "default"\|"macro" | ✓ | default = literal value, macro = Meta-injected value |
| value | string | | Required when kind=default. Converted to node type at runtime |
| macro | string | | Required when kind=macro. One of: "WHATSAPP_PHONE_NUMBER"\|"WHATSAPP_IDENTITY_HASH"\|"WHATSAPP_CURRENT_STATUS_ID" |

### UserAuthToolConfig
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| user_action_tool_type | "auth"\|"refresh" | ✓ | auth = initial authorization, refresh = use existing refresh token |
| user_auth_token_path | string | ✓ | Dot-path to extract access token from response |
| refresh_token_path | string | | Dot-path to extract refresh token |
| expires_at_path | string | | Dot-path to extract expiry |
| expires_at_type | "absolute"\|"relative_seconds" | | How to interpret expiry value |

### BizAIOmniChannelConnectorToolRunRequest
| Field | Type | Notes |
|-------|------|-------|
| input | string | JSON-encoded input payload. Defaults to {} |

### BizAIOmniChannelConnectorToolRunResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| output | string | ✓ | JSON-encoded response from tool execution |
| status | string | ✓ | "success"\|"error" |

## Critical Notes
- Always provide `description` on every node — agent uses it to extract correct values from conversation
- Use `object` with explicit `properties` — never leave object schema undefined
- Do NOT use `object` without defining `properties` — agent will guess and fail
- `name` must be stable and descriptive — agent uses it for invocation decisions

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
