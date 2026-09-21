# Reporting

What the founder gets at the end of a task. Not a summary of the work — a thing
he can act on without reading code.

Founder, 2026-09-21:

> *"If I tell a feature and after our discussion you built and tested a feature,
> you should tell me a report and tell me what all changes you made in the UI,
> how can I test it and am I ok with it or not and what did you test in testing."*

He is deciding whether to accept the change. Everything here serves that and
nothing else.

## The five parts

**1. What changed on screen.** Screen by screen, in the words a user would use.
"The Library section of the sidebar is now visible without expanding the rail" —
not "moved the guard out of the `iconOnly` conditional." Name the screen the way
the UI names it. If nothing visible changed, say so plainly and explain what
changed underneath and why he should care.

**2. How to check it yourself.** A numbered click path from login. Real values —
the actual agent name, the actual number. He should be able to follow it on his
phone or laptop without asking a single question. If a step needs a WhatsApp
message, give the exact text to send and the number to send it to.

**3. What was tested.** The e2e specs that ran, and what each one actually
asserted in user terms. Paste the run output. "Passed" without output is not a
test result.

**4. What was NOT tested, and why.** The part most reports omit and the part he
needs most. A journey that could not be driven, a state that could not be
reached, a check that needed a real customer handset. Say it, and say what it
would take. Silence here reads as a clean bill of health, and that is how a
"verified" feature reaches a user broken.

**5. Are you OK with this?** An explicit question, with the specific thing to say
yes or no to. Not "let me know if you have feedback."

## Rules

- **Screens, not files.** A file path appears only if he asked for it.
- **Every claim carries its evidence**, or is marked as untested. There is no
  third category.
- **Lead with what a user would notice.** Rank by user impact, not by how hard
  it was.
- **Short.** He is deciding, not studying. If the detail is genuinely long, it
  goes in a linked file and the report stays a page.
- **A screenshot beats a paragraph.** Playwright writes them to
  `frontend/e2e-shots/` — link them.
- **Never report a feature as done when only unit tests ran.** There is no local
  environment. Green unit tests are not evidence about the product.

## Template

```markdown
# <feature> — report

## What changed on screen
- **<Screen name>** — <what a user now sees or can do that they could not before>
- **<Screen name>** — <...>

## How to check it yourself
1. Log in at https://app.karix.online
2. <click path, real names and values>
3. <what you should see>

## What I tested
| Journey | Asserted | Result |
|---|---|---|
| <in user terms> | <what a user would notice> | pass / fail |

<paste the real run output>

## What I did NOT test
- <journey or state, and what it would take to cover it>

## Are you OK with this?
<the specific question — a yes ships it, a no says what to change>
```

## Related

- `CLAUDE.md` — the loop; REPORT is beat 4
- `docs/UI-INVENTORY.md` — every screen and control, and which e2e covers it
