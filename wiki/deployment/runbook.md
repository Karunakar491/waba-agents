---
title: Deploy Runbook
tags: [deployment, runbook]
---

# Deploy Runbook

## Prerequisites
- VPN connected (bastion unreachable without it)
- PEM key at `D:/karix-mcp/karix-interna-AI-POC.pem`

## SSH Commands
```bash
# Bastion
ssh -i "D:/karix-mcp/karix-interna-AI-POC.pem" ec2-user@13.232.241.246

# App server (via bastion)
ssh -i "D:/karix-mcp/karix-interna-AI-POC.pem" \
  -o ProxyCommand="ssh -i 'D:/karix-mcp/karix-interna-AI-POC.pem' -o StrictHostKeyChecking=no -W %h:%p ec2-user@13.232.241.246" \
  ubuntu@10.1.17.16
```

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
