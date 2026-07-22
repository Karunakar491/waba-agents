---
title: Decisions
tags: [decisions, index, adr]
---

# Decisions

Every architectural and product decision with date and rationale.

## Stack Decisions
- [[stack-backend|Backend Stack]] — Java 21, Spring Boot 3, MySQL only, RestClient
- [[stack-frontend|Frontend Stack]] — Shadcn/ui + Tailwind (Ant Design rejected)
- [[maker-checker|Maker-Checker Process]] — PM + EM + EL gates, no self-approval

## Architecture Decisions
- [[mysql-only|MySQL Only for Analytics]] — ClickHouse dropped (cost + ops complexity)
- [[meta-ai-native|Meta Runs AI Natively]] — we are config layer, not AI layer
- [[jwt-cookies|JWT in httpOnly Cookie]] — RS256, SameSite=Strict, 15min expiry
- [[tsid|TSID for IDs]] — time-sorted BIGINT, NODE_ID env var

## Product Decisions
- [[product-scope|Product Scope]] — Karix BSP existing clients, not new Meta onboarding
- [[wizard|5-Step Wizard]] — live preview, <3min time-to-first-value
