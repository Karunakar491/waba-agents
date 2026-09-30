/**
 * Meta's rich-message component types, in one place.
 *
 * This list existed in four copies — StepSkills, UiSkillEditorModal,
 * UiSkillsPanel and UiSkillsTable — and they had already drifted: the
 * create-agent wizard rendered the raw API values (`carousel_quick_reply`) as
 * the words a business owner reads, while the other three showed labels.
 *
 * Source: docs/meta-api/ui-skills.md, refreshed 2026-09-24 from Meta's spec.
 * Nine types exist. `flow` is deliberately not offered — WhatsApp Flows are out
 * of scope — and it is not shown at all rather than shown disabled, because a
 * control for something we cannot do is an advertisement, not an explanation.
 */

/** Every value Meta's `component_type` enum accepts. */
export type UiComponentType =
  | 'carousel_quick_reply'
  | 'carousel_url'
  | 'cta_url'
  | 'flow'
  | 'image'
  | 'interactive_list'
  | 'interactive_reply_buttons'
  | 'location'
  | 'location_request'

export interface UiComponentSpec {
  value: UiComponentType
  /** What a business owner calls it. Never the enum value. */
  label: string
  /** One line: what the customer actually sees. */
  summary: string
  /**
   * What the instruction has to contain for this type.
   *
   * Meta has no body/media/button fields on this API — the `instruction` string
   * carries the trigger AND every value the component needs. Our screens used to
   * describe it as "when to send this" only, and a code comment claimed the
   * content "lives elsewhere on Meta". There is no elsewhere, so a rich message
   * written to our old labels could never be built.
   */
  needs: string
}

/** Offered to users, in the order they appear on screen. */
export const UI_COMPONENT_TYPES: UiComponentSpec[] = [
  {
    value: 'cta_url',
    label: 'Button that opens a link',
    summary: 'A message with one tappable button that opens a web page.',
    needs: 'the message text, the button label, and the link it opens',
  },
  {
    value: 'interactive_reply_buttons',
    label: 'Reply buttons',
    summary: 'A message with up to three buttons the customer taps to reply.',
    needs: 'the message text and the label on each button',
  },
  {
    value: 'interactive_list',
    label: 'Menu of choices',
    summary: 'A message that opens a list the customer picks from.',
    needs: "the message text, the button that opens the list, and each row's title and description",
  },
  {
    value: 'carousel_url',
    label: 'Cards with links',
    summary: 'A row of swipeable cards, each with a button that opens a link.',
    needs: 'the message text, and for every card its image, its text, its button label and its link',
  },
  {
    value: 'carousel_quick_reply',
    label: 'Cards with reply buttons',
    summary: 'A row of swipeable cards, each with buttons the customer taps to reply.',
    needs: 'the message text, and for every card its image, its text and its button labels',
  },
  {
    value: 'image',
    label: 'Image',
    summary: 'A picture, with optional text under it.',
    needs: 'the image to send and any caption that goes with it',
  },
  {
    value: 'location',
    label: 'Send a location',
    summary: 'A pin on a map — your shop, a pickup point.',
    needs: 'the place name, the address, and its latitude and longitude',
  },
  {
    value: 'location_request',
    label: 'Ask for their location',
    summary: "A prompt asking the customer to share where they are.",
    needs: 'the message text asking for it',
  },
]

/**
 * Types Meta accepts that we do not offer. Kept so a value arriving from Meta
 * still renders as words rather than as a raw enum on someone's screen.
 */
const NOT_OFFERED: Record<string, string> = {
  flow: 'WhatsApp Flow',
}

const LABELS: Record<string, string> = {
  ...Object.fromEntries(UI_COMPONENT_TYPES.map((t) => [t.value, t.label])),
  ...NOT_OFFERED,
}

/**
 * The words for a stored value. Falls back to the value itself only when Meta
 * has added a type we have never heard of — which is the one case where showing
 * it beats showing nothing.
 */
export function uiComponentLabel(value: string | null | undefined): string {
  if (!value) return 'Unknown'
  return LABELS[value] ?? value
}

export function uiComponentSpec(value: string | null | undefined): UiComponentSpec | null {
  return UI_COMPONENT_TYPES.find((t) => t.value === value) ?? null
}

/** The per-type hint shown under the instruction field. */
export function instructionHint(value: string | null | undefined): string {
  const spec = uiComponentSpec(value)
  if (!spec) return 'Say when the agent should send this, and include everything it needs to send.'
  return `Say when the agent should send this, and include ${spec.needs}.`
}
