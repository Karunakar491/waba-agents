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
