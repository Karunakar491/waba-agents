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

/* ------------------------------------------------------------ Import cURL */
screen({
  file: 'ImportCurl.dc.html',
  tree: { open: 'kundli', sel: 'general_kundli' },
  crumbs: [{ text: 'Connectors' }, { text: 'AstroTalk Kundli' }, { text: 'Import', mono: false }],
  bar: requestBar({ method: 'POST', host: 'api.kundali.astrotalk.com', path: '/v1/combined/general' }),
  tabRow: tabs({ active: 'body', params: 0, headers: 0, body: 13 }),
  content: `
          <div style="display: flex; gap: 20px; height: 100%">
            <div style="width: 470px; flex-shrink: 0; display: flex; flex-direction: column">
              <div class="lbl" style="display: block; margin-bottom: 8px">Paste a cURL</div>
              <div class="mono" style="border: 1px solid ${T.teal}; border-radius: 10px; background: #FCFCFD; padding: 11px 13px; line-height: 1.6; font-size: 11px; flex-shrink: 0">
                <div><span class="s">curl</span> -X POST \\</div>
                <div>&nbsp;&nbsp;'https://api.kundali.astrotalk.com/v1/combined/general' \\</div>
                <div>&nbsp;&nbsp;-H 'Content-Type: application/json' \\</div>
                <div>&nbsp;&nbsp;-d '{</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"detail"</span>: {</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"name"</span>: <span class="s">"Test User"</span>,</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"day"</span>: <span class="n">1</span>, <span class="k">"month"</span>: <span class="n">1</span>, <span class="k">"year"</span>: <span class="n">1990</span>,</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">"lat"</span>: <span class="n">28.6139</span>, <span class="k">"lon"</span>: <span class="n">77.209</span></div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;}</div>
                <div>&nbsp;&nbsp;}'</div>
              </div>
              <p style="font-size: 11.5px; color: ${T.muted}; margin: 10px 2px 0; line-height: 1.5">Straight out of the API's own documentation. This is the fastest honest way to start &mdash; and the first moment we can tell you whether the API can be connected at all.</p>

              <div class="lbl" style="display: block; margin: 20px 0 8px">When it cannot be imported</div>
              <div style="border: 1px solid #F5D9A8; background: #FEF9F0; border-radius: 10px; padding: 11px 13px">
                <div class="mono" style="font-size: 10.5px; color: #7C4A11; line-height: 1.5">-H 'Content-Type: application/x-www-form-urlencoded'<br>-d 'merchant=KX01&amp;amount=4999'</div>
                <p style="font-size: 12px; color: #7C4A11; margin: 9px 0 0; line-height: 1.5"><strong>This API takes a form body. Meta only ever sends JSON</strong>, so it cannot be connected &mdash; not a setting we can change. Said here, on paste, rather than at publish.</p>
              </div>
            </div>

            <div style="flex-grow: 1; min-width: 0">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
                <span class="lbl">What it filled in</span>
                <span style="display: inline-flex; align-items: center; gap: 5px">
                  ${tick}<span style="font-size: 12px; color: #15803D">Valid JSON</span>
                </span>
                <span style="margin-left: auto; font-size: 12px; color: ${T.teal}; font-weight: 500">Beautify</span>
              </div>
              <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden">
                <table><tbody>
                  <tr>
                    <td style="width: 150px; font-size: 12.5px; color: ${T.muted}; padding: 0 16px; height: 40px; border-bottom: 1px solid ${T.rowline}">Method</td>
                    <td class="tdc"><span class="mono" style="font-weight: 700; color: ${T.amber}; font-size: 11px">POST</span></td>
                  </tr>
                  <tr>
                    <td style="width: 150px; font-size: 12.5px; color: ${T.muted}; padding: 0 16px; height: 40px; border-bottom: 1px solid ${T.rowline}">Base URL</td>
                    <td class="tdc mono">https://api.kundali.astrotalk.com</td>
                  </tr>
                  <tr>
                    <td style="width: 150px; font-size: 12.5px; color: ${T.muted}; padding: 0 16px; height: 40px; border-bottom: 1px solid ${T.rowline}">Path</td>
                    <td class="tdc mono">/v1/combined/general</td>
                  </tr>
                  <tr>
                    <td style="width: 150px; font-size: 12.5px; color: ${T.muted}; padding: 0 16px; height: 40px; border-bottom: 1px solid ${T.rowline}">Headers</td>
                    <td class="tdc ghost">none &mdash; <span class="mono" style="font-size: 11.5px">Content-Type</span> dropped, Meta sets it</td>
                  </tr>
                  <tr>
                    <td style="width: 150px; font-size: 12.5px; color: ${T.muted}; padding: 0 16px; height: 40px; border-bottom: none">Body fields</td>
                    <td class="tdc" style="border-bottom: none">13, from <span class="mono" style="font-size: 11.5px">detail</span> down</td>
                  </tr>
                </tbody></table>
              </div>

              <div class="lbl" style="display: block; margin: 20px 0 8px">Worth your attention</div>
              <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden">
                <table><tbody>
                  <tr>
                    <td class="tdc" style="width: 26px; padding-left: 14px; padding-right: 0">${tick}</td>
                    <td class="tdc sub">13 fields found. Descriptions are empty &mdash; five of these are required by the API and <strong>cannot be marked required</strong>, so the description is the only place to say so.</td>
                  </tr>
                  <tr>
                    <td class="tdc" style="width: 26px; padding-left: 14px; padding-right: 0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${T.amber}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg></td>
                    <td class="tdc sub"><span class="mono" style="font-size: 11.5px">lat</span> and <span class="mono" style="font-size: 11.5px">lon</span> are decimal degrees. The agent will be given a place name, so say so in their descriptions or the call will fail.</td>
                  </tr>
                  <tr>
                    <td class="tdc" style="width: 26px; padding-left: 14px; padding-right: 0; border-bottom: none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${T.amber}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg></td>
                    <td class="tdc sub" style="border-bottom: none">No auth in the cURL. If the live endpoint needs a key, add it on Auth &mdash; header, query or body.</td>
                  </tr>
                </tbody></table>
              </div>

              <div style="display: flex; gap: 10px; margin-top: 20px">
                <span style="display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 8px; background: ${T.teal}; color: #FFFFFF; font-size: 12.5px; font-weight: 600">Import</span>
                <span style="display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 8px; border: 1px solid ${T.line}; font-size: 12.5px; font-weight: 500">Cancel</span>
              </div>
            </div>
          </div>`,
  resp: response('idle'),
})

/* -------------------------------------------------------- Params, in bulk */
screen({
  file: 'BulkEdit.dc.html',
  tree: { open: 'supplier', sel: 'supplier_search' },
  crumbs: [...SUP, { text: 'supplier_search', mono: true }],
  bar: requestBar({ method: 'GET', host: 'script.google.com', path: '/exec' }),
  tabRow: tabs({ active: 'params', params: 9, headers: 1, body: 0, bodyOff: true }),
  content: `
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 9px">
            <span class="lbl">Query params</span>
            <span style="margin-left: auto; display: inline-flex; border: 1px solid ${T.line}; border-radius: 8px; overflow: hidden">
              <span style="font-size: 12px; padding: 6px 12px; color: ${T.muted}">Table</span>
              <span style="font-size: 12px; padding: 6px 12px; background: #F4F4F5; font-weight: 600; border-left: 1px solid ${T.line}">Bulk</span>
            </span>
          </div>

          <div class="mono" style="border: 1px solid ${T.line}; border-radius: 10px; background: #FCFCFD; padding: 12px 14px; line-height: 1.85; font-size: 12.5px">
            <div><span class="k">product</span>: agent  <span class="ghost">// what the buyer is looking for</span></div>
            <div><span class="k">city</span>: agent  <span class="ghost">// delivery city the buyer named</span></div>
            <div><span class="k">phone</span>: {{customer_phone}}</div>
            <div><span class="k">limit</span>: 10</div>
            <div><span class="k">sort</span>: agent  <span class="ghost">// price_asc, price_desc or rating</span></div>
            <div><span class="k">min_rating</span>: 3</div>
            <div><span class="k">verified_only</span>: true</div>
            <div><span class="k">page</span>: agent</div>
            <div><span class="k">locale</span>: en-IN<span style="display: inline-block; width: 1.5px; height: 15px; background: ${T.teal}; vertical-align: -3px; margin-left: 2px"></span></div>
          </div>
          <p style="font-size: 12px; color: ${T.muted}; margin: 10px 0 0; max-width: 900px">One line per parameter: <span class="mono" style="font-size: 11.5px">key: source</span>, and anything after <span class="mono" style="font-size: 11.5px">//</span> is the description. Nine parameters is nine lines to type here and nine rows to tab through in the table &mdash; this is the same data, faster. Switching back to Table loses nothing.</p>

          <div style="display: flex; gap: 22px; margin-top: 22px">
            <div style="flex: 1">
              <div class="lbl" style="display: block; margin-bottom: 7px">Also, in the table</div>
              <div style="border: 1px solid ${T.line}; border-radius: 10px; padding: 12px 14px">
                <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 7px">
                  <span class="mono" style="font-size: 11px; background: #F4F4F5; border: 1px solid ${T.line}; border-radius: 5px; padding: 2px 7px">Tab</span>
                  <span style="font-size: 12.5px">at the end of the last row makes the next one</span>
                </div>
                <div style="display: flex; align-items: baseline; gap: 10px">
                  <span class="mono" style="font-size: 11px; background: #F4F4F5; border: 1px solid ${T.line}; border-radius: 5px; padding: 2px 7px">Paste</span>
                  <span style="font-size: 12.5px">a query string or <span class="mono" style="font-size: 11.5px">key: value</span> lines fills rows in one go</span>
                </div>
              </div>
            </div>
            <div style="flex: 1">
              <div class="lbl" style="display: block; margin-bottom: 7px">Still no Add button</div>
              <div style="border: 1px solid ${T.line}; border-radius: 10px; padding: 12px 14px">
                <p style="font-size: 12.5px; margin: 0; line-height: 1.55; color: #52525B">A button would be a second way to do what the trailing row already does, placed away from the row it creates. Nine parameters is nine rows of typing either way &mdash; a button just adds nine clicks.</p>
              </div>
            </div>
          </div>`,
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
            <span style="display: inline-flex; align-items: center; gap: 5px">${tick}<span style="font-size: 12px; color: #15803D">Valid</span></span>
            <span style="margin-left: auto; display: inline-flex; gap: 14px; align-items: center">
              <span style="font-size: 12px; color: ${T.teal}; font-weight: 500">Beautify</span>
              <span style="font-size: 12px; color: ${T.teal}; font-weight: 500">Import cURL</span>
              <span style="font-size: 12px; color: ${T.muted}">JSON only</span>
            </span>
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
    body: `<div><span class="ghost">&lt;?xml version="1.0"?&gt;</span></div>
<div><span class="k">&lt;enquiry&gt;</span></div>
<div>&nbsp;&nbsp;<span class="k">&lt;id&gt;</span>ENQ-90412<span class="k">&lt;/id&gt;</span></div>
<div>&nbsp;&nbsp;<span class="k">&lt;status&gt;</span>sent_to_suppliers<span class="k">&lt;/status&gt;</span></div>
<div>&nbsp;&nbsp;<span class="k">&lt;notified&gt;</span>6<span class="k">&lt;/notified&gt;</span></div>
<div><span class="k">&lt;/enquiry&gt;</span></div>
<div style="margin-top: 7px; color: ${T.muted}; font-family: Inter, sans-serif; font-size: 11.5px">An XML response is fine &mdash; verified against the live API. Only the <em>request</em> body must be JSON.</div>`,
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

console.log('wrote Headers ActionAuth BulkEdit Docs Body Kundli')
