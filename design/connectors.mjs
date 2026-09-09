/**
 * The connector screens — same chrome as the action screens, no tab row.
 * Run: node connectors.mjs
 */
import { writeFileSync } from 'node:fs'
import { T, CSS, caret, tick, box, dash, sidebar, breadcrumb } from './build.mjs'

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

function connectorScreen({ file, crumbs, tree, content }) {
  writeFileSync(
    file,
    `<!doctype html>
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
      <div style="padding: 22px 24px; flex-grow: 1; min-height: 0; overflow: hidden">
${content}
      </div>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`,
  )
}

const prop = (label, value, last) => `
              <tr>
                <td style="width: 172px; font-size: 12.5px; color: ${T.muted}; padding: 0 16px; height: 44px;${last ? '' : ` border-bottom: 1px solid ${T.rowline}`}">${label}</td>
                <td class="td"${last ? ' style="border-bottom: none"' : ''}>${value}</td>
              </tr>`

const propTable = (rows, max = '980px') => `
        <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden; max-width: ${max}">
          <table><tbody>${rows}</tbody></table>
        </div>`

const actionsHead = `
              <thead><tr>
                <th class="th" style="width: 78px">Method</th>
                <th class="th" style="width: 176px">Name</th>
                <th class="th" style="width: 196px">Path</th>
                <th class="th">Description</th>
                <th class="th" style="width: 78px; text-align: right">Params</th>
                <th class="th" style="width: 66px; text-align: right">Body</th>
              </tr></thead>`

const aRow = (m, name, path, desc, params, body) => {
  const c = m === 'GET' ? T.teal : T.amber
  return `
              <tr>
                <td class="td"><span class="mono" style="font-weight: 700; color: ${c}; font-size: 11px">${m}</span></td>
                <td class="td mono">${name}</td>
                <td class="td mono sub">${path}</td>
                <td class="td sub">${desc}</td>
                <td class="td" style="text-align: right; font-variant-numeric: tabular-nums">${params}</td>
                <td class="td" style="text-align: right; font-variant-numeric: tabular-nums">${body}</td>
              </tr>`
}

const aTrailing = `
              <tr style="background: #FCFCFD">
                <td class="td" style="border-bottom: none"><span class="mono ghost" style="font-weight: 700; font-size: 11px">GET</span> ${caret()}</td>
                <td class="td mono ghost" style="border-bottom: none">name</td>
                <td class="td mono ghost" style="border-bottom: none">/path</td>
                <td class="td ghost" style="border-bottom: none">what it does</td>
                <td class="td ghost" style="border-bottom: none; text-align: right">&mdash;</td>
                <td class="td ghost" style="border-bottom: none; text-align: right">&mdash;</td>
              </tr>`

const agents = (rows) => `
        <div style="display: flex; align-items: center; gap: 12px; margin-top: 24px; max-width: 980px">
          <span class="lbl">Agents</span>
          ${rows}
          <span style="margin-left: auto; display: inline-flex; align-items: center; height: 32px; padding: 0 14px; border-radius: 8px; background: ${T.teal}; color: #FFFFFF; font-size: 12.5px; font-weight: 600">Publish</span>
        </div>`

const liveAgent = `
          <span style="font-size: 13px">Karix Demo</span>
          <span class="mono" style="font-size: 12px; color: ${T.muted}">+91 90000 00000</span>
          <span style="display: inline-flex; align-items: center; gap: 6px">
            <span style="width: 6px; height: 6px; border-radius: 999px; background: ${T.teal}"></span>
            <span style="font-size: 12px; color: ${T.muted}">Up to date</span>
          </span>`

/* -------------------------------------------------- the connector, filled */
connectorScreen({
  file: 'Main.dc.html',
  tree: { open: 'supplier', sel: null },
  crumbs: [{ text: 'Connectors' }, { text: 'IndiaMART Supplier Search API' }],
  content: `
        ${propTable(
          prop('Name', 'IndiaMART Supplier Search API') +
            prop('Description', 'Finds suppliers matching a buyer&rsquo;s requirement') +
            prop(
              'Tags',
              `<span style="display: inline-flex; gap: 6px"><span style="font-size: 11.5px; background: #F4F4F5; border-radius: 6px; padding: 3px 8px; color: #52525B">e-commerce</span><span style="font-size: 11.5px; background: #F4F4F5; border-radius: 6px; padding: 3px 8px; color: #52525B">suppliers</span></span>`,
              true,
            ),
        )}

        <div style="display: flex; align-items: baseline; gap: 10px; margin: 26px 0 9px">
          <span class="lbl">Actions</span>
          <span style="font-size: 11px; color: ${T.ghost}; font-variant-numeric: tabular-nums">3</span>
        </div>
        <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden">
          <table>${actionsHead}<tbody>
            ${aRow('GET', 'supplier_search', '/exec', 'Suppliers for a product and city', 4, '&mdash;')}
            ${aRow('POST', 'create_enquiry', '/exec', 'Raises an enquiry with a supplier', 1, 7)}
            ${aRow('GET', 'enquiry_status', '/exec/{enquiry_id}', 'Delivery status of one enquiry', 2, '&mdash;')}
            ${aTrailing}
          </tbody></table>
        </div>
        ${agents(liveAgent)}`,
})

/* ----------------------------------------------- a connector with nothing */
connectorScreen({
  file: 'NewConnector.dc.html',
  tree: { open: 'sheets', sel: null },
  crumbs: [{ text: 'Connectors' }, { text: 'Google Sheets Export' }],
  content: `
        ${propTable(
          prop('Name', 'Google Sheets Export') +
            prop('Description', `<span class="ghost">what this API is for</span>`) +
            prop('Tags', `<span class="ghost">none yet</span>`, true),
        )}

        <div style="display: flex; align-items: baseline; gap: 10px; margin: 26px 0 9px">
          <span class="lbl">Actions</span>
          <span style="font-size: 11px; color: ${T.ghost}; font-variant-numeric: tabular-nums">0</span>
        </div>
        <div style="border: 1px solid ${T.line}; border-radius: 12px; overflow: hidden">
          <table>${actionsHead}<tbody>${aTrailing}</tbody></table>
        </div>
        <p style="font-size: 12px; color: ${T.muted}; margin: 10px 0 0">Type in the last row to add one. Method, name, path and description are all Meta needs; parameters and body are added by opening it.</p>

        <div style="display: flex; align-items: center; gap: 12px; margin-top: 24px; max-width: 980px">
          <span class="lbl">Agents</span>
          <span style="font-size: 13px; color: ${T.muted}">Not on any agent</span>
          <span style="margin-left: auto; display: inline-flex; align-items: center; height: 32px; padding: 0 14px; border-radius: 8px; border: 1px solid ${T.line}; color: #C4C4C8; font-size: 12.5px; font-weight: 600" title="Add an action first">Publish</span>
        </div>`,
})

console.log('wrote Main.dc.html NewConnector.dc.html')
