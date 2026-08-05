---
title: Deploy Runbook
tags: [deployment, runbook]
---

# Deploy Runbook

## Prerequisites
- VPN connected (bastion unreachable without it) — direct SSH from an unconnected machine will time out, not refuse; a timeout means no route, check VPN before suspecting the key.
- PEM key — location varies by machine. Documented at `D:/karix-mcp/karix-interna-AI-POC.pem`; also seen placed directly at `D:/Meta business agents/karix-interna-AI-POC.pem`. **Check both** (or ask) before assuming SSH access is broken — a missing key looks identical to a wrong key (`Permission denied (publickey)`).

## Bastions (two confirmed working, 2026-08-04)
Either reaches the same private network and can SSH on to `ubuntu@10.1.17.16`:
- `ec2-user@13.232.241.246` (documented, prefer this one)
- `ubuntu@13.206.206.254` (undocumented fallback, confirmed working — same key)

## SSH Commands
```bash
# Bastion
ssh -i "D:/karix-mcp/karix-interna-AI-POC.pem" ec2-user@13.232.241.246

# App server (via bastion)
ssh -i "D:/karix-mcp/karix-interna-AI-POC.pem" \
  -o ProxyCommand="ssh -i 'D:/karix-mcp/karix-interna-AI-POC.pem' -o StrictHostKeyChecking=no -W %h:%p ec2-user@13.232.241.246" \
  ubuntu@10.1.17.16
```

**Alternative when ProxyCommand doesn't work in-shell (e.g. some sandboxed Bash tools mangle the nested quoting)**: nested SSH, run the inner command as a string (see lesson 9 in [[lessons|lessons]]):
```bash
ssh -i KEY ec2-user@13.232.241.246 "ssh -i /path/to/key/already/on/bastion ubuntu@10.1.17.16 'command'"
```
This requires copying the key onto the bastion first (`scp` it to `/tmp/` there) since the nested `ssh` runs from the bastion's own filesystem, not the local machine's.

**Important:** the systemd unit is `metaagent.service`, NOT a manual `java -jar` + `app.pid` process — check `sudo systemctl status metaagent` first. The `app.pid`/manual-kill steps below are from an earlier deploy convention; if `metaagent.service` is active, use `sudo systemctl restart metaagent` instead of steps 3-4, and confirm the exact jar path via `sudo systemctl cat metaagent.service`'s `ExecStart` line before overwriting anything — see lesson 12, there's a stray unused `platform.jar` file that is NOT what the service runs.

## Deploy Steps

### 1. Upload changed files only (NEVER scp -r src/)
**Server config lives at `/opt/metaagent-config/application.yml` — never touched by deployments.**

For a single changed file:
```bash
scp -i "D:/karix-mcp/karix-interna-AI-POC.pem" \
  -o ProxyCommand="ssh -i '...' -o StrictHostKeyChecking=no -W %h:%p ec2-user@13.232.241.246" \
  "D:/Meta business agents/backend/src/main/java/com/metaagent/platform/path/To/File.java" \
  ubuntu@10.1.17.16:/opt/metaagent/src/main/java/com/metaagent/platform/path/To/File.java
```

For multiple changed files (rsync — safe, incremental):
```bash
rsync -av --checksum \
  --exclude='src/main/resources/application.yml' \
  -e "ssh -i 'D:/karix-mcp/karix-interna-AI-POC.pem' -o ProxyCommand='ssh -i ... -W %h:%p ec2-user@13.232.241.246'" \
  "D:/Meta business agents/backend/src/" \
  ubuntu@10.1.17.16:/opt/metaagent/src/
```

### 2. Build on server
```bash
ssh ubuntu@10.1.17.16 "cd /opt/metaagent && mvn clean package -DskipTests 2>&1 | tail -5"
```

### 3. Stop old app
```bash
kill $(cat /opt/metaagent/app.pid)
sleep 2
```

### 4. Start new app
```bash
env NODE_ID=1 java -Xmx768m \
  -jar /opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar \
  --spring.config.location=file:/opt/metaagent-config/application.yml \
  > /opt/metaagent/app.log 2>&1 &
echo $! > /opt/metaagent/app.pid
```

### 5. Verify startup
```bash
sleep 25 && grep "Started PlatformApplication" /opt/metaagent/app.log
```

### 6. Health check
```bash
curl -s http://localhost:8080/actuator/health
# Expect 403 (correct — auth required) or 200 {"status":"UP"}
```

### 7. Restart karix-messaging (shared server — minimise downtime)
```bash
sudo systemctl start karix-messaging
```
