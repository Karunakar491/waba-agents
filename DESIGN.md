Product Design System
A design system is a shared language. It lets every decision-maker move fast without moving alone.
This document exists so that anyone — designer, engineer, PM, founder — can look at a screen and know whether it belongs here.
For AI agents: how to use this document
You are generating UI for this product. Before writing any component:
Read §0 — The Philosophy. Hold the mood. The user is a business owner who is not technical. They are trying to make their business work better. Every pixel should feel like help, not homework.
Use tokens from §1–2. If you need a color, a font, a radius — it lives there. If the token doesn't exist, propose one. Do not hardcode.
Match a pattern from §6. Same problem, same solution. Consistency is generosity — it reduces cognitive load.
Run the Screen Intelligence check (§7). Every screen must answer: what does the user want to accomplish here? What might they be feeling? What can we offer? What can we remove?
When in doubt, choose warmth over coolness, clarity over cleverness, and restraint over decoration.
0. Philosophy — The Feel
The product is a conversation. The core interaction is a business talking to its customers. The UI is the frame around that conversation. The frame should be invisible until it needs to be helpful.
Our Point of View
The conversation is the product. The live chat preview — the business speaking as a real message thread — is the product's identity element. Wherever a conversation exists, it lives. Where one does not yet exist, we show the next step, never a blank void.
Karix is the connective tissue. Karix's brand DNA — dots and lines, pink-purple-green, creativity and connectivity — is not slapped on as decoration. It is expressed through motion (dots connecting), through color (purposeful, never noisy), and through language (conversational, never corporate).
The interface whispers, the content speaks. App chrome (nav, headers, toolbars) stays quiet — small type, muted color, no shadows. Content — forms, previews, status — is where color, weight, and attention live.
One reassurance per decision. Every screen where the user makes a consequential choice carries one plain-language sentence: what will happen, what won't happen, what they can undo. This is not a tooltip. It is a layout element.
Status is a sentence, not a badge. Active / paused / draft always render the same way: a colored dot (pulse for active) + a plain sentence. No background pills. No color roulette.
Motion is information. Every animation answers a question: "Where did this come from?" "Where did that go?" "What changed?" If an animation doesn't answer a question, it doesn't ship.
What We Are Not
Table
We are	We are not
A calm, warm workspace	A cold admin dashboard
Conversational and human	Jargony and corporate
Generous with whitespace, precise with density	Dense and cluttered, or wasteful and sparse
Subtle depth through borders and surface tints	Heavy shadows, glassmorphism, gradients as decoration
Motion that orients	Motion that entertains
One confident action per view	Competing CTAs
Plain words that explain consequences	Hype, exclamation marks, "supercharge"
Reference Bar
Vercel: Density without clutter. Every element earns its place. Subtle borders create depth without shadow.
Stripe: Clarity as a product feature. Forms that feel like conversations. Error states that teach.
Linear: Restraint as confidence. No decoration. No noise. Every pixel has a job.
WhatsApp: Familiarity. The user already knows how chat works. We don't reinvent it.
0.1 Responsive Breakpoints
Table
Breakpoint	Width	Behavior
Mobile (baseline)	375px+	Single column. Sidebar = off-canvas drawer. Every screen MUST work here
md	768px+	Sidebar becomes static rail (collapsible 240px ↔ 64px). Multi-panel layouts allowed
lg	1024px+	Multi-panel layouts fully visible
2xl cap	1400px	Container max — content never full-bleed beyond this
Design mobile-first. The 375px layout is the design; wider screens are the enhancement.
Container max-width: max-w-6xl (1152px) for content pages. The 1400px 2xl value is a viewport cap for the Tailwind container utility, not a content-width override.
1. Tokens — Change Once, Change Everywhere
Table
What	The ONE place
Colors (brand + semantic)	frontend/tailwind.config.js (theme.extend.colors) + frontend/src/index.css (CSS variables for shadcn semantic tokens)
Font family	frontend/tailwind.config.js (fontFamily.sans) + the font import in frontend/index.html
Radius scale	frontend/tailwind.config.js (borderRadius) / --radius in index.css
Dark mode	index.css .dark block (CSS variables only)
Hard rule: Components NEVER hardcode hex colors, font names, or px radii. Use token classes (bg-brand-pink, text-muted-foreground, rounded-xl).
Only exception: third-party UI mimicry constants, and those must still be named tokens (see whatsapp.* group in tailwind.config.js).
2. Brand Tokens (Karix DNA, Elevated)
Karix's identity is built on three ideas: dots (nodes, people, messages), lines (connections, flows, conversations), and three colors (pink for action, purple for depth, green for life). We honor this DNA but elevate it for 2026.
Brand Colors
Table
Token	Value	Use
brand-ink	#0A0F1E	Primary text, headers, the deep frame. Not black — it has a whisper of navy warmth
brand-navy	#11225F	Karix Blue Zodiac. The frame: sidebar, topbar, Command Bar. One continuous surface. Never content
brand-pink	#D6468F	Karix Cranberry. THE action color. Primary CTA only. One per viewport
brand-purple	#6B4EE6	Derived from Karix's purple heritage. Secondary emphasis, active nav states, subtle highlights
brand-green	#1EBA5D	Success, active status, positive confirmation
brand-periwinkle	#95A5CF	Karix Polo Blue. Tertiary accent for info states, subtle borders, hover tints
Semantic Colors
Table
Token	Light Mode	Dark Mode	Use
background	#FAFBFC	#0D1117	Page canvas. Not pure white — a breath of warmth
foreground	#0A0F1E	#F0F2F5	Primary text
card	#FFFFFF	#161B22	Elevated surfaces
card-foreground	#0A0F1E	#F0F2F5	Text on cards
muted	#F3F4F6	#21262D	Subtle backgrounds, hover states
muted-foreground	#6B7280	#8B949E	Secondary text, hints
border	#E5E7EB	#30363D	Dividers, card borders
border-subtle	#F3F4F6	#21262D	Hairline borders, separators
destructive	#DC2626	#F85149	Errors, destructive actions
destructive-foreground	#FFFFFF	#FFFFFF	Text on destructive
warning	#B45309	#F0883E	Warning states, amber dot
Typography
Table
Role	Classes
Page title	text-3xl font-semibold text-foreground tracking-tight
Section title	text-lg font-semibold text-foreground
Body	text-sm text-foreground leading-relaxed
Secondary/help	text-sm text-muted-foreground leading-relaxed
Micro (hints, counters)	text-xs text-muted-foreground
Label	text-xs font-medium text-muted-foreground uppercase tracking-wide
Font: Inter 400/500/600/700. Everything. No other family.
Radius
Table
Token	Value	Use
rounded-md	6px	Small chips, tags, inline badges
rounded-lg	10px	Buttons, inputs, dropdowns
rounded-xl	14px	Cards, panels, modals
rounded-2xl	18px	Large cards, feature panels
rounded-full	9999px	Avatars, icon-only circular controls only
Softer than sharp, never fully pill-shaped except avatars.
Shadow — Surface Separation, Never Decoration
Table
Token	Value	Use
shadow-resting	0 1px 2px rgba(10, 15, 30, 0.04), 0 1px 3px rgba(10, 15, 30, 0.02)	Cards, panels, dropdowns resting on the page. Always paired with border
shadow-lifted	0 4px 12px rgba(10, 15, 30, 0.08), 0 2px 4px rgba(10, 15, 30, 0.04)	Modals, popovers, floating surfaces
shadow-none	—	Buttons, chips, inputs, badges, nav items. Flat is the floor
Dark mode: elevation reads via lighter surface tints (--card lighter than --background), not shadow darkening. Shadow opacity drops to near-zero in dark mode by design.
Focus Ring
plain
focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background
On every interactive element. Not optional. Purple-tinted, not blue.
3. Spacing & Layout
Page container: max-w-2xl to max-w-6xl centered. Never full-bleed text beyond 1152px.
Vertical rhythm:
space-y-4 between related items
space-y-6 between form groups
space-y-8 between page sections
space-y-10 between major page areas
Cards: rounded-xl border bg-card p-6 shadow-resting
Buttons: rounded-lg — no shadow
Inputs: rounded-lg border bg-background px-3 py-2.5 text-sm + focus ring
Modals: max 640px wide on desktop, rounded-xl, shadow-lifted, focus trap + role="dialog" + aria-modal="true" + Escape-to-close + backdrop-click-dismiss
4. Interaction Baseline
Every screen should pass these checks. They are guardrails, not gates.
[ ] Loading state for any operation > 300ms. Skeleton preferred over spinner for layout shifts. Never a blank render during auth/entitlement checks.
[ ] Empty state with a clear next action. Never bare "No data."
[ ] Error state inline, next to where it went wrong. Toast as supplement, never replacement.
[ ] Disabled controls explained via inline validation. Never silently dead.
[ ] Primary action obvious in < 2s. Exactly one brand-pink CTA per section.
[ ] Button labels are verb + noun: "Create item", not "Submit."
[ ] Works at 375px width, or has an explicit desktop-only justification.
[ ] Motion ≤ 250ms ease-out for feedback; subtle entrance animations (fade + 8px translate, 200ms) for orientation. No ambient/looping motion.
[ ] One saturated accent (brand-pink) per viewport. brand-navy only in global chrome. brand-purple for secondary emphasis only.
[ ] Consequence line present on any screen with consequences (see §6 ConsequenceLine).
[ ] Keyboard: Escape closes modals, Enter submits, visible focus states.
[ ] ARIA: dialogs get role="dialog" aria-modal, toggles get aria-pressed, errors get role="alert".
[ ] Destructive actions require confirmation.
[ ] Navigation state visible (active nav item highlighted; sidebar collapsible, state persisted).
[ ] No user-entered text transformed. No capitalize/uppercase on names or user content.
5. Component Patterns
Same pattern = same component. Before building UI, check frontend/src/components/ and existing pages.
Nav Shell: AppShell
Collapsible sidebar (localStorage sidebar-collapsed), brand-navy, topbar with breadcrumb
Sidebar and Command Bar are ONE continuous frame system — same visual weight, same restraint, no gap implying unrelated elements
h-dvh not h-screen (mobile viewport stability)
Modals: Shared Modal Primitive
Every dialog renders through one component
Built-in focus trap, role="dialog", aria-modal, Escape-to-close, backdrop-dismiss
Max 640px wide on desktop, rounded-xl, shadow-lifted
No screen builds its own fixed inset-0 overlay from scratch
Wizards: Multi-Step Form Pattern
Steps rail | form | live preview (3-panel at lg+)
The preview is not a preview — it is the product. The live output lives there.
Mobile: accordion or tabbed steps
StatusIndicator
The ONLY way status renders anywhere:
HTML
<span class="inline-flex items-center gap-1.5">
  <span class="h-2 w-2 rounded-full bg-{state}" />
  <span class="text-sm text-muted-foreground">{plain label}</span>
</span>
brand-green dot (pulse animation for active only) + plain sentence
Never a tinted-background pill (bg-x/10 text-x rounded-full)
ConsequenceLine
One per screen with consequences:
HTML
<p class="text-sm text-muted-foreground">
  Nothing goes live until you confirm.
</p>
Placed directly under the page title or beside the primary CTA. Plain language. States what will/won't happen.
ErrorBanner
Every inline error render:
HTML
<div role="alert" class="text-sm text-destructive">
  <!-- optional retry action slot -->
</div>
No shadow. Inline, not a separate surface.
Wraps extractErrorMessage from lib/errors.ts
IconChip
Contained icon in a flat tinted square:
Scope: Dashboard feature-highlight tiles, avatar-style icons only
Never for empty states (those render live-preview/next-action)
Never as a logo/identity mark (wordmark only)
Two sizes: h-8 w-8 / h-10 w-10
Flat bg-{color}/10 tint, no gradient, no shadow
Inline Review Panel
A deliberate second confirmation pattern (not a Modal violation):
Renders as a border-l panel docked beside the main content
Confirmation needs to stay visible alongside the context that produced it
Scope: in-context review steps beside a persistent content pane only. Any other confirm/cancel dialog goes through the shared Modal
Bento Panel — Scoped, Not Universal
For overview/at-a-glance screens only (confirmed scope: Dashboard, Module overview):
Grid of varying-size cards (grid grid-cols-1 md:grid-cols-3 gap-4)
Cards spanning 1-2 columns by content weight
Not for: tables, forms, chat, wizards, comparable records that need scanning/sorting/filtering
Same radius/shadow/border tokens as every other card
Card content renders through existing identity primitives (StatusIndicator, live-preview snippet, ConsequenceLine)
Define overflow: single-card state must not look broken; narrative cards need line-clamp
6. Voice & Copy
Audience: a business owner who is not technical. They are setting up something they don't fully understand. They need to feel like someone competent is walking them through it.
Plain words. "Connect your number," never "Provision integration."
Explain consequences. "Nothing goes live until you confirm."
Errors say what to do next, not what failed internally.
No jargon, no API terminology in user-facing copy.
No exclamation marks. Confidence is quiet.
Use "you" and "your." The product is talking to a person.
7. Screen Intelligence — The Thinking Layer
Every screen must think before it renders. This is not an afterthought. It is the first thing you write when designing a screen.
The Four Questions
Before building any screen, answer these four questions in a comment block at the top of the page component:
tsx
/**
 * Screen: [PageName]
 *
 * 1. USER GOAL: What does the user want to accomplish here?
 *    → [One sentence. Be specific. "Send a message to their customers" not "Use the messaging feature."]
 *
 * 2. EMOTIONAL STATE: What might they be feeling?
 *    → [Anxious? Excited? Confused? Rushed? Overwhelmed by options?]
 *
 * 3. POSSIBLE ACTIONS: What can they do here?
 *    → [Primary action, secondary actions, escape hatches, undo paths]
 *
 * 4. HOW WE HELP: What can we offer to make them feel better?
 *    → [Reassurance, preview, progress indicator, plain-language explanation,
 *       smart defaults, auto-save, inline validation, next-step suggestion]
 */
The Intelligence Principles
1. Anticipate, Don't React
Don't wait for the user to make a mistake. Show them the path before they need to search for it.
Example: In a multi-step setup, don't show all form fields at once. Show the first step, validate it, then reveal the next. The UI should feel like a conversation, not an exam.
Example: If a user has connected an account but hasn't created their first item yet, the dashboard should suggest that as the primary action, not show an empty table.
2. State Is a Story
Every state of a screen — loading, empty, error, success, partial — should feel like the same screen, not a different page.
Loading: Skeleton that mirrors the final layout. Never a generic spinner in the center of a blank page.
Empty: Show the live preview or a next-action prompt. Never a centered card with a big icon.
Error: Inline, contextual, with a recovery path. "We couldn't connect. Check your details and try again." Not "Error 400: Bad Request."
Success: Brief, then move on. Success is not a destination — it's a signal to keep going.
3. The Output Is Always Present
Wherever possible, the live output preview should be visible. It is the product's heartbeat.
Creation flows: Live preview panel showing the output as the user configures it.
Dashboard: A status snippet with a recent activity excerpt.
Settings: A "Test your setup" quick-action that opens the preview.
Empty state: A sample output preview with a clear next step.
4. One Breath Per Screen
The user should be able to understand the screen in one breath — one glance, one read-through.
One primary action per section. If there are two equally important actions, the section is too big. Split it.
One reassurance line per decision. "Nothing goes live until you confirm."
One status narrative per entity. "Active since Tuesday." Not a badge + a timestamp + a tooltip.
5. Smart Defaults, Not Blank Slates
Never present a blank form unless the user truly needs to invent from scratch.
Name fields: Suggest a sensible default if we know the business name.
Message fields: Pre-fill with a sensible default the user can edit.
Time fields: Default to business hours in the user's timezone.
Selection lists: Show the most-used options first, not alphabetically.
6. Progress Is Visible
The user should always know where they are, how far they've come, and what's next.
Wizards: Step indicator with completed/pending states.
Forms: Section progress (e.g., "Step 2 of 4").
Long processes: Progress bar or percentage for setup/connect flows.
Background tasks: Toast or inline status for "Syncing..." with a time estimate if possible.
7. Undo Is a Feature
Every destructive or consequential action should have an undo path, or at minimum, a confirmation that explains the consequence.
Delete: "This will stop all activity. You can restore it within 30 days."
Change configuration: "Active items using this setting will be paused."
Disconnect: "Your setup will stop working. Your history will be preserved."
8. Contextual Help, Not Documentation
Help should appear exactly when and where it is needed.
Inline hints: "This is what your customers will see first." under the message field.
Tooltips: For technical terms that can't be avoided.
Expandable sections: "Not sure what to write? See examples." that expand in place.
Never: A "Read docs" link that dumps the user into a help center.
8. Animation & Motion
Philosophy
Motion answers questions. It does not decorate.
Table
Question	Motion
"Where did this come from?"	Enter: fade + 8px translateY, 200ms ease-out
"Where did that go?"	Exit: fade + 8px translateY (reverse), 150ms ease-in
"What changed?"	Layout shift: 200ms ease, layout prop where supported
"Is this active?"	Micro: scale 0.98 on press, 100ms
"Is something happening?"	Pulse: opacity 0.4→1, 2s ease-in-out, infinite (active status only)
Rules
No ambient/looping animation except active-status pulse.
No parallax, no scroll-triggered reveals, no decorative particle effects.
Entrance animations are subtle: 8px translate + opacity, not dramatic slides.
Stagger children by 30–50ms for lists appearing, never more than 100ms per item.
Respect prefers-reduced-motion: All animations should reduce to instant or fade-only when this is set.
Easing
css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
9. The Karix Identity — Dots, Lines, and Connection
Karix's logo is dots and lines. This is not a visual gimmick — it is the product's truth. Messages are dots. Conversations are lines connecting them. We express this subtly, not literally.
How We Express It
Connection lines in diagrams: Flow builders, logic trees, journeys — use subtle 1px lines (border-subtle) connecting nodes. Not decorative, structural.
Dot patterns in empty states: A subtle grid of low-opacity dots as background texture for empty/creation screens. Not animated. Not distracting.
Status dots: The StatusIndicator dot is a direct reference to the brand DNA. It is purposeful, not ornamental.
Motion: When elements connect or transition, use a brief line-draw or path animation (SVG stroke-dashoffset) to express "connection forming." Use sparingly — setup flows only.
How We Don't Express It
No animated dot grids in the background of every page.
No literal network diagrams as decoration.
No gradient meshes trying to look like "connectivity."
10. Dark Mode
Dark mode is not an inversion. It is a different time of day.
Background: #0D1117 — deep, not pure black. Warmth preserved.
Cards: #161B22 — elevated, but not floating.
Borders: #30363D — visible, but quiet.
Text: #F0F2F5 — high contrast, but not harsh white.
Accent colors unchanged: brand-pink, brand-purple, brand-green stay the same. They are vibrant enough for both modes.
Elevation: Reads via lighter surface tints, not shadow. --card is lighter than --background.
Focus ring: brand-purple/40 on dark surfaces reads as a soft glow.
Changelog
Table
Date	Change
2026-08-06	Complete rewrite. Elevated from compliance document to design philosophy. Replaced adversarial tone with collaborative language. Added Screen Intelligence framework (§7). Replaced #160E7A with Karix Blue Zodiac #11225F. Replaced #E73590 with Karix Cranberry #D6468F. Added brand-purple and brand-periwinkle from Karix heritage. Expanded animation guidelines. Added Karix identity expression (§9). Dark mode refined for warmth. Removed all feature-specific references (agents, templates, campaigns, WABA, etc.) to make the system future-proof.
"The best design system is the one people want to use."