"""
Mock Meta Business Agent API + Graph API server.

Purpose: aggressive E2E testing of the Meta Business Agent Platform WITHOUT
touching the real Meta API or the real shared Karix WABA. In-memory, stateful,
keyed by phone_number_id / waba_id. No auth enforcement (local-only), but any
Authorization header sent by the real MetaApiClient is accepted and ignored.

Run:
    python mock_server.py            # port 9090 (default)
    PORT=9091 python mock_server.py  # override port

Stop: Ctrl+C, or kill the process started in background.

See docs/e2e-test-runs/2026-07-27/aggressive-test-plan.md for the test plan
that exercises this server.
"""
import os
import time
import uuid
from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory state, keyed by phone_number_id (entity_id)
# ---------------------------------------------------------------------------
settings_by_phone = {}      # phone_number_id -> BizAIOmniChannelSettingsResponse dict
skills_by_phone = {}        # phone_number_id -> {skill_id: skill_dict}
faqs_by_phone = {}          # phone_number_id -> {faq_id: faq_dict}
websites_by_phone = {}      # phone_number_id -> {website_id: website_dict}
files_by_phone = {}         # phone_number_id -> {file_id: file_dict}
connectors_by_phone = {}    # phone_number_id -> {connector_id: connector_dict}
tools_by_connector = {}     # connector_id -> {tool_id: tool_dict}

# waba_id -> list of phone number dicts (deterministic per waba_id, generated on first access)
phones_by_waba = {}


def now():
    return int(time.time())


def new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# Business Agent API — Eligibility
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_eligibility", methods=["GET"])
def agent_eligibility(phone_number_id):
    return jsonify({"is_eligible": True})


# ---------------------------------------------------------------------------
# Business Agent API — Settings
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_config/settings", methods=["GET"])
def get_settings(phone_number_id):
    existing = settings_by_phone.get(phone_number_id)
    if not existing:
        return jsonify([])
    return jsonify([existing])


@app.route("/<phone_number_id>/agent_config/settings", methods=["PUT"])
def put_settings(phone_number_id):
    body = request.get_json(silent=True) or {}
    existing = settings_by_phone.get(phone_number_id)
    agent_id = request.args.get("agent_id") or (existing or {}).get("agent_id") or new_id("mock-agent")

    response = {
        "agent_id": agent_id,
        "channel": "whatsapp",
        "rollout": body.get("rollout", (existing or {}).get("rollout", {"enabled": True})),
        "handoff": body.get("handoff", (existing or {}).get("handoff")),
        "followup": body.get("followup", (existing or {}).get("followup")),
        "ai_audience": body.get("ai_audience", (existing or {}).get("ai_audience", "EVERYONE")),
    }
    settings_by_phone[phone_number_id] = response
    return jsonify(response)


# ---------------------------------------------------------------------------
# Business Agent API — Skills
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_config/skills", methods=["GET"])
def list_skills(phone_number_id):
    return jsonify(list(skills_by_phone.get(phone_number_id, {}).values()))


@app.route("/<phone_number_id>/agent_config/skills", methods=["POST"])
def create_skill(phone_number_id):
    body = request.get_json(silent=True) or {}
    skill_id = new_id("mock-skill")
    skill = {
        "id": skill_id,
        "title": body.get("title"),
        "description": body.get("description"),
        "skill": body.get("skill"),
        "channel": "whatsapp",
        "created_at": now(),
        "metadata": body.get("metadata"),
    }
    skills_by_phone.setdefault(phone_number_id, {})[skill_id] = skill
    return jsonify(skill), 201


@app.route("/<phone_number_id>/agent_config/skills/<skill_id>", methods=["DELETE"])
def delete_skill(phone_number_id, skill_id):
    skills_by_phone.get(phone_number_id, {}).pop(skill_id, None)
    return "", 204


# ---------------------------------------------------------------------------
# Business Agent API — FAQ (duplicate question -> 409, mirrors real Meta bug)
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_config/faq", methods=["GET"])
def list_faqs(phone_number_id):
    return jsonify(list(faqs_by_phone.get(phone_number_id, {}).values()))


@app.route("/<phone_number_id>/agent_config/faq", methods=["POST"])
def create_faq(phone_number_id):
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    existing = faqs_by_phone.setdefault(phone_number_id, {})
    for faq in existing.values():
        if faq["question"].strip().lower() == question.lower():
            return jsonify({
                "title": "Duplicate FAQ",
                "detail": f"An FAQ with question '{question}' already exists for this phone number.",
            }), 409

    faq_id = new_id("mock-faq")
    faq = {
        "id": faq_id,
        "question": body.get("question"),
        "answer": body.get("answer"),
        "created_at": now(),
        "metadata": body.get("metadata"),
    }
    existing[faq_id] = faq
    return jsonify(faq), 201


@app.route("/<phone_number_id>/agent_config/faq/<faq_id>", methods=["DELETE"])
def delete_faq(phone_number_id, faq_id):
    faqs_by_phone.get(phone_number_id, {}).pop(faq_id, None)
    return "", 204


# ---------------------------------------------------------------------------
# Business Agent API — Websites
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_config/websites", methods=["POST"])
def create_website(phone_number_id):
    body = request.get_json(silent=True) or {}
    website_id = new_id("mock-site")
    website = {
        "id": website_id,
        "url": body.get("url"),
        "crawl_status": "completed",
        "pages_crawled": 3,
        "last_crawled_at": now(),
        "created_at": now(),
    }
    websites_by_phone.setdefault(phone_number_id, {})[website_id] = website
    return jsonify(website), 201


@app.route("/<phone_number_id>/agent_config/websites/<website_id>", methods=["DELETE"])
def delete_website(phone_number_id, website_id):
    websites_by_phone.get(phone_number_id, {}).pop(website_id, None)
    return "", 204


# ---------------------------------------------------------------------------
# Business Agent API — Files (multipart)
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_config/files", methods=["POST"])
def create_file(phone_number_id):
    file_name = request.form.get("file_name")
    if not file_name and "file" in request.files:
        file_name = request.files["file"].filename
    file_id = new_id("mock-file")
    file_obj = {"id": file_id, "file_name": file_name or "unnamed"}
    files_by_phone.setdefault(phone_number_id, {})[file_id] = file_obj
    return jsonify(file_obj), 201


@app.route("/<phone_number_id>/agent_config/files/<file_id>", methods=["DELETE"])
def delete_file(phone_number_id, file_id):
    files_by_phone.get(phone_number_id, {}).pop(file_id, None)
    return "", 204


# ---------------------------------------------------------------------------
# Business Agent API — Connectors
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_connectors", methods=["GET"])
def list_connectors(phone_number_id):
    return jsonify(list(connectors_by_phone.get(phone_number_id, {}).values()))


@app.route("/<phone_number_id>/agent_connectors", methods=["POST"])
def create_connector(phone_number_id):
    body = request.get_json(silent=True) or {}
    connector_id = new_id("mock-connector")
    connector = {
        "id": connector_id,
        "name": body.get("name"),
        "description": body.get("description"),
        "base_url": body.get("base_url"),
        "auth_type": body.get("auth_type", "NONE"),
        "auth_config": body.get("auth_config"),
        "mtls_config": None,
        "connection_status": {"status": "ACTIVE"},
        "user_auth_injection_config": body.get("user_auth_injection_config"),
    }
    connectors_by_phone.setdefault(phone_number_id, {})[connector_id] = connector
    tools_by_connector[connector_id] = {}
    return jsonify(connector), 201


@app.route("/<phone_number_id>/agent_connectors/<connector_id>", methods=["DELETE"])
def delete_connector(phone_number_id, connector_id):
    connectors_by_phone.get(phone_number_id, {}).pop(connector_id, None)
    tools_by_connector.pop(connector_id, None)
    return "", 204


# ---------------------------------------------------------------------------
# Business Agent API — Connector Tools
# (No real "run" invocation of send_template_message per connector-tools.md —
#  the doc only defines create/list/get/update/delete/run of the TOOL
#  DEFINITION. /run executes whatever request_definition describes against
#  base_url; it does not natively send WhatsApp templates. We mock /run
#  generically and special-case tools named like send_template_message so
#  the test plan has something concrete to assert on.)
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_connectors/<connector_id>/tools", methods=["GET"])
def list_tools(phone_number_id, connector_id):
    return jsonify(list(tools_by_connector.get(connector_id, {}).values()))


@app.route("/<phone_number_id>/agent_connectors/<connector_id>/tools", methods=["POST"])
def create_tool(phone_number_id, connector_id):
    body = request.get_json(silent=True) or {}
    tool_id = new_id("mock-tool")
    tool = {
        "id": tool_id,
        "name": body.get("name"),
        "description": body.get("description"),
        "request_definition": body.get("request_definition"),
        "user_auth_required": body.get("user_auth_required", False),
        "user_auth_action_config": body.get("user_auth_action_config"),
    }
    tools_by_connector.setdefault(connector_id, {})[tool_id] = tool
    return jsonify(tool), 201


@app.route("/<phone_number_id>/agent_connectors/<connector_id>/tools/<tool_id>", methods=["DELETE"])
def delete_tool(phone_number_id, connector_id, tool_id):
    tools_by_connector.get(connector_id, {}).pop(tool_id, None)
    return "", 204


@app.route("/<phone_number_id>/agent_connectors/<connector_id>/tools/<tool_id>/run", methods=["POST"])
def run_tool(phone_number_id, connector_id, tool_id):
    tool = tools_by_connector.get(connector_id, {}).get(tool_id)
    if not tool:
        return jsonify({"title": "Not found", "detail": "tool not found"}), 404

    body = request.get_json(silent=True) or {}
    name = (tool.get("name") or "").lower()
    if "send_template_message" in name or "template" in name:
        output = {
            "status": "queued",
            "message_id": new_id("mock-wamid"),
            "template_name": body.get("input"),
            "phone_number_id": phone_number_id,
            "note": "mock only — no real WhatsApp template was sent",
        }
    else:
        output = {"echo": body.get("input"), "note": "generic mock tool run"}

    return jsonify({"output": str(output), "status": "success"})


# ---------------------------------------------------------------------------
# Business Agent API — Agent Test (pattern-match against stored FAQs)
# ---------------------------------------------------------------------------
@app.route("/<phone_number_id>/agent_test", methods=["POST"])
def agent_test(phone_number_id):
    body = request.get_json(silent=True) or {}
    user_msg = (body.get("user_msg") or "").strip()
    conversation_id = body.get("conversation_id") or new_id("mock-convo")

    agent_response = f"[mock agent] Thanks for your message: \"{user_msg}\". How can I help further?"
    for faq in faqs_by_phone.get(phone_number_id, {}).values():
        question = faq.get("question", "")
        if question and (question.lower() in user_msg.lower() or user_msg.lower() in question.lower()):
            agent_response = faq.get("answer", agent_response)
            break
    else:
        for skill in skills_by_phone.get(phone_number_id, {}).values():
            title = skill.get("title", "")
            if title and title.replace("-", " ") in user_msg.lower():
                agent_response = f"[mock agent applying skill '{title}'] {skill.get('skill', '')[:200]}"
                break

    return jsonify({
        "message_id": new_id("mock-msg"),
        "agent_response": agent_response,
        "conversation_id": conversation_id,
        "timestamp": now(),
        "handoff_reason": None,
        "no_response_reason": None,
        "quick_replies": [],
        "product_variant_ids": [],
    })


# ---------------------------------------------------------------------------
# Graph API — {graphBaseUrl}/{graphVersion}/... mounted here as /graph/<version>/...
# ---------------------------------------------------------------------------
def _phones_for_waba(waba_id):
    if waba_id not in phones_by_waba:
        phones_by_waba[waba_id] = [
            {"id": "mock-phone-1", "display_phone_number": "+1 555 0100", "verified_name": "Mock Business One"},
            {"id": "mock-phone-2", "display_phone_number": "+1 555 0101", "verified_name": "Mock Business Two"},
            {"id": "mock-phone-3", "display_phone_number": "+1 555 0102", "verified_name": "Mock Business Three"},
        ]
    return phones_by_waba[waba_id]


@app.route("/graph/<version>/<waba_id>", methods=["GET"])
def graph_waba(version, waba_id):
    return jsonify({"id": waba_id, "name": "Mock Test WABA"})


@app.route("/graph/<version>/<waba_id>/phone_numbers", methods=["GET"])
def graph_phone_numbers(version, waba_id):
    return jsonify({"data": _phones_for_waba(waba_id)})


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "server": "mock-meta-api"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9090"))
    app.run(host="0.0.0.0", port=port, debug=False)
