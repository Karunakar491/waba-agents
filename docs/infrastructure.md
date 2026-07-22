# Infrastructure
## Meta Business Agent Platform

## AWS Instance

| Detail | Value |
|--------|-------|
| Bastion | ec2-user@13.232.241.246 |
| App server | ubuntu@10.1.17.16 (private — jump via bastion) |
| VPN | Required to reach bastion |
| PEM key | D:\karix-mcp\karix-interna-AI-POC.pem |

### SSH Command
```bash
ssh -i "D:/karix-mcp/karix-interna-AI-POC.pem" \
    -o ProxyCommand="ssh -i 'D:/karix-mcp/karix-interna-AI-POC.pem' -W %h:%p -o StrictHostKeyChecking=no ec2-user@13.232.241.246" \
    ubuntu@10.1.17.16
```

## Server State (as of 2026-07-16)

**OS:** Ubuntu 22.04.5 LTS  
**Instance:** t3.medium (2 vCPU, 3.8 GB RAM)  
**Disk:** 20 GB total, ~14 GB free

### Installed Services

| Service | Version | Port | Systemd unit | Notes |
|---------|---------|------|--------------|-------|
| Java | 21.0.11 (OpenJDK) | — | — | Default via update-alternatives |
| MySQL | 8.0.46 | 3306 (localhost only) | mysql | DB: meta_agent_db, User: meta_agent |
| Redis | 8.8.0 | 6379 (localhost only) | redis-server | Password: MetaAgent2024 |
| RabbitMQ | (apt default) | 5672 (AMQP), 15672 (mgmt) | rabbitmq-server | vhost: meta_agent_vhost, user: meta_agent |
| Nginx | — | 80 | nginx | Pre-existing — do not remove |

### Pre-existing Services (do not touch)

| Service | Port | Notes |
|---------|------|-------|
| karix-mcp | 8000 | Python — leave running |
| karix-messaging | 8080 | Java 17, Spring Boot — can pause for our app |
| wismo-mcp | 8001 | Python — leave running |
| cloudflared | — | Tunnel — leave running |

### Our App Port
`8080` — requires pausing karix-messaging first (`sudo systemctl stop karix-messaging`)

### Credentials (dev only — rotate before staging)

| Service | Credential |
|---------|-----------|
| MySQL root | root / MetaAgent@2024! |
| MySQL app | meta_agent / MetaAgent@2024! |
| MySQL DB | meta_agent_db |
| Redis | requirepass MetaAgent2024 |
| RabbitMQ | meta_agent / MetaAgent2024 on vhost meta_agent_vhost |

## Instance Sizing

| Environment | Instance | Services |
|-------------|----------|---------|
| Dev | t3.medium (2 vCPU, 4GB) — current VM | All services (bare metal) |
| Staging | t3.large (2 vCPU, 8GB) — to provision | All services (Docker Compose) |
| Production app | t3.xlarge (4 vCPU, 16GB) — to provision | Backend + Nginx + Redis + RabbitMQ |
| Production DB | t3.large (2 vCPU, 8GB) — to provision | MySQL only — never shared |

## Deployment Strategy
- Bare metal on dev (no Docker — RAM too tight)
- Docker Compose for staging
- K8s when load demands it — not before
- DB always on a dedicated instance — never co-located with app
