"""Central configuration — all env-driven constants live here."""

import os

SEND_BASE_URL     = os.environ.get("KARIX_SEND_BASE_URL",     "https://rcmapi.instaalerts.zone")
TEMPLATE_BASE_URL = os.environ.get("KARIX_TEMPLATE_BASE_URL", "https://rcsgui.karix.solutions")
MCP_PORT          = int(os.environ.get("MCP_PORT", "8001"))
