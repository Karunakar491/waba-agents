/**
 * Meta's substitution macros, and the whole set — it is closed, so there is no
 * "add a variable" anywhere in the product.
 *
 * Its own module because both the connector's Variables section and the header
 * nav's count need it, and a `.tsx` exporting a constant beside a component
 * trips the fast-refresh lint rule.
 */
export const META_MACROS: [string, string][] = [
  ['WHATSAPP_PHONE_NUMBER', "The customer's WhatsApp number"],
  ['WHATSAPP_IDENTITY_HASH', 'Identity hash for the customer'],
  ['WHATSAPP_CURRENT_STATUS_ID', 'Id of the conversation status in play'],
]
