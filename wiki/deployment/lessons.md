---
title: Hard-Won Deployment Lessons
tags: [deployment, lessons]
---

# Hard-Won Deployment Lessons

Each of these caused a crash cycle on the first deploy. Know them before touching the server.

## 1. NODE_ID must be env var — not JVM flag
```bash
# WRONG
java -DNODE_ID=1 -jar ...

# CORRECT
env NODE_ID=1 java -jar ...
```
`PlatformApplication.main()` reads `System.getenv("NODE_ID")`, not system properties.

## 2. JWT uses key file paths — not inline PEM
Properties: `jwt.private-key-path` and `jwt.public-key-path`
Keys live at: `/opt/metaagent/keys/jwt-private.pem` and `jwt-public.pem`
Never embed PEM in application.yml — multiline breaks env var sourcing.

## 3. lombok.config required for @Qualifier
File: `backend/lombok.config`
Content: `lombok.copyableAnnotations += org.springframework.beans.factory.annotation.Qualifier`
Without it, Spring can't resolve which of the two RedisTemplate beans to inject.

## 4. RedisConfig — cacheRedisConnectionFactory must be @Primary
Two LettuceConnectionFactory beans (DB0 cache, DB1 security).
Spring Boot auto-config picks one — needs `@Primary` on cache bean.
Also mark `cacheRedisTemplate` as `@Primary`.

## 5. CSRF must be fully disabled
Stateless JWT API. `.csrf(csrf -> csrf.disable())` — not just webhook paths.

## 6. application.yml must include meta.api.version = v19.0
`MetaApiClient` injects `${meta.api.version}` — fails to start if missing.

## 7. pkill kills the SSH session
```bash
# WRONG — kills SSH
pkill -f platform-0.1.0-SNAPSHOT

# CORRECT
kill $(cat /opt/metaagent/app.pid)
```

## 8. SCP via bastion requires ProxyCommand
```bash
scp -o "ProxyCommand=ssh -W %h:%p -i KEY ec2-user@BASTION" KEY LOCAL ubuntu@SERVER:REMOTE
```

## 9. Nested SSH for commands (SSH agent not running in Bash tool)
```bash
ssh -i KEY ec2-user@BASTION "ssh -i /tmp/deploy.pem ubuntu@SERVER 'command'"
```

## 10. Never SCP application.yml to the server
The server keeps its own `/opt/metaagent/src/main/resources/application.yml` with hardcoded dev credentials.
SCP'ing our source overwrites it → app fails with unresolved `${META_API_TOKEN}` placeholder.
Build on server: `cd /opt/metaagent && mvn clean package -DskipTests`
