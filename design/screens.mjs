/**
 * The action screens. Chrome comes from build.mjs; each entry supplies only
 * what differs. Run: node screens.mjs
 */
import { T, caret, tick, box, dash, screen, requestBar, tabs, response } from './build.mjs'

const SUP = [
  { text: 'Connectors' },
  { text: 'IndiaMART Supplier Search API' },
]
const row = (cells) => `<tr>${cells}</tr>`
const th = (label, w, align) =>
  `<th class="th"${w ? ` style="width: ${w}px${align ? `; text-align: ${align}` : ''}"` : align ? ` style="text-align: ${align}"` : ''}>${label}</th>`

const paramHead = `
              <thead><tr>
                ${th('Key', 150)}${th('Type', 100)}${th('Source', 196)}${th('Description')}${th('Required', 80, 'center')}
              </tr></thead>`

const trailing = (a = 'key', b = 'string', c = 'Agent') => `
                <tr style="background: #FCFCFD">
                  <td class="td mono ghost" style="border-bottom: none">${a}</td>
                  <td class="td ghost" style="border-bottom: none">${b}</td>
                  <td class="td ghost" style="border-bottom: none">${c}</td>
                  <td class="td ghost" style="border-bottom: none">description</td>
                  <td class="td" style="border-bottom: none; text-align: center">${box(false)}</td>
                </tr>`

const table = (head, body) => `
          <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden">
            <table>${head}<tbody>${body}</tbody></table>
          </div>`

/* ---------------------------------------------------------------- Headers */
screen({
  file: 'Headers.dc.html',
  tree: { open: 'supplier', sel: 'supplier_search' },
  crumbs: [...SUP, { text: 'supplier_search', mono: true }],
  bar: requestBar({ method: 'GET', host: 'script.google.com', path: '/exec' }),
  tabRow: tabs({ active: 'headers', params: 4, headers: 1, body: 0, bodyOff: true }),
  content: `
          <div class="lbl" style="display: block; margin-bottom: 8px">Headers</div>
          ${table(
            paramHead,
            row(`
                  <td class="td mono">X-Request-Source</td>
                  <td class="td sub">string</td>
                  <td class="td"><span class="sel">Fixed<span class="fix mono">whatsapp-agent</span></span></td>
                  <td class="td sub">Lets the API see which channel asked</td>
                  <td class="td" style="text-align: center">${box(true)}</td>`) + trailing('header', 'string', 'Fixed'),
          )}

          <div class="lbl" style="display: block; margin: 22px 0 8px">Sent automatically</div>
          <div style="border: 1px dashed ${T.line}; border-radius: 12px; overflow: hidden">
            <table><tbody>
              <tr>
                <td class="tdc mono" style="width: 200px; color: ${T.muted}">Content-Type</td>
                <td class="tdc mono" style="width: 240px; color: ${T.muted}">application/json</td>
                <td class="tdc" style="color: ${T.muted}">Fixed by Meta</td>
              </tr>
              <tr>
                <td class="tdc mono" style="color: ${T.muted}">X-Api-Key</td>
                <td class="tdc" style="color: ${T.muted}; font-style: italic">set at publish</td>
                <td class="tdc" style="color: ${T.muted}; border-bottom: none">Connector auth</td>
              </tr>
            </tbody></table>
          </div>
          <p style="font-size: 12px; color: ${T.muted}; margin: 10px 0 0">Read-only. Adding either of these by hand would be ignored.</p>`,
  resp: response('idle'),
})

/* ------------------------------------------------------------------- Auth */
screen({
  file: 'ActionAuth.dc.html',
  tree: { open: 'supplier', sel: 'supplier_search' },
  crumbs: [...SUP, { text: 'supplier_search', mono: true }],
  bar: requestBar({ method: 'GET', host: 'script.google.com', path: '/exec' }),
  tabRow: tabs({ active: 'auth', params: 4, headers: 1, body: 0, bodyOff: true }),
  content: `
          <div style="display: flex; align-items: center; gap: 9px; margin-bottom: 10px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${T.amber}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>
            <span style="font-size: 12.5px; color: ${T.amber}">Shared by all 3 actions on this connector &mdash; a change here changes it for every one of them.</span>
          </div>

          <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden; max-width: 900px">
            <table><tbody>
              <tr>
                <td style="width: 168px; color: ${T.muted}; font-size: 12.5px; padding: 0 16px; height: 44px; border-bottom: 1px solid ${T.rowline}">Base URL</td>
                <td class="td mono" style="border-bottom: 1px solid ${T.rowline}">https://script.google.com/macros/s/AKfycbz6VEDS7HQa1J/exec</td>
              </tr>
              <tr>
                <td style="width: 168px; color: ${T.muted}; font-size: 12.5px; padding: 0 16px; height: 44px; border-bottom: 1px solid ${T.rowline}">Auth</td>
                <td class="td" style="border-bottom: 1px solid ${T.rowline}"><span class="sel">API key${caret()}</span></td>
              </tr>
              <tr>
                <td style="width: 168px; color: ${T.muted}; font-size: 12.5px; padding: 13px 16px 0; vertical-align: top; border-bottom: 1px solid ${T.rowline}">Credentials</td>
                <td style="padding: 10px 12px 12px 0; border-bottom: 1px solid ${T.rowline}">
                  <div style="border: 1px solid ${T.line}; border-radius: 10px; overflow: hidden">
                    <table>
                      <thead><tr>
                        <th class="th" style="width: 180px">Field</th>
                        <th class="th" style="width: 112px">In</th>
                        <th class="th" style="width: 108px">Prefix</th>
                        <th class="th">Value</th>
                      </tr></thead>
                      <tbody>
                        <tr>
                          <td class="tdc mono">X-Api-Key</td>
                          <td class="tdc"><span class="sel">Header${caret()}</span></td>
                          <td class="tdc mono">Bearer</td>
                          <td class="tdc ghost">Typed at publish &mdash; never stored here</td>
                        </tr>
                        <tr>
                          <td class="tdc mono">account_id</td>
                          <td class="tdc"><span class="sel" style="color: ${T.teal}; font-weight: 500">Query${caret(T.teal)}</span></td>
                          <td class="tdc ghost">&mdash;</td>
                          <td class="tdc ghost">Typed at publish &mdash; never stored here</td>
                        </tr>
                        <tr style="background: #FCFCFD">
                          <td class="tdc mono ghost" style="border-bottom: none">field</td>
                          <td class="tdc ghost" style="border-bottom: none">Header</td>
                          <td class="tdc ghost" style="border-bottom: none">prefix</td>
                          <td class="tdc ghost" style="border-bottom: none">&mdash;</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style="font-size: 12px; color: ${T.muted}; margin: 9px 2px 0">Header, query or body &mdash; Meta accepts a credential in all three.</p>
                </td>
              </tr>
              <tr>
                <td style="width: 168px; color: ${T.muted}; font-size: 12.5px; padding: 0 16px; height: 44px; border-bottom: none">Client certificate</td>
                <td class="td" style="border-bottom: none"><span class="sel">Not required${caret()}</span></td>
              </tr>
            </tbody></table>
          </div>
          <p style="font-size: 12px; color: ${T.muted}; margin: 12px 0 0; max-width: 820px">Editable here because this is where it is used. It cannot be per-action &mdash; Meta keeps <span class="mono" style="font-size: 11.5px">base_url</span> and <span class="mono" style="font-size: 11.5px">auth_config</span> on the connector, and a tool cannot carry a credential of its own.</p>`,
  resp: response('idle'),
})

/* ------------------------------------------------------------------- Docs */
screen({
  file: 'Docs.dc.html',
  tree: { open: 'supplier', sel: 'supplier_search' },
  crumbs: [...SUP, { text: 'supplier_search', mono: true }],
  bar: requestBar({ method: 'GET', host: 'script.google.com', path: '/exec' }),
  tabRow: tabs({ active: 'docs', params: 4, headers: 1, body: 0, bodyOff: true }),
  content: `
          <div class="lbl" style="display: block; margin-bottom: 8px">Description</div>
          <div style="border: 1px solid ${T.line}; border-radius: 12px; padding: 14px 16px; max-width: 820px">
            <p style="font-size: 13px; margin: 0; line-height: 1.65">Finds suppliers for a product in a city. Ask the buyer for both before calling. If nothing comes back, say so plainly rather than naming a supplier that was not in the reply.</p>
          </div>
          <p style="font-size: 12.5px; color: #52525B; margin: 12px 0 0; max-width: 780px">Meta hands this to the model verbatim to decide when to call the action, which makes it the highest-consequence text on the screen. It is required, and there is nowhere else to put a constraint: Meta records no minimum, maximum or pattern for any field.</p>

          <div class="lbl" style="display: block; margin: 24px 0 8px">Name</div>
          <div style="border: 1px solid ${T.line}; border-radius: 10px; height: 40px; display: flex; align-items: center; padding: 0 12px; max-width: 420px">
            <span class="mono" style="font-size: 13px">supplier_search</span>
          </div>`,
  resp: response('idle'),
})

/* ------------------------------------------------------------- Body, sent */
const BODY_JSON = `<div>{</div>
<div>&nbsp;&nbsp;<span class="k">"customer"</span>: { <span class="k">"id"</span>: <span class="n">1024</span>, <span class="k">"phone"</span>: <span class="s">"{{customer_phone}}"</span> },</div>
<div>&nbsp;&nbsp;<span class="k">"lines"</span>: [{ <span class="k">"sku"</span>: <span class="s">"TMT-12"</span>, <span class="k">"qty"</span>: <span class="n">2</span> }],</div>
<div>&nbsp;&nbsp;<span class="k">"note"</span>: <span class="s">"needs delivery in Pune by Friday"</span></div>
<div>}</div>`

const fieldHead = `
              <thead><tr>
                ${th('Field', 190)}${th('Type', 118)}${th('Source', 186)}${th('Description')}${th('Required', 80, 'center')}
              </tr></thead>`

const f = (name, type, source, desc, req, container) => `
                <tr>
                  <td class="td mono${container ? ' ghost' : ''}">${name}</td>
                  <td class="td sub">${type}</td>
                  <td class="td">${source}</td>
                  <td class="td sub">${desc}</td>
                  <td class="td" style="text-align: center">${req}</td>
                </tr>`

screen({
  file: 'Body.dc.html',
  tree: { open: 'supplier', sel: 'create_enquiry' },
  crumbs: [...SUP, { text: 'create_enquiry', mono: true }],
  bar: requestBar({ method: 'POST', host: 'script.google.com', path: '/exec' }),
  tabRow: tabs({ active: 'body', params: 1, headers: 1, body: 7 }),
  content: `
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 9px">
            <div style="display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 8px">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${T.muted}" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
              <span style="font-size: 12.5px">Example JSON</span>
            </div>
            <span style="font-size: 12px; color: ${T.muted}">JSON only &mdash; Meta sends no other content type</span>
          </div>
          <div class="mono" style="border: 1px solid ${T.line}; border-radius: 10px; background: #FCFCFD; padding: 11px 13px; line-height: 1.6; font-size: 11.5px; margin-bottom: 16px">${BODY_JSON}</div>

          <div class="lbl" style="display: block; margin-bottom: 8px">Fields</div>
          ${table(
            fieldHead,
            f('customer', 'object', dash, 'The buyer raising the enquiry', tick, true) +
              f('customer.id', 'integer', `<span class="sel">Agent${caret()}</span>`, 'IndiaMART buyer id', dash) +
              f('customer.phone', 'string', `<span class="sel"><span class="tok mono">{{customer_phone}}</span>${caret()}</span>`, dash, dash) +
              f('lines[]', 'array of object', dash, 'One per product requested', tick, true) +
              f('lines[].sku', 'string', `<span class="sel">Agent${caret()}</span>`, 'Product code from the catalogue', dash) +
              f('lines[].qty', 'integer', `<span class="sel">Agent${caret()}</span>`, 'Quantity the buyer asked for', dash),
          )}
          <p style="font-size: 12px; color: ${T.muted}; margin: 10px 0 0">Nested fields carry their path. Required applies to top-level fields only &mdash; Meta records it nowhere else.</p>`,
  resp: response({
    ok: true,
    status: '200 OK',
    ms: 412,
    size: '1.2 KB',
    body: `<div>{</div>
<div>&nbsp;&nbsp;<span class="k">"enquiry_id"</span>: <span class="s">"ENQ-90412"</span>,</div>
<div>&nbsp;&nbsp;<span class="k">"status"</span>: <span class="s">"sent_to_suppliers"</span>,</div>
<div>&nbsp;&nbsp;<span class="k">"suppliers_notified"</span>: <span class="n">6</span></div>
<div>}</div>`,
  }),
})

/* ----------------------------------------------- Kundli: the real mapping */
const KUNDLI_JSON = `<div>{</div>
<div>&nbsp;&nbsp;<span class="k">"detail"</span>: {</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"name"</span>: <span class="s">"Test User"</span>, <span class="k">"gender"</span>: <span class="s">"Male"</span>,</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"day"</span>: <span class="n">1</span>, <span class="k">"month"</span>: <span class="n">1</span>, <span class="k">"year"</span>: <span class="n">1990</span>,</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"hour"</span>: <span class="n">12</span>, <span class="k">"min"</span>: <span class="n">0</span>, <span class="k">"sec"</span>: <span class="n">0</span>,</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"lat"</span>: <span class="n">28.6139</span>, <span class="k">"lon"</span>: <span class="n">77.209</span>,</div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"place"</span>: <span class="s">"New Delhi, India"</span>, <span class="k">"tzone"</span>: <span class="n">5.5</span></div>
<div>&nbsp;&nbsp;}</div>
<div>}</div>`

const kf = (name, type, source, desc, req) => `
                <tr>
                  <td class="tdc mono">${name}</td>
                  <td class="tdc sub">${type}</td>
                  <td class="tdc">${source}</td>
                  <td class="tdc sub">${desc}</td>
                  <td class="tdc" style="text-align: center">${req}</td>
                </tr>`

screen({
  file: 'Kundli.dc.html',
  tree: { open: 'kundli', sel: 'general_kundli' },
  crumbs: [{ text: 'Connectors' }, { text: 'AstroTalk Kundli' }, { text: 'general_kundli', mono: true }],
  bar: requestBar({ method: 'POST', host: 'api.kundali.astrotalk.com', path: '/v1/combined/general' }),
  tabRow: tabs({ active: 'body', params: 0, headers: 0, body: 13 }),
  content: `
          <div style="display: flex; gap: 18px; align-items: flex-start; height: 100%">
            <div style="width: 340px; flex-shrink: 0">
              <div style="display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px; border: 1px solid ${T.line}; border-radius: 8px; margin-bottom: 9px">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${T.muted}" stroke-width="2.4" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>
                <span style="font-size: 12.5px">Example JSON</span>
              </div>
              <div class="mono" style="border: 1px solid ${T.line}; border-radius: 10px; background: #FCFCFD; padding: 11px 13px; line-height: 1.55; font-size: 11px">${KUNDLI_JSON}</div>
              <p style="font-size: 11.5px; color: ${T.muted}; margin: 10px 2px 0; line-height: 1.5">Thirteen fields under one object. <span class="mono" style="font-size: 11px">day</span>, <span class="mono" style="font-size: 11px">month</span>, <span class="mono" style="font-size: 11px">year</span>, <span class="mono" style="font-size: 11px">lat</span> and <span class="mono" style="font-size: 11px">lon</span> are required by the API and <strong>cannot be marked required</strong> &mdash; Meta records that only for top-level fields, and the only top-level field here is <span class="mono" style="font-size: 11px">detail</span>. So the constraint lives in the description.</p>
            </div>
            <div style="flex-grow: 1; min-width: 0">
              <div class="lbl" style="display: block; margin-bottom: 8px">Fields</div>
              <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden">
                <table>
                  <thead><tr>${th('Field', 128)}${th('Type', 78)}${th('Source', 128)}${th('Description &mdash; the agent reads this')}${th('Req.', 58, 'center')}</tr></thead>
                  <tbody>
                    ${kf('detail', 'object', dash, 'The person&rsquo;s birth data', tick)}
                    ${kf('detail.name', 'string', 'Agent', 'Name they gave. &ldquo;Anonymous&rdquo; if none.', dash)}
                    ${kf('detail.gender', 'string', `<span style="color: ${T.teal}; font-weight: 500">One of</span>`, 'Exactly <span class="mono" style="font-size: 11.5px">Male</span> or <span class="mono" style="font-size: 11.5px">Female</span>.', dash)}
                    ${kf('detail.day', 'integer', 'Agent', 'Day of birth, 1&ndash;31. <strong>Required.</strong>', dash)}
                    ${kf('detail.month', 'integer', 'Agent', 'Month as a number, 1&ndash;12. <strong>Required.</strong>', dash)}
                    ${kf('detail.year', 'integer', 'Agent', 'Four-digit year. <strong>Required.</strong>', dash)}
                    ${kf('detail.hour', 'integer', 'Agent', '24-hour clock, 0&ndash;23. Midnight is 0, not 24.', dash)}
                    ${kf('detail.min', 'integer', 'Agent', 'Minute, 0&ndash;59.', dash)}
                    ${kf('detail.sec', 'integer', '<span class="sel">Fixed<span class="fix mono">0</span></span>', dash, dash)}
                    ${kf('detail.lat', 'number', 'Agent', 'Decimal degrees, e.g. 28.6139. Not a place name. <strong>Required.</strong>', dash)}
                    ${kf('detail.lon', 'number', 'Agent', 'Decimal degrees, e.g. 77.209. East positive. <strong>Required.</strong>', dash)}
                    ${kf('detail.place', 'string', 'Agent', 'Birth place as they said it.', dash)}
                    ${kf('detail.tzone', 'number', '<span class="sel">Fixed<span class="fix mono">5.5</span></span>', 'UTC offset in hours. 5.5 for India.', dash)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>`,
  resp: response({
    ok: false,
    status: '200 OK',
    ms: 268,
    size: '84 B',
    warn: 'the call failed &mdash; read status, not the code',
    body: `<div>{</div>
<div>&nbsp;&nbsp;<span class="k">"status"</span>: <span class="s">"failed"</span>,</div>
<div>&nbsp;&nbsp;<span class="k">"reason"</span>: <span class="s">"lat and lon are required"</span></div>
<div>}</div>`,
  }),
})

console.log('wrote Headers.dc.html ActionAuth.dc.html Docs.dc.html Body.dc.html Kundli.dc.html')
