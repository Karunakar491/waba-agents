# IndiaMART product-search — real contract, verified 2026-09-04

Every line below was verified against the live endpoint and against the live tool
through Meta's own runtime. Nothing here is inferred from the design docs.

Agent `875651765431701504` (IndiaMART Buyer Discovery), connector
`indiamart_product_search_api`, tool `product_search`.

## What the tool sends today

```json
{
  "method": "POST",
  "path": "/",
  "query_parameters": {
    "action": { "type": "string", "binding": { "kind": "default", "value": "product-search" } },
    "query":  { "type": "string", "required": true }
  }
}
```

No `body`. No `city`. That second omission is the defect.

## The contract, as proven

| Test | Request | Result |
|---|---|---|
| A | `?action=product-search` + body `{action,query,city}` (the given curl) | 200, 2 results |
| B | query string only, **no** `Content-Length` | **411 Length Required** |
| B2 | query string only, `Content-Length: 0` | 200 |
| C | body only, no query string | 200 |
| D | `city` via **query string** | 200, filters correctly |
| E | query string `query=biryani` + body `query=cement` | returns **cement** |
| F | `action` absent from both | **404 `{"success":false,"message":"Missing action parameter"}`** |

1. `action` is mandatory, satisfied from **either** query string or body (F).
2. `query` and `city` work from **either** location (A, C, D).
3. **Body wins over query string** (E).
4. A bodyless POST needs a `Content-Length` header or the edge returns 411 (B vs B2).

## `city` is silently dropped today — the actual bug

Same query, city varied, straight against the API:

| `city` | Result cities |
|---|---|
| `Delhi` | New Delhi, New Delhi |
| `Mumbai` | Mumbai, Vasai Virar |
| *(empty)* | Hyderabad, Greater Noida |

So `city` filters **server-side**. Then through Meta's runtime, against the live tool:

```
input {"query":"biryani"}                 -> Hyderabad, Greater Noida
input {"query":"biryani","city":"Delhi"}  -> Hyderabad, Greater Noida   (identical)
```

`city` is **undeclared on the tool, so Meta drops it with no error**. The agent
cannot filter by location at all, and nothing ever surfaced a failure.

This also retires a live instruction. `supplier-search-invocation-new` currently says:

> "If a location was given, prefer results matching it but do not filter the tool
> call itself by location - filter the returned list yourself."

That was written believing the API had no location parameter. It does. The
instruction now makes the agent discard a working server-side filter and
post-filter a 2-row page instead — which is why a city-specific search returns
nothing useful.

## Full response structure — 20 + 5 + 3 fields, nothing omitted

Sampled 8 results across 4 queries (`biryani`/Delhi, `TMT Bars`/Mumbai,
`aata chakki machine`/none, `industrial valves`/Pune).

Top level: `success` (boolean), `message` (string), `data` (array).

`data[]` — 20 fields:

| Field | Type | Verified behaviour |
|---|---|---|
| `companyName` | string | supplier name |
| `product_name` | string | |
| `city` | string | |
| `state` | string | |
| `product_url` | string | `m.indiamart.com/proddetail/...` — the order link |
| `catalog_url` | string | supplier's own site, or an `indiamart.com/<slug>/` fallback. Always present in the sample |
| `mobile` | string | **always an IndiaMART routed landline** (`0794…`, `0804…`), never the supplier's own mobile |
| `price` | string | **`"N/A"` occurs.** Units wildly inconsistent: `₹ 3,200/Piece`, `₹ 46,500/Tonne`, `₹ 2,000/Piece(s)`, bare `₹ 40,000` |
| `gstVerifiedFlag` | string | `"1"` in every sample — a string, not a boolean. No `"0"` ever observed, so we do **not** know what unverified looks like |
| `trustseal` | string | a slug (`angelgiftsevents`), **or the literal `"N/A"`** — not a boolean badge |
| `supplier_rating` | number | `4.4`, and also bare `4` |
| `rating_count` | number | 5 – 764 |
| `memberSinceDisplay` | string | `"6 yrs"` |
| `pns_success_ratio` | number | 50 – 88 |
| `image` | string | 125×125 thumbnail |
| `photo` | array | **always length 4**, and contains a **trailing empty string** whenever `photo_1000` is empty |
| `photo_1000` | string | `""` when unavailable — correlates exactly with the blank `photo` slot |
| `iildisplayflag` | boolean | `true` throughout |
| `seller_id` | string | internal — never show a buyer |
| `more_results` | array | 0 – 4 entries |

`more_results[]` — 5 fields: `product_name`, `product_url`, `price`,
`display_id`, `image`.

## Blocking risk: images are not fetchable

Every image URL is served over **`http://`** from `N.imimg.com`. From our network:

- Fresh URLs: **403** on all of `1..5.imimg.com`, unchanged by browser
  `User-Agent`, `Referer: https://www.indiamart.com/`, `Accept: image/*`, or https.
- Older sampled URLs, including `photo_1000`: **404**.

I could not fetch a single one of 24 probed URLs. This is **not** proof that
Meta's media fetcher fails — Meta egresses from different IPs and may be
allow-listed where we are not — but the `carousel_url` and `image` UI Skills both
depend on WhatsApp fetching these URLs, so **this must be proven on the real
handset before any journey step depends on product imagery.** A plain-`http`
media URL is independently a common WhatsApp rejection cause.

## The one thing the UI cannot express

To send the given curl's body verbatim, the body needs `action` as a **fixed**
value. `BizAIOmniChannelConnectorToolBodyNode` supports `binding` — but
`ToolBodyEditor.tsx` collects only key/type/description/required, with no
fill/fixed-value control. So today the UI can express `query` and `city` in the
body, but not a fixed `action`.

Two ways forward:

- **(a) No code change.** Keep `action` as the existing fixed *query* parameter
  and put `query` + `city` in the body. Functionally identical — D and A both
  prove `action` from the query string is accepted — but the body then omits
  `action`, so it is not the curl byte-for-byte.
- **(b) Add the fill control to `ToolBodyEditor`** (mirroring the one
  `ToolParamsEditor` already has) and set the body to exactly
  `{action, query, city}`. Matches the curl with nothing omitted, and closes the
  same "the UI cannot express the real contract" gap this editor was built for.

## Untouched

The agent was not modified. This document is read-only findings plus one live
`/run` test per shape, which is a non-mutating search.
