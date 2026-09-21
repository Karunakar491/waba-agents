# Human reply in the Inbox — deploy and proof

Job: `docs/jobs/human-reply-in-inbox.md`. Deployed to production 2026-09-21.

---

## 1. Built from master, not from a working tree

`/opt/metaagent/src` on the box is a fossil twelve days older than the jar beside
it, so the jar was built locally from a clean `master` worktree.

The working tree could not be used: it differs from master by 226 lines
(`describeMessage.ts` and its test, from the outbound-echo merge its base
predates). Building there would have shipped a bundle matching no commit — the
exact reason production stopped being traceable before.

```
mvn -q -o clean package -DskipTests   → exit 0
target/platform-0.1.0-SNAPSHOT.jar    87,072,470 bytes

contains: HumanReplyService PRESENT · MetaMessageSender PRESENT
          ThreadControlClient PRESENT · V58 migration PRESENT
```

## 2. Backend deploy

```
disk before:   /dev/root 20G 8.5G 11G 45% /
rollback jar:  /opt/metaagent-jars/rollback-before-human-reply-20260921200832.jar
               87,067,551 bytes (the exact jar that was running)
uploaded:      87,072,470 bytes local == 87,072,470 remote
swap + restart → systemctl is-active metaagent → active
```

Boot:

```
Successfully validated 57 migrations
Schema `meta_agent_db` is up to date        ← no migration ran
Started PlatformApplication                  14:41:20
errors in the last 400 lines: 26 — all "Failed to check/redeclare
auto-delete queue(s)", the pre-existing RabbitMQ noise. Nothing new.
```

**No schema change in this deploy.** V57 and V58 were already applied. Rollback
is a one-command jar swap with no database involvement.

Endpoint live, and refusing correctly:

```
POST /api/v1/conversations/999999999/reply
  → 404 {"success":false,"error":"Conversation not found"}
```

No message was sent. Another account's conversation returns the same "not
found" rather than "forbidden".

## 3. Frontend deploy

**A trap caught before it shipped.** `frontend/.env.production` is gitignored, so
the clean worktree did not have it, and `VITE_API_URL` defaults to
`http://localhost:8080/api/v1`. The first build baked that in — a completely
dead app. Copied the env file in and rebuilt; `/api/v1` confirmed present in the
bundle before anything was uploaded.

Swapped with two renames rather than `rm -rf` + copy, so the window where
nothing is served is the gap between two `mv` calls:

```
tar -xzf → /var/www/metaagent.new
mv /var/www/metaagent → /var/www/metaagent.bak-20260921-201659
mv /var/www/metaagent.new → /var/www/metaagent
```

Live bundle changed `index-BR1WrTMG.js` → `index-o1meQ71A.js`, and serves:

```
PRESENT  Reply to this customer
PRESENT  Hand back to agent
PRESENT  agent has stopped replying
```

## 4. The tests

**Before the deploy**, against production: **2 failed, 1 skipped.** Correct —
production served the previous build, so there was no composer to find. Passing
would have meant the selectors were wrong.

**After the deploy**, same spec, same target:

```
3 passed (22.8s)
  an operator can reach a reply box on a conversation
  the thread says whether the agent or a person is answering
  a waiting conversation offers a way to hand it back
```

Regression run — `smoke`, `inbox-and-delete`, `library-tables`,
`sidebar-library-nav`: **18 passed, 1 failed.**

Backend units: `HumanReplyServiceTest` **9/9**.

## 5. The one failure, which is not this change

`smoke.spec.ts` → *"Unpublish UI is dark in production — proves the feature
flag"*.

It asserts the Unpublish feature is off. `frontend/.env.production` has
`VITE_FEATURE_UNPUBLISH_UI=true`, deliberately, with a written rationale dated
2026-09-11 — the flag's four blocking findings were closed and it was turned on.

The test was written 2026-09-03, before that. Proof it is not a regression from
this deploy: the pattern it matches (`=X(void 0)`) is absent from **both**
bundles, with an identical 3 occurrences of `(void 0)` in each. Its outcome could
not have differed before and after. It has been failing since 2026-09-11 and
nothing deployed since to reveal it.

**Not "fixed" by flipping the flag.** The flag's state is a product decision that
was made; the test is what is out of date.

## 6. What is still unproven

**No real WhatsApp message has been sent by this code.** Everything above proves
the controls exist, the endpoint answers, and the refusals refuse. The delivery
path — operator types, customer's phone buzzes — has only ever run against a
mock.

That needs a real handset, and the founder is doing it: message
`+91 90100 11634`, reply from the Inbox, confirm it arrives, hand back, confirm
the agent answers the next one.

Until then this is deployed and unverified end to end.

## Rollback

```
sudo cp /opt/metaagent-jars/rollback-before-human-reply-20260921200832.jar \
        /opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar
sudo systemctl restart metaagent

sudo rm -rf /var/www/metaagent && \
sudo mv /var/www/metaagent.bak-20260921-201659 /var/www/metaagent
```

Under five minutes, no database touched, no data written by this change.
