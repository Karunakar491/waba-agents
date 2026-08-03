"""Thin HTTP wrapper for the Karix RCM API.

Auth: the manually-issued API key is sent directly as the (non-standard)
`Authentication: Bearer <key>` header. No token exchange.
"""
import time
import requests


class KarixError(RuntimeError):
    pass


class KarixClient:
    def __init__(self, send_base: str, template_base: str, api_key: str,
                 waba_id: str, max_retries: int = 2, timeout: int = 20):
        self.send_base = send_base.rstrip("/")
        self.template_base = template_base.rstrip("/")
        self.api_key = api_key
        self.waba_id = waba_id
        self.max_retries = max_retries
        self.timeout = timeout

    def _headers(self) -> dict:
        return {"Authentication": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"}

    def _retry(self, fn):
        last = None
        for attempt in range(self.max_retries + 1):
            resp = fn()
            if resp.status_code < 500:
                return resp
            last = resp
            time.sleep(0.5 * (2 ** attempt))
        return last

    def send_message(self, body: dict) -> dict:
        url = f"{self.send_base}/services/rcm/sendMessage"
        resp = self._retry(lambda: requests.post(
            url, headers=self._headers(), json=body, timeout=self.timeout))
        if resp.status_code >= 400:
            raise KarixError(f"sendMessage failed {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def list_templates(self, status: str = None, date_from: str = None,
                       date_to: str = None) -> dict:
        url = f"{self.template_base}/api/v1.0/template/{self.waba_id}"
        params = {}
        if status:
            params["status"] = status
        if date_from:
            params["from"] = date_from
        if date_to:
            params["to"] = date_to
        resp = self._retry(lambda: requests.get(
            url, headers=self._headers(), params=params, timeout=self.timeout))
        if resp.status_code >= 400:
            raise KarixError(f"list_templates failed {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def get_template(self, template_id: str) -> dict:
        url = f"{self.template_base}/api/v1.0/template/{self.waba_id}/{template_id}"
        resp = self._retry(lambda: requests.get(
            url, headers=self._headers(), timeout=self.timeout))
        if resp.status_code >= 400:
            raise KarixError(f"get_template failed {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def create_template(self, payload: dict) -> dict:
        """POST /api/v1.0/template/{wabaId} — payload shape per Karix RCM Template
        API docs: {template_name, language, category, components: [...], ...}.
        Validate with validator.validate_template() before calling this."""
        url = f"{self.template_base}/api/v1.0/template/{self.waba_id}"
        resp = self._retry(lambda: requests.post(
            url, headers=self._headers(), json=payload, timeout=self.timeout))
        if resp.status_code >= 400:
            raise KarixError(f"create_template failed {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def delete_template(self, template_id: str) -> dict:
        """DELETE /api/v1.0/template/{wabaId}/{templateId}."""
        url = f"{self.template_base}/api/v1.0/template/{self.waba_id}/{template_id}"
        resp = self._retry(lambda: requests.delete(
            url, headers=self._headers(), timeout=self.timeout))
        if resp.status_code >= 400:
            raise KarixError(f"delete_template failed {resp.status_code}: {resp.text[:300]}")
        return resp.json() if resp.text else {}

    def edit_template(self, template_id: str, components: list, alt_temp_body: str = None,
                      edit_alt_body: str = None, allow_category_change: bool = True) -> dict:
        """POST /api/v1.0/template/{wabaId}/edit/{templateId}?allowCategoryChange=true.
        Edit REPLACES components entirely — caller must include everything to keep.
        Only allowed when template status is Approved/Rejected/Paused, and Karix
        rate-limits edits (1x/day, 10x/30days for Approved templates) — this
        service doesn't track edit history locally (no duplicate source of
        truth for live template state), so a caller hitting the rate limit
        will see it surface as a Karix API error here, not a pre-check."""
        url = f"{self.template_base}/api/v1.0/template/{self.waba_id}/edit/{template_id}"
        payload = {"components": components}
        if alt_temp_body is not None:
            payload["alt_temp_body"] = alt_temp_body
        if edit_alt_body is not None:
            payload["edit_alt_body"] = edit_alt_body
        resp = self._retry(lambda: requests.post(
            url, headers=self._headers(), json=payload,
            params={"allowCategoryChange": str(allow_category_change).lower()},
            timeout=self.timeout))
        if resp.status_code >= 400:
            raise KarixError(f"edit_template failed {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def upload_media(self, file_bytes: bytes, filename: str, mime_type: str, category: str) -> dict:
        """POST /api/v1.0/template/{wabaId}/media (multipart) — returns a fileHandle
        to reference in a HEADER component's example.header_handle.

        category must be 'image' | 'video' | 'document' (sent as file_type — NOT
        the MIME type; an earlier attempt using the MIME type was confirmed wrong,
        Karix's own layer rejected it before ever reaching Meta).

        KNOWN OPEN BUG (filed with Karix support, unresolved as of the superagent
        project that first hit this): the returned handle's embedded type marker
        is malformed for images — decoding the base64 segment gives the literal
        broken string "image=" instead of "image/png", causing Meta to reject
        templates using this handle with error_subcode 2388084 ("File type not
        supported"), even for genuinely valid files. NOT fixed here — surfacing
        it via the tool's error path is honest; silently "fixing" it without a
        confirmed working alternative would just hide the failure differently.
        """
        if category not in ("image", "video", "document"):
            raise ValueError(f"Invalid category \"{category}\" — must be image, video, or document")
        url = f"{self.template_base}/api/v1.0/template/{self.waba_id}/media"
        headers = {"Authentication": f"Bearer {self.api_key}", "Accept": "application/json"}
        files = {"file": (filename, file_bytes, mime_type)}
        data = {"file_type": category}
        resp = self._retry(lambda: requests.post(
            url, headers=headers, files=files, data=data,
            params={"mediaType": category.upper()}, timeout=self.timeout))
        if resp.status_code >= 400:
            raise KarixError(f"upload_media failed {resp.status_code}: {resp.text[:300]}")
        return resp.json()
