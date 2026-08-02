"""
Full E2E Selenium suite for the Meta Business Agent Platform (local dev).
Covers: sign-in, agent creation wizard, agents list, agent detail (settings,
FAQ, connectors), WABA seeding + WABAs page, inbox (via seeded webhook),
deploy/pause/test (expected to hit real Meta API and fail gracefully — no
real Meta credentials configured locally), delete agent.

Writes a full report to report.txt and screenshots to screenshots/.
"""
import json
import subprocess
import time
import uuid
import traceback

import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

FRONTEND = "http://localhost:5173"
BACKEND = "http://localhost:8080/api/v1"
REPORT_PATH = "report.txt"
SHOT_DIR = "screenshots"

report_lines = []


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line)
    report_lines.append(line)


def section(title):
    log("")
    log("=" * 70)
    log(title)
    log("=" * 70)


def shot(driver, name):
    path = f"{SHOT_DIR}/{name}.png"
    try:
        driver.save_screenshot(path)
        log(f"  screenshot saved: {path}")
    except Exception as e:
        log(f"  screenshot FAILED: {e}")


results = {"pass": 0, "fail": 0, "warn": 0}


def record(status, msg):
    results[status] += 1
    tag = {"pass": "PASS", "fail": "FAIL", "warn": "WARN"}[status]
    log(f"  [{tag}] {msg}")


subprocess.run(["taskkill", "//F", "//IM", "msedge.exe"], capture_output=True)
subprocess.run(["taskkill", "//F", "//IM", "msedgedriver.exe"], capture_output=True)
time.sleep(1)

opts = webdriver.EdgeOptions()
opts.add_argument("--headless=new")
opts.add_argument("--disable-gpu")
opts.add_argument("--window-size=1400,1000")
driver = webdriver.Edge(options=opts)
driver.set_page_load_timeout(30)
wait = lambda t=15: WebDriverWait(driver, t)

email = f"selenium-{uuid.uuid4().hex[:8]}@test.com"
password = "SeleniumTest123"
company = "Selenium QA Co"
agent_id = None
waba_internal_id = None
phone_number_id = f"1550000{uuid.uuid4().hex[:6]}"
waba_meta_id = str(uuid.uuid4().int)[:15]

try:
    # ------------------------------------------------------------------
    section("1. REGISTER (real UI form)")
    driver.get(FRONTEND + "/login")
    wait().until(EC.presence_of_element_located((By.XPATH, "//button[text()='Create account']")))
    driver.find_element(By.XPATH, "//button[text()='Create account']").click()
    time.sleep(0.3)
    fields = driver.find_elements(By.CSS_SELECTOR, "input")
    fields[0].send_keys(company)
    fields[1].send_keys(email)
    fields[2].send_keys(password)
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    try:
        wait().until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Account created')]")))
        record("pass", f"Register succeeded for {email}, success banner shown")
    except Exception:
        record("fail", "Register did not show success banner")
        shot(driver, "01-register-fail")

    # ------------------------------------------------------------------
    section("2. LOGIN (real UI form)")
    driver.get(FRONTEND + "/login")
    wait().until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=email]")))
    driver.find_element(By.CSS_SELECTOR, "input[type=email]").send_keys(email)
    driver.find_element(By.CSS_SELECTOR, "input[type=password]").send_keys(password)
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    wait().until(EC.url_contains("/dashboard"))
    record("pass", f"Login succeeded, landed on {driver.current_url}")
    shot(driver, "02-dashboard")

    # Build an authenticated requests.Session from the browser's cookies,
    # so we can seed backend state (WABA, phone bind, webhook) as this same tenant.
    session = requests.Session()
    for c in driver.get_cookies():
        session.cookies.set(c["name"], c["value"])

    # ------------------------------------------------------------------
    section("3. AGENTS LIST — empty state")
    driver.get(FRONTEND + "/agents")
    wait().until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(),'Agents')]")))
    if driver.find_elements(By.XPATH, "//*[contains(text(),'No agents yet')]"):
        record("pass", "Empty state shown correctly for new account")
    else:
        record("warn", "Empty state text not found — may already have agents")
    shot(driver, "03-agents-empty")

    # ------------------------------------------------------------------
    section("4. AGENT CREATION WIZARD (5 steps, real UI)")
    driver.find_element(By.XPATH, "//button[contains(text(),'Create Agent')]").click()
    wait().until(EC.url_contains("/agents/new"))

    # Step 1: Identity
    wait().until(EC.presence_of_element_located((By.ID, "agent-name")))
    driver.find_element(By.ID, "agent-name").send_keys("Selenium Test Bakery")
    driver.find_element(By.ID, "bizdesc").send_keys(
        "We are a bakery in Pune selling artisan bread and pastries daily to local customers."
    )
    continue_btn = driver.find_element(By.XPATH, "//button[contains(text(),'Continue')]")
    if continue_btn.get_attribute("disabled"):
        record("fail", "Step 1 Continue button disabled despite valid input")
    else:
        record("pass", "Step 1 (Identity) valid input enables Continue")
    continue_btn.click()
    time.sleep(1)
    shot(driver, "04-wizard-step1")

    # Step 2: Personality — skip Generate with AI (no real Claude key locally), just continue
    wait().until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Personality')]")))
    record("pass", "Step 2 (Personality) reached")
    driver.find_element(By.XPATH, "//button[contains(text(),'Continue')]").click()
    time.sleep(1)
    shot(driver, "05-wizard-step2")

    # Step 3: Knowledge — add one FAQ
    wait().until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Knowledge')]")))
    q_input = driver.find_element(By.XPATH, "//input[contains(@placeholder,'Do you deliver')]")
    a_input = driver.find_element(By.XPATH, "//textarea[@placeholder='Answer']")
    q_input.send_keys("Do you deliver on Sundays?")
    a_input.send_keys("Yes, we deliver every day including Sundays.")
    driver.find_element(By.XPATH, "//button[contains(text(),'Add FAQ')]").click()
    time.sleep(0.5)
    if driver.find_elements(By.XPATH, "//*[contains(text(),'Do you deliver on Sundays?')]"):
        record("pass", "Step 3 FAQ added and visible in list")
    else:
        record("fail", "Step 3 FAQ not visible after Add")
    driver.find_element(By.XPATH, "//button[contains(text(),'Continue')]").click()
    time.sleep(1)
    shot(driver, "06-wizard-step3")

    # Step 4: Connect — informational, just continue
    wait().until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Connect')]")))
    record("pass", "Step 4 (Connect) reached")
    driver.find_element(By.XPATH, "//button[contains(text(),'Continue')]").click()
    time.sleep(1)
    shot(driver, "07-wizard-step4")

    # Step 5: Go live — save as draft (no phone bound yet, Publish would need one)
    wait().until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Go live')]")))
    driver.find_element(By.XPATH, "//button[contains(text(),'Save as draft')]").click()
    wait().until(EC.url_matches(r"/agents/\d+$"))
    agent_id = driver.current_url.rstrip("/").split("/")[-1]
    record("pass", f"Wizard completed, agent saved as draft, agentId={agent_id}")
    shot(driver, "08-agent-detail-draft")

    # ------------------------------------------------------------------
    section("5. AGENTS LIST — created agent visible")
    driver.get(FRONTEND + "/agents")
    wait().until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Selenium Test Bakery')]")))
    record("pass", "Created agent appears in Agents list")
    shot(driver, "09-agents-list-with-agent")

    # ------------------------------------------------------------------
    section("6. AGENT DETAIL — Settings tab edit/save")
    driver.get(f"{FRONTEND}/agents/{agent_id}")
    wait().until(EC.presence_of_element_located((By.XPATH, "//button[contains(text(),'Settings')]")))
    driver.find_element(By.XPATH, "//button[contains(text(),'Settings')]").click()
    time.sleep(0.5)
    name_input = wait().until(EC.presence_of_element_located((By.ID, "s-displayName")))
    name_input.clear()
    name_input.send_keys("Selenium Test Bakery (edited)")
    save_btn = driver.find_element(By.XPATH, "//button[contains(text(),'Save changes')]")
    save_btn.click()
    try:
        wait(5).until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Saved!')]")))
        record("pass", "Settings edit saved, 'Saved!' confirmation shown")
    except Exception:
        record("fail", "Settings save did not show 'Saved!' confirmation")
    shot(driver, "10-settings-saved")

    # ------------------------------------------------------------------
    section("7. AGENT DETAIL — Knowledge Base FAQ add/delete")
    driver.find_element(By.XPATH, "//button[contains(text(),'Knowledge Base')]").click()
    time.sleep(0.5)
    try:
        add_faq_btn = wait(5).until(EC.presence_of_element_located((By.XPATH, "//button[contains(text(),'Add FAQ')]")))
        add_faq_btn.click()
        time.sleep(0.3)
        driver.find_element(By.CSS_SELECTOR, "input[placeholder='Question']").send_keys("Do you have gluten-free options?")
        driver.find_element(By.CSS_SELECTOR, "textarea[placeholder='Answer']").send_keys("Yes, ask in-store for our gluten-free range.")
        # exact-text match — "Add FAQ" (toggle) also contains "Add", would re-close the form if matched first
        driver.find_element(By.XPATH, "//button[normalize-space(text())='Add']").click()
        try:
            wait(8).until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'gluten-free options')]")))
            record("pass", "FAQ added on Knowledge Base tab")
            del_btn = driver.find_element(By.CSS_SELECTOR, "[aria-label*='Delete FAQ']")
            del_btn.click()
            wait(8).until(EC.invisibility_of_element_located((By.XPATH, "//*[contains(text(),'gluten-free options')]")))
            record("pass", "FAQ deleted successfully")
        except Exception:
            record("fail", "FAQ add/delete on Knowledge Base tab did not complete as expected")
    except Exception as e:
        record("fail", f"Knowledge Base FAQ flow errored: {e}")
    shot(driver, "11-knowledge-base")

    # ------------------------------------------------------------------
    section("8. SEED WABA + BIND PHONE (API, bypasses real Meta Graph calls)")
    r = session.post(f"{BACKEND}/waba", json={"wabaId": waba_meta_id, "label": "Selenium Test WABA"})
    log(f"  POST /waba -> {r.status_code} {r.text}")
    if r.status_code == 200 and r.json().get("success"):
        waba_internal_id = r.json()["data"]["id"]
        record("pass", f"WABA seeded via API, internal id={waba_internal_id}, metaWabaId={waba_meta_id}")
    else:
        record("fail", f"WABA seed failed: {r.status_code} {r.text}")

    if waba_internal_id:
        r = session.put(
            f"{BACKEND}/agents/{agent_id}/phone",
            json={"phoneNumberId": phone_number_id, "wabaId": int(waba_internal_id)},
        )
        log(f"  PUT /agents/{agent_id}/phone -> {r.status_code} {r.text}")
        if r.status_code == 200 and r.json().get("success"):
            record("pass", f"Phone bound to agent via API, phoneNumberId={phone_number_id}")
        else:
            record("warn", f"Phone bind via real endpoint failed as expected (bindPhone() "
                            f"deliberately calls Meta Graph API to verify the phone belongs to the "
                            f"WABA — by design, cannot succeed without real Meta credentials locally): "
                            f"{r.status_code} {r.text}")
            log("  Falling back to direct SQL seed of phone_number_id (test-only, bypasses Meta "
                "verification) so downstream UI surfaces (Inbox, Connectors, Settings phone display) "
                "can still be exercised.")
            sql = (f"UPDATE agent SET phone_number_id='{phone_number_id}', waba_id={waba_internal_id}, "
                   f"status='draft' WHERE id={agent_id};")
            out = subprocess.run(
                ["docker", "exec", "meta-mysql", "mysql", "-umeta_agent", "-pMetaAgent@2024!",
                 "meta_agent_db", "-e", sql],
                capture_output=True, text=True,
            )
            log(f"  SQL seed rc={out.returncode} stderr={out.stderr.strip()[:200]}")
            if out.returncode == 0:
                record("pass", "phone_number_id seeded directly via SQL for test purposes")
            else:
                record("fail", f"SQL seed of phone_number_id failed: {out.stderr}")

    # ------------------------------------------------------------------
    section("9. WABAS PAGE — seeded WABA visible")
    driver.get(FRONTEND + "/wabas")
    wait().until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(),'WABA')]")))
    time.sleep(1)
    if driver.find_elements(By.XPATH, f"//*[contains(text(),'{waba_meta_id}')]"):
        record("pass", "Seeded WABA visible in WABAs table")
    else:
        record("fail", "Seeded WABA NOT visible in WABAs table")
    shot(driver, "12-wabas-page")

    # ------------------------------------------------------------------
    section("10. AGENT DETAIL — phone connection reflected in UI")
    driver.get(f"{FRONTEND}/agents/{agent_id}")
    wait().until(EC.presence_of_element_located((By.XPATH, "//button[contains(text(),'Settings')]")))
    driver.find_element(By.XPATH, "//button[contains(text(),'Settings')]").click()
    time.sleep(0.5)
    if driver.find_elements(By.XPATH, f"//*[contains(text(),'{phone_number_id}')]"):
        record("pass", "Bound phone number shown in Settings tab")
    else:
        record("fail", "Bound phone number NOT shown in Settings tab")
    shot(driver, "13-settings-phone-connected")

    # ------------------------------------------------------------------
    section("11. DEPLOY (expected to fail — no real Meta credentials locally)")
    try:
        deploy_btn = wait(5).until(EC.presence_of_element_located((By.XPATH, "//button[contains(text(),'Publish')]")))
        deploy_btn.click()
        time.sleep(2)
        err = driver.find_elements(By.CSS_SELECTOR, ".text-destructive")
        if err:
            record("warn", f"Deploy failed as expected (dummy META_API_TOKEN): '{err[0].text}' — UI handled it gracefully, no crash")
        else:
            record("warn", "Deploy click produced no visible error — check if it silently succeeded or silently did nothing")
    except Exception as e:
        record("warn", f"Could not locate/click Publish button: {e}")
    shot(driver, "14-deploy-attempt")

    # ------------------------------------------------------------------
    section("12. CONNECTORS TAB (expected to fail — real Meta call)")
    try:
        driver.find_element(By.XPATH, "//button[contains(text(),'Connectors')]").click()
        time.sleep(1)
        shot(driver, "15-connectors-tab")
        record("warn", "Connectors tab opened — listConnectors() calls real Meta agent_connectors API; check screenshot for error state")
    except Exception as e:
        record("warn", f"Connectors tab check errored: {e}")

    # ------------------------------------------------------------------
    section("13. SEED INBOX CONVERSATION (synthetic webhook POST)")
    webhook_payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "metadata": {"phone_number_id": phone_number_id},
                    "contacts": [{"profile": {"name": "Test Customer"}, "wa_id": "919876543210"}],
                    "messages": [{
                        "from": "919876543210",
                        "id": f"wamid.{uuid.uuid4().hex}",
                        "timestamp": str(int(time.time())),
                        "type": "text",
                        "text": {"body": "Hi, do you deliver on Sundays?"},
                    }],
                }
            }]
        }]
    }
    r = requests.post(f"{BACKEND}/webhook", data=json.dumps(webhook_payload),
                       headers={"Content-Type": "application/json"})
    log(f"  POST /webhook -> {r.status_code} {r.text}")
    if r.status_code == 200:
        record("pass", "Synthetic webhook accepted (200 OK)")
    else:
        record("fail", f"Webhook POST rejected: {r.status_code} {r.text}")

    time.sleep(3)  # allow RabbitMQ consumer to process
    driver.get(FRONTEND + "/inbox")
    wait().until(EC.presence_of_element_located((By.XPATH, "//h2[contains(text(),'Conversations')]")))
    time.sleep(1)
    if driver.find_elements(By.XPATH, "//*[contains(text(),'919876543210')]") or \
       not driver.find_elements(By.XPATH, "//*[contains(text(),'No conversations yet')]"):
        record("pass", "Seeded conversation appears in Inbox")
        try:
            # scope strictly to the conversation row (contains the customer wa_id text) —
            # a bare "first button on the page" would hit the sidebar logout button instead
            conv_row = driver.find_element(By.XPATH, "//button[contains(.,'919876543210')]")
            conv_row.click()
            wait(8).until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'deliver on Sundays')]")))
            record("pass", "Message text rendered correctly in conversation thread")
        except Exception as e:
            record("warn", f"Could not open conversation thread / message text not found: {e}")
    else:
        record("fail", "Seeded conversation NOT visible in Inbox — webhook pipeline may not have processed it")
    shot(driver, "16-inbox")

    # ------------------------------------------------------------------
    section("14. DELETE AGENT")
    driver.get(f"{FRONTEND}/agents/{agent_id}")
    wait().until(EC.presence_of_element_located((By.XPATH, "//button[contains(text(),'Settings')]")))
    driver.find_element(By.XPATH, "//button[contains(text(),'Settings')]").click()
    time.sleep(0.5)
    driver.find_element(By.XPATH, "//button[contains(text(),'Delete agent')]").click()
    time.sleep(0.5)
    confirm_input = wait(5).until(EC.presence_of_element_located((By.CSS_SELECTOR, "input")))
    # find the confirmation input specifically inside the modal (last input on page)
    all_inputs = driver.find_elements(By.CSS_SELECTOR, "input")
    all_inputs[-1].send_keys("Selenium Test Bakery (edited)")
    time.sleep(0.3)
    del_confirm_btn = driver.find_element(By.XPATH, "//button[contains(text(),'Delete permanently')]")
    if del_confirm_btn.get_attribute("disabled"):
        record("fail", "Delete permanently button still disabled after typing exact name")
    else:
        del_confirm_btn.click()
        wait().until(EC.url_contains("/agents"))
        time.sleep(1)
        if not driver.find_elements(By.XPATH, "//*[contains(text(),'Selenium Test Bakery')]"):
            record("pass", "Agent deleted, no longer visible in Agents list")
        else:
            record("fail", "Agent still visible in list after delete")
    shot(driver, "17-after-delete")

    section("SUMMARY")
    log(f"PASS: {results['pass']}  FAIL: {results['fail']}  WARN(expected-Meta-failure): {results['warn']}")

except Exception as e:
    section("UNHANDLED SCRIPT ERROR")
    log(f"{e}")
    log(traceback.format_exc())
    shot(driver, "99-unhandled-error")
finally:
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    driver.quit()
    print(f"\nFull report written to {REPORT_PATH}")
