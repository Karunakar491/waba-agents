# Hear what an agent actually says, before a customer does

## Job

Anyone about to call a change done opens a terminal and asks the real agent a
real question — and reads its actual words and how long it made the customer
wait — instead of writing "not proven as behaviour" again. No consumer is
messaged, nothing is billed, nothing is written.

Founder, 2026-09-24, on being told this existed: *"Yesssssssss"*.

## Proof

`node scripts/agent-ask.js 888030775306358784 "Hi, I want to know about my
career" "How much does a consultation cost?"` — against the live Astrotalk
agent on +91 85916 89475, 2026-09-24:

```
> Hi, I want to know about my career
  नमस्कार! आपके *Career & Business* के बारे में जानकर अच्छा लगा।
  आपके चार्ट में *10th house* (करियर का घर) बहुत कुछ कहता है, लेकिन सटीक
  जानकारी के लिए मुझे आपकी कुछ डिटेल्स चाहिए होंगी।
  क्या आप अपना *Full Name*, *Date of Birth*, *Time* और *Place of Birth* शेयर कर सकते हैं?
  — 13.4s

> How much does a consultation cost?
  Astrotalk par har astrologer ka apna *per-minute rate* hota hai, jo usually
  ₹20 se ₹140 ke beech rehta hai. Aapko jo bhi rate dikhega wahi lagega, koi
  extra hidden charge nahi hai...
  — 7.6s
```

That is the first time this repo has recorded an agent's own words through our
own stack. It answers in the right language, holds the thread across turns, and
asks for birth details the way the persona intends.

## What it found on the first run

- **Latency, measured rather than quoted.** ~15s for the first message of a
  conversation (15.7s, 14.9s, 13.4s), 8–9s for each one after (7.9s, 9.0s,
  7.6s). `STATE.md` carried 11.6s; the first reply a customer ever gets is worse
  than that, and the first reply is the one that decides whether they stay.
- **A second *fresh* conversation started within a minute of the first fails** —
  Meta 500 after ~31s. Reproduced three times, including as a deliberate
  control. Continuing an existing conversation with its `conversationId` is
  fine (7.9s, 9.0s), so multi-turn works and it is new-conversation creation
  that is rate-limited or throttled. Ours only relays, so this is Meta's.
- **The 10s timeout in the code comment is not enforced.**
  `AgentDeployService.test()` says "10s timeout enforced by the HTTP client";
  the failing calls took 31s. Either the client has no such timeout or it does
  not apply here.

### Not done

- No fix for any of the three. All recorded, none touched.
- Not wired into `npm run e2e`. It costs a real Meta call per question and is
  rate-limited to 500/hour per number, so it is a tool you reach for, not a
  suite that runs on every commit.
- Only ever run against Astrotalk. Untested against IndiaMART (off-limits) and
  the SMSA number.

## Notes

- **I first wrote in `STATE.md` that nothing used `agent_test`. That was
  wrong** — `AgentDeployService.test()` has proxied it since 2026-08 and two
  screens call it. The true gap was narrower and worse: it was shipped, worked
  all along, and no test ever called it.
- **It needs an `active` agent**, and our own backend refuses a draft with
  "Deploy your agent first to test it". So the only agents this can exercise
  today are customers'. A permanently active agent on the reserved test number
  would fix that, and is the founder's call because it puts an agent live on a
  real number.
