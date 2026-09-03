---
title: Frontend Patterns & Traps
tags: [lessons, frontend, react, design, tokens]
---

# Frontend Patterns & Traps

> Each of these was a real bug in this codebase, most caught by review, some by the founder in production.

---

## Never unmount in the same tick as setting a message

`TemplateStudioPage.tsx`'s `TemplateBuilderForm` did:

```ts
onSuccess: (res) => { setResult({...}); if (ok) { onDone?.() } }
```

`onDone` unmounts the component. Both state updates land in the same React 18 batch, so the success message set by `setResult` is never painted — the form just vanishes with zero visible confirmation.

**Rule:** any time a mutation's `onSuccess` both sets a message the user is meant to read *and* triggers something that unmounts the component showing it, the message will never render. This reads as correct sequential code, which is why it's easy to miss.

## Read fast-changing values via ref, not the deps array

The shared `Modal` primitive's focus-trap effect had `[preventClose]` in its dependency array. `preventClose` is wired to `mutation.isPending`, which flips on every mutation. Every flip re-ran the whole effect — cleanup restored focus to the trigger, then setup re-captured `document.activeElement`, now wrongly the trigger itself. Focus got yanked out of the modal and the trigger reference was permanently clobbered, across all nine modals using the component.

**Rule:** an effect that captures something once on mount must not depend on a value that changes during the component's life. Read it through a ref.

## Check the parent's chrome before adding your own

`TemplateListEmptyStates.tsx` gave each empty state its own `rounded-xl border bg-card` wrapper — but the parent `TemplateListPanel.tsx` already had exactly that. A card nested in a card, doubled border and background, caught by the founder in production.

**Rule:** a Figma frame for a component is drawn as if it's the only thing on the page. Before giving any extracted component its own border, background or rounding, check what the call site already provides.

## No glassmorphism

The founder asked for glassmorphism (2026-08-06). DESIGN.md §0 already bans it — listed under "Don't" beside gradients and heavy shadows. Given the choice explicitly, he picked the shadow-elevation system instead.

**Why:** it's a recognisable "looks AI-generated" tell, and this product's daily surfaces are dense tables where backdrop-blur risks both contrast failures and jank.

## The auth response shape

`{ success: true, data: { userId, accountId, email, role } }` — the envelope is `data.data`, **not** `data.user`, and the field is `userId`, not `id`.

Reading `res.data.user` yields `undefined`; calling `setUser(undefined)` leaves `isAuthenticated: true` with `user: null`, so the dashboard loads and every user-dependent query fails silently.

## TSIDs must serialize as strings

TSIDs exceed `Number.MAX_SAFE_INTEGER`, so a `Long` serialized as a JSON number is silently corrupted in every browser — `882515538725572608` arrives as `...600`.

**Rule:** every TSID field needs `@JsonSerialize(using = ToStringSerializer.class)`. This is not theoretical: `Conversation.agentId` was found missing it on 2026-09-03, two lines below a field that had the annotation *and* a comment naming the hazard.

## Vite env vars are substituted at build time

`import.meta.env.X` becomes a literal in the bundle. A feature flag therefore proves itself by the compiled constant, not by grepping for the feature's strings — a runtime guard still ships the markup.

Related: `frontend/.env.production` is gitignored, so a build made without it ships an app whose API base is `localhost:8080`. It looks perfectly healthy to `curl`. There is a standing Playwright test asserting no bundle contains that string.

## Stack constraints

Shadcn/ui + Tailwind 3.x, Vite + React 18 + TS 5. The Shadcn CLI is unreliable — write `components.json` manually. Tokens live in `tailwind.config.js` and `index.css`; components never hardcode colour.

Anything ported from `karix-superagent` must be rebuilt on this stack: Shadcn/ui not plain HTML, MySQL not Postgres.

---

## Related

- [[frontend/INDEX|Frontend]] — stack, design system, brand
- [[lessons/verification|Verification]]
- [[lessons/backend-patterns|Backend Patterns]]
