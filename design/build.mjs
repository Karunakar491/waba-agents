/**
 * Emits every action-screen artboard from one chrome template.
 *
 * Written because the first pass hand-copied the chrome into each file and it
 * drifted immediately — some artboards had no nav at all, and the response
 * pane moved between them. The founder: "In the previous screen the body
 * response was somewhere, here its something, the Nav bar doesnt exist."
 *
 * Chrome lives here once. Each screen supplies only what is actually
 * different: which action is open, which tab is active, the tab's content, and
 * the response state. Run `node build.mjs` after editing, then re-seed.
 */
import { writeFileSync } from 'node:fs'

const T = {
  teal: '#0F766E',
  ink: '#1F1F1F',
  muted: '#71717A',
  ghost: '#A1A1AA',
  line: '#E4E4E7',
  rowline: '#F0F0F1',
  amber: '#B45309',
  tint: '#F0FAF8',
}

const CSS = `
    body { margin: 0; font-family: Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: ${T.teal}; text-decoration: none; } a:hover { color: #115E56; }
    table { border-collapse: collapse; width: 100%; }
    .th { font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: ${T.muted}; text-align: left; padding: 0 12px; height: 32px; border-bottom: 1px solid ${T.line}; }
    .td { font-size: 13px; color: ${T.ink}; padding: 0 12px; height: 44px; border-bottom: 1px solid ${T.rowline}; }
    .tdc { font-size: 12.5px; color: ${T.ink}; padding: 0 12px; height: 40px; border-bottom: 1px solid ${T.rowline}; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
    .ghost { color: ${T.ghost}; }
    .sub { color: #52525B; }
    .sel { font-size: 12.5px; color: ${T.ink}; display: inline-flex; align-items: center; gap: 6px; }
    .lbl { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: ${T.muted}; }
    .cnt { font-size: 10.5px; color: ${T.muted}; background: #F4F4F5; border-radius: 5px; padding: 1px 5px; font-variant-numeric: tabular-nums; }
    .k { color: ${T.teal}; } .s { color: ${T.amber}; } .n { color: #6B4EE6; }
    .fix { border: 1px solid ${T.line}; border-radius: 6px; padding: 2px 8px; font-size: 12px; }
    .tok { font-size: 12px; background: ${T.tint}; color: ${T.teal}; border-radius: 5px; padding: 2px 6px; }
`

const caret = (c = T.ghost) =>
  `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`
const tick = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${T.teal}" stroke-width="2.6" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>`
const box = (on) =>
  `<span style="display: inline-block; width: 14px; height: 14px; border: 1.5px solid ${on ? '#D4D4D8' : '#E8E8EB'}; border-radius: 4px"></span>`
const dash = `<span class="ghost">&mdash;</span>`

const topbar = `
  <div style="height: 3px; background: #E73590"></div>
  <div style="height: 44px; background: #0A0A0A; display: flex; align-items: center; gap: 16px; padding: 0 16px; flex-shrink: 0">
    <div style="display: flex; align-items: center; gap: 8px; background: #1C1C20; border-radius: 999px; padding: 5px 12px">
      <span style="width: 6px; height: 6px; border-radius: 999px; background: #1EBA5D"></span>
      <span style="font-size: 12.5px; font-weight: 500; color: #FAFAFA">Business Agents</span>
    </div>
    <span style="font-size: 12.5px; color: ${T.ghost}">All clients</span>
    <span style="margin-left: auto; font-size: 12.5px; color: ${T.ghost}">demo@karix.online</span>
  </div>`

const rail = `
    <div style="width: 56px; background: #0A0A0A; display: flex; flex-direction: column; align-items: center; gap: 22px; padding: 14px 0; flex-shrink: 0">
      <div style="width: 30px; height: 30px; border-radius: 9px; background: ${T.teal}; display: flex; align-items: center; justify-content: center">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5.5a3 3 0 0 1 6 0V8"/></svg>
      </div>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#52525B" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.7" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#52525B" stroke-width="1.7" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 4-6"/></svg>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#52525B" stroke-width="1.7" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>`

/** The tree. `open` is the connector whose actions are expanded; `sel` the action. */
function sidebar({ open = 'supplier', sel = null }) {
  const chevD = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${T.muted}" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`
  const chevR = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${T.ghost}" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>`

  const action = (method, name) => {
    const on = sel === name
    const c = method === 'GET' ? T.teal : T.amber
    return `
      <div style="display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 16px 0 37px;${on ? ` background: ${T.tint}; border-left: 2px solid ${T.teal}` : ''}">
        <span class="mono" style="font-size: 10px; font-weight: 700; color: ${c}; width: 30px">${method}</span>
        <span class="mono" style="font-size: 12px;${on ? ' font-weight: 500' : ''}">${name}</span>
      </div>`
  }
  const connector = (key, label, count, actions) => `
      <div style="display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 16px">
        ${open === key ? chevD : chevR}
        <span style="font-size: 13px;${open === key ? ' font-weight: 500;' : ''} overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${label}</span>
        <span style="margin-left: auto; font-size: 11px; color: ${T.muted}; font-variant-numeric: tabular-nums">${count}</span>
      </div>${open === key ? actions : ''}`

  return `
    <div style="width: 288px; border-right: 1px solid ${T.line}; flex-shrink: 0; background: #FCFCFD; display: flex; flex-direction: column">
      <div style="height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 16px; border-bottom: 1px solid ${T.line}">
        <span class="lbl">Connectors</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${T.teal}" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </div>
      <div style="padding: 10px 12px">
        <div style="height: 32px; border: 1px solid ${T.line}; border-radius: 8px; display: flex; align-items: center; gap: 8px; padding: 0 10px; background: #FFFFFF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${T.ghost}" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <span style="font-size: 12.5px; color: ${T.ghost}">Filter</span>
        </div>
      </div>
      ${connector('supplier', 'IndiaMART Supplier Search', 3,
        action('GET', 'supplier_search') + action('POST', 'create_enquiry') + action('GET', 'enquiry_status'))}
      ${connector('kundli', 'AstroTalk Kundli', 1, action('POST', 'general_kundli'))}
      ${connector('pricing', 'IndiaMART Pricing', 1, '')}
      ${connector('sheets', 'Google Sheets Export', 0, '')}
    </div>`
}

function breadcrumb(parts) {
  const sep = `<span style="font-size: 12.5px; color: #D4D4D8">/</span>`
  const inner = parts
    .map((p, i) =>
      i === parts.length - 1
        ? `<span class="${p.mono ? 'mono ' : ''}" style="font-size: 15px; font-weight: 600">${p.text}</span>`
        : `<span style="font-size: 12.5px; color: ${T.muted}">${p.text}</span>`,
    )
    .join(sep)
  return `
      <div style="height: 48px; border-bottom: 1px solid ${T.line}; display: flex; align-items: center; gap: 10px; padding: 0 24px; flex-shrink: 0">
        ${inner}
      </div>`
}

function requestBar({ method, host, path, sendable = true }) {
  const c = method === 'GET' ? T.teal : T.amber
  return `
        <div style="display: flex; gap: 10px; flex-shrink: 0">
          <div style="display: flex; flex-grow: 1; min-width: 0; border: 1px solid ${T.line}; border-radius: 10px; overflow: hidden; height: 40px">
            <div style="display: flex; align-items: center; gap: 6px; padding: 0 12px; border-right: 1px solid ${T.line}; background: #FAFAFA">
              <span class="mono" style="font-size: 11.5px; font-weight: 700; color: ${c}">${method}</span>
              ${caret(T.muted)}
            </div>
            <div style="display: flex; align-items: center; padding: 0 10px; border-right: 1px solid ${T.line}; background: #FAFAFA">
              <span class="mono ghost" style="font-size: 12px">${host}</span>
            </div>
            <div style="display: flex; align-items: center; padding: 0 12px; flex-grow: 1">
              <span class="mono" style="font-size: 13px">${path}</span>
            </div>
          </div>
          <div style="display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 18px; border-radius: 10px; ${sendable ? `background: ${T.teal}; color: #FFFFFF` : `border: 1px solid ${T.line}; color: #C4C4C8`}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="${sendable ? '#FFFFFF' : '#C4C4C8'}"><path d="M8 5v14l11-7z"/></svg>
            <span style="font-size: 13px; font-weight: 600">Send</span>
          </div>
        </div>`
}

/** The one tab row. `active` is the id; counts and the docs dot are per screen. */
function tabs({ active, params, headers, body, bodyOff = false, docs = true }) {
  const item = (id, label, count) => {
    const on = active === id
    const off = id === 'body' && bodyOff
    const dot = id === 'docs' && docs
    return `<span style="display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; font-size: 13px; ${
      on ? `font-weight: 600; color: ${T.ink}; border-bottom: 2px solid ${T.teal}` : `color: ${off ? '#C4C4C8' : T.muted}`
    }">${label}${count ? `<span class="cnt">${count}</span>` : ''}${
      dot ? `<span style="width: 5px; height: 5px; border-radius: 999px; background: ${T.teal}"></span>` : ''
    }</span>`
  }
  return `
        <div style="display: flex; align-items: center; gap: 4px; margin-top: 16px; border-bottom: 1px solid ${T.line}; flex-shrink: 0">
          ${item('params', 'Params', params)}${item('auth', 'Auth', 0)}${item('headers', 'Headers', headers)}${item('body', 'Body', body)}${item('docs', 'Docs', 0)}
        </div>`
}

/** Pinned to the foot of the pane on EVERY action screen. */
function response(state) {
  if (state === 'idle') {
    return `
        <div style="border-top: 1px solid ${T.line}; height: 44px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; margin: 0 -24px; padding: 0 24px">
          <span class="lbl">Response</span>
          <span style="font-size: 12.5px; color: ${T.ghost}">Not sent yet</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${T.ghost}" stroke-width="2.4" stroke-linecap="round" style="margin-left: auto"><path d="M18 15l-6-6-6 6"/></svg>
        </div>`
  }
  const ok = state.ok
  return `
        <div style="border-top: 1px solid ${T.line}; flex-shrink: 0; margin: 0 -24px; padding: 0 24px; height: 268px; display: flex; flex-direction: column">
          <div style="height: 44px; display: flex; align-items: center; gap: 12px; flex-shrink: 0">
            <span class="lbl">Response</span>
            <span style="display: inline-flex; align-items: center; gap: 6px">
              <span style="width: 6px; height: 6px; border-radius: 999px; background: ${ok ? '#1EBA5D' : T.amber}"></span>
              <span style="font-size: 12.5px; font-weight: 600; color: ${ok ? '#15803D' : T.amber}">${state.status}</span>
            </span>
            <span style="font-size: 12.5px; color: ${T.muted}; font-variant-numeric: tabular-nums">${state.ms} ms</span>
            <span style="font-size: 12.5px; color: ${T.muted}; font-variant-numeric: tabular-nums">${state.size}</span>
            ${state.warn ? `<span style="font-size: 12px; color: ${T.amber}">${state.warn}</span>` : ''}
            <span style="margin-left: auto; display: inline-flex; gap: 10px">
              <span style="font-size: 12px; color: ${T.teal}; font-weight: 500">Body</span>
              <span style="font-size: 12px; color: ${T.ghost}">Headers</span>
            </span>
          </div>
          <div class="mono" style="border: 1px solid ${T.line}; border-radius: 10px; background: #FCFCFD; padding: 11px 13px; line-height: 1.6; font-size: 11.5px; flex-grow: 1; overflow: hidden; margin-bottom: 16px">${state.body}</div>
        </div>`
}

function screen({ file, crumbs, bar, tabRow, content, resp, tree }) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <style>${CSS}</style>
</helmet>

<div style="width: 1440px; height: 900px; background: #FFFFFF; color: ${T.ink}; display: flex; flex-direction: column; overflow: hidden">
${topbar}
  <div style="display: flex; flex-grow: 1; min-height: 0">
${rail}
${sidebar(tree)}
    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">
${breadcrumb(crumbs)}
      <div style="padding: 20px 24px 0; flex-grow: 1; min-height: 0; display: flex; flex-direction: column">
${bar}
${tabRow}
        <div style="flex-grow: 1; min-height: 0; overflow: hidden; padding-top: 18px">
${content}
        </div>
${resp}
      </div>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`
  writeFileSync(file, html)
  return file
}

export { T, CSS, caret, tick, box, dash, screen, requestBar, tabs, response, sidebar, breadcrumb }
