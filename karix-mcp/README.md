# Karix MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes Karix WhatsApp messaging as tools for AI agents (Claude, Convogent, etc.).

## Architecture

```
AI Agent (Convogent / Claude Desktop)
        │
        │  SSE or Streamable-HTTP
        ▼
Karix MCP Server  (this repo, port 8001)
        │
        │  REST
        ├──▶ Karix Send API      (rcmapi.instaalerts.zone)
        └──▶ Karix Template API  (rcsgui.karix.solutions)
```

**Production:** `https://mcp.karix.online` (ALB → private EC2 10.1.17.16 via bastion 13.232.241.246)

---

## Endpoints

| Endpoint | Transport | Purpose |
|---|---|---|
| `GET  /health` | HTTP | Liveness check |
| `POST /oauth/token` | HTTP | Get Bearer token (Client Credentials) |
| `GET  /sse` | SSE | MCP for Convogent and SSE clients |
| `POST /mcp` | Streamable-HTTP | MCP for Claude Desktop, MCP Inspector |

---

## Tools

| Tool | Description |
|---|---|
| `get_sender_details` | List all sender IDs and WABA IDs on the account |
| `list_templates` | List approved / pending / rejected templates |
| `describe_template` | Full detail on one template including param count |
| `create_template` | Submit a new template for Meta approval |
| `delete_template` | Delete a template by ID |
| `send_template_message` | Send an approved template (single recipient) |
| `send_bulk_template_message` | Same template to multiple recipients |
| `send_personalized_bulk` | Different params per recipient |
| `send_text_message` | Free-form text (24-hour session window only) |
| `send_media_message` | Image, video, or document |
| `send_buttons_message` | Interactive quick-reply buttons |
| `send_list_message` | Interactive scrollable list |
| `send_cta_message` | CTA button with URL |
| `send_location_message` | Location pin |
| `request_location` | Ask user to share their location |
| `send_order_details` | ORDER_DETAILS template with Razorpay payment |
| `get_payment_status` | Poll Razorpay payment result |

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd karix-mcp
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"            # includes pytest for local dev
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — minimum required:
```
KARIX_API_KEY=<your_key>
KARIX_WABA_ID=<your_waba_id>
KARIX_SENDER_ID=<your_sender_id>
KARIX_ESME_ADDR=<your_esme_addr>
KARIX_SEND_BASE_URL=https://rcmapi.instaalerts.zone
KARIX_TEMPLATE_BASE_URL=https://rcsgui.karix.solutions
MCP_PORT=8001
JWT_SECRET=<generate: python -c "import secrets; print(secrets.token_hex(32))">
```

Secure the file:
```bash
chmod 600 .env
```

### 3. Run locally

```bash
python -m karix_mcp.app
# or
karix-mcp
```

Test:
```bash
curl http://localhost:8001/health
```

---

## Authentication

### With JWT_SECRET set (production)

All `/sse` and `/mcp` requests require a Bearer token.

**Step 1 — Get a token:**
```bash
curl -X POST https://mcp.karix.online/oauth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=<esme_addr>" \
  -d "client_secret=<api_key>"
```

Response:
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 86400,
  "sender_id": "919152004195",
  "waba_id": "494227720434920"
}
```

**Step 2 — Use the token:**
```bash
curl -H "Authorization: Bearer <jwt>" https://mcp.karix.online/health
```

Tokens expire after 24 hours.

### Without JWT_SECRET (dev / trusted network)

Server runs with no auth. Set `MCP_AUTH_TYPE: none` in Convogent.

---

## Convogent Integration

```
MCP_URL:       https://mcp.karix.online/sse
MCP_AUTH_TYPE: bearer
MCP_TOKEN:     <jwt from /oauth/token>
```

Tools used per node:
| Node | Tools |
|---|---|
| Node 9 — WhatsApp Send | `send_template_message` |
| Node 10 — Payment | `send_order_details`, `get_payment_status` |

---

## Production Deployment

### Server access

```bash
# Requires org VPN + PEM key at D:\karix-interna-AI-POC.pem
ssh -i "D:\karix-interna-AI-POC.pem" \
    -o ProxyCommand="ssh -i 'D:\karix-interna-AI-POC.pem' -W %h:%p ec2-user@13.232.241.246" \
    ubuntu@10.1.17.16
```

### Systemd service

```bash
sudo systemctl status karix-mcp
sudo systemctl restart karix-mcp
sudo journalctl -u karix-mcp -f        # live logs
```

### Deploy new code

```bash
# On app server
cd /home/ubuntu/karix-mcp
git pull
source .venv/bin/activate
pip install -e .
sudo systemctl restart karix-mcp
curl https://mcp.karix.online/health   # verify
```

---

## Runbook — MCP is down

| Symptom | Check | Fix |
|---|---|---|
| Convogent shows "MCP disconnected" | `curl https://mcp.karix.online/health` | If 502: restart service |
| `/health` returns 502 | `ssh` → `systemctl status karix-mcp` | `systemctl restart karix-mcp` |
| Service won't start | `journalctl -u karix-mcp -n 50` | Check for missing env var or import error |
| 401 on /sse | Token expired | Re-authenticate via `/oauth/token` |
| Templates not found | `curl .../health` + check KARIX_TEMPLATE_BASE_URL | Verify env var in `.env` |
| Send returns 400 | Check sender ID and WABA ID match | Run `get_sender_details` tool to list valid pairs |

---

## Known Karix API Quirks

- Auth header is **`Authentication`**, not `Authorization`
- Template lookup by name returns `errorCode 1012` — always use the list endpoint
- Free-form text (`send_text_message`) only works within the 24-hour customer session window
- ORDER_DETAILS button text must be exactly **"Review and Pay"** — Meta rejects any variation
- Amount fields use `{value, offset}` where offset=100 means paise (value=500000 → ₹5000)
