# Limited-time offer templates



This document describes limited-time offer templates and how to use them.

Limited-time offer templates allow you to display expiration dates and running countdown timers for offer codes in template messages.

## Limitations

* Only templates categorized as `MARKETING` are supported.
* Footer components are not supported.
* Users who view a limited-time offer template message using the WhatsApp web app or desktop app will not see the offer. Instead, they see a message indicating that they have received a message but that the limited-time offer is not supported.

## Creating limited-time offer templates

Use the [Message Templates API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api#post-version-waba-id-message-templates) to create a limited-time offer template.

### Request syntax

```json
curl -X POST "https://graph.facebook.com/v23.0/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '
{
    "name": "<TEMPLATE_NAME>",
    "language": "<TEMPLATE_LANGUAGE>",
    "category": "marketing",
    "components": [
      {
        "type": "header",
        "format": "<HEADER_FORMAT>",
        "example": {
          "header_handle": [
            "<HEADER_ASSET_HANDLE>"
          ]
        }
      },
      {
        "type": "limited_time_offer",
        "limited_time_offer": {
          "text": "<LIMITED_TIME_OFFER_TEXT>",
          "has_expiration": <HAS_EXPIRATION>
        }
      },
      {
        "type": "body",
        "text": "<BODY_TEXT>",
        "example": {
          "body_text": [<BODY_TEXT_VARIABLE_EXAMPLES>]
        }
      },
      {
        "type": "buttons",
        "buttons": [
          {
            "type": "copy_code",
            "example": "<OFFER_CODE_EXAMPLE>"
          },
          {
            "type": "url",
            "text": "<URL_BUTTON_TEXT>",
            "url": "<URL_BUTTON_URL>",
            "example": [
              "<URL_EXAMPLE_WITH_VARIABLE_EXAMPLE>"
            ]
          }
        ]
      }
    ]
  }'
```

### Request parameters

| Placeholder | Description | Example Value |
| --- | --- | --- |
| `<BODY_TEXT>`<br><br>_String_ | **Required.**<br><br>Body component text. Supports variables.<br><br>Maximum 600 characters. | `Good news, {{1}}! Use code {{2}} to get 25% off all Caribbean Destination packages!` |
| `<BODY_TEXT_VARIABLE_EXAMPLES>`<br><br>_Array of strings_ | **Required if body component text uses variables.**<br><br>Array of example variable strings.<br><br>Must supply examples for all placeholders in `<BODY_TEXT>` string.<br><br>No maximum, but counts against `<BODY_TEXT>` maximum. | `["Pablo","CARIBE25"]` |
| `<HAS_EXPIRATION>`<br><br>_Boolean_ | **Optional.**<br><br>Set to `true` to have the [offer expiration details](#offer-expiration-details) appear in the delivered message. | `true` |
| `<HEADER_ASSET_HANDLE>`<br><br>_Media asset handle_ | **Required if using an image or video header.**<br><br>Uploaded media asset handle. Use the [Resumable Upload API](https://developers.facebook.com/docs/graph-api/guides/upload) to generate an asset handle. | `4::aW...` |
| `<HEADER_FORMAT>`<br><br>_Enum_ | **Required if using a header.**<br><br>Can be `IMAGE`, or `VIDEO`. | `IMAGE` |
| `<LIMITED_TIME_OFFER_TEXT>`<br><br>_String_ | **Required.**<br><br>Offer details text.<br><br>Maximum 16 characters. | `Expiring offer!` |
| `<OFFER_CODE_EXAMPLE>`<br><br>_String_ | **Required.**<br><br>Example offer code.<br><br>Maximum 15 characters. | `CARIBE25` |
| `<TEMPLATE_LANGUAGE>`<br><br>_Enum_ | **Required.**<br><br>Template [language and locale code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Template name.<br><br>Maximum 512 characters. | `limited_time_offer_caribbean_pkg_2023` |
| `<URL_BUTTON_TEXT>`<br><br>_String_ | **Required.**<br><br>[URL button](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components#url-buttons) label text. Supports 1 variable.<br><br>25 characters maximum. | `Book now!` |
| `<URL_BUTTON_URL>`<br><br>_String_ | **Required.**<br><br>URL of website that loads in the device's default mobile web browser when the [URL button](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components#url-buttons) is tapped by the WhatsApp user.<br><br>Supports 1 variable appended to the end of the URL string.<br><br>Maximum 2000 characters. | `https://awesomedestinations.com/offers?code={{1}}` |
| `<URL_EXAMPLE_WITH_VARIABLE_EXAMPLE>`<br><br>_String_ | **Required if URL uses a variable.**<br><br>Example URL with example variable appended to the end.<br><br>No maximum, but value counts against `<URL_BUTTON_URL>` maximum. | `https://awesomedestinations.com/offers?ref=n3mtql` |

### Offer expiration details

The delivered message can display an offer expiration details section with a heading, an optional expiration timer, and the offer code itself.

The expiration timer is a text string that is not customizable, but the expiration timer will change to red text if the message is viewed and the offer code is expiring within the next hour. (You include the actual offer code and its expiration timestamp when you send the template in a template message.)

### Example request

This is an example request to create a limited-time offer template that uses:

* an image header component
* body text component with variables
* the limited-time offer component
* a copy code button
* a button URL with a variable

```curl
curl 'https://graph.facebook.com/v17.0/102290129340398/message_templates' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer EAAJB...' \
-d '
{
  "name": "limited_time_offer_caribbean_pkg_2023",
  "language": "en_US",
  "category": "marketing",
  "components": [
    {
      "type": "header",
      "format": "image",
      "example": {
        "header_handle": [
          "4::aW..."
        ]
      }
    },
    {
      "type": "limited_time_offer",
      "limited_time_offer": {
        "text": "Expiring offer!",
        "has_expiration": true
      }
    },
    {
      "type": "body",
      "text": "Good news, {{1}}! Use code {{2}} to get 25% off all Caribbean Destination packages!",
      "example": {
        "body_text": [
          [
            "Pablo",
            "CARIBE25"
          ]
        ]
      }
    },
    {
      "type": "buttons",
      "buttons": [
        {
          "type": "copy_code",
          "example": "CARIBE25"
        },
        {
          "type": "url",
          "text": "Book now!",
          "url": "https://awesomedestinations.com/offers?code={{1}}",
          "example": [
            "https://awesomedestinations.com/offers?ref=n3mtql"
          ]
        }
      ]
    }
  ]
}'
```

### Example response

```json
{
  "id": "546151681022936",
  "status": "PENDING",
  "category": "MARKETING"
}
```

## Sending limited-time offer templates

Use the [Messages API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api#post-version-phone-number-id-messages) to send an approved limited-time offer template in a template message.

### Request syntax

### Request parameters

| Placeholder | Description | Example Value |
| --- | --- | --- |
| `<BODY_VARIABLES>`<br><br>_Array of objects_ | **Required if template body text uses variables.**<br><br>Body text variable values. Define each variable as an individual object. | `{"type":"text","text":"Pablo"},{"type":"text","text":"CARIBE25"}` |
| `<CUSTOMER_PHONE_NUMBER>`<br><br>_String_ | **Required.**<br><br>Phone number of the WhatsApp user who the template message should be sent to. | `+16505555555` |
| `<EXPIRATION_TIME>`<br><br>_Unix timestamp_ | **Required.**<br><br>Offer code expiration time as a UNIX timestamp in milliseconds. | `1698562800000` |
| `<HEADER_ASSET_ID>`<br><br>_Media asset ID_ | **Required.**<br><br>Uploaded media asset ID. Use the [/PHONE_NUMBER_ID/media](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api) endpoint to generate an ID. | `1602186516975000` |
| `<HEADER_TYPE>`<br><br>_String_ | **Required.**<br><br>Header type used by the template. Values can be `image` or `video`. | `image` |
| `<OFFER_CODE>`<br><br>_String_ | Offer code.<br><br>Maximum 15 characters. | `CARIBE25` |
| `<TEMPLATE_LANGUAGE_CODE>`<br><br>_Enum_ | **Required.**<br><br>The template's [language and locale code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>The template's name. | `limited_time_offer_caribbean_pkg_2023` |
| `<URL_BUTTON_INDEX>`<br><br>_Integer_ | **Required.**<br><br>URL button index. If the template uses a copy code button, value must be `1`.<br><br>If the template does not use a copy code button, the value must be `0`. | `1` |
| `<URL_VARIABLE>`<br><br>_String_ | **Required if URL uses a variable.**<br><br>URL variable value.<br><br>No maximum, but value counts against URL string maximum of 2000 characters. | `n3mtql` |

### Example request

Example request to send a limited-time offer template that uses:

* an image header
* body text variables
* the offer expiration details
* a copy code button
* a URL button with a variable

```curl
curl 'https://graph.facebook.com/v17.0/106540352242922/messages' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer EAAJB...' \
-d '
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "16505555555",
  "type": "template",
  "template": {
    "name": "limited_time_offer_caribbean_pkg_2023",
    "language": {
      "code": "en_US"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": {
              "id": "1602186516975000"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "Pablo"
          },
          {
            "type": "text",
            "text": "CARIBE25"
          }
        ]
      },
      {
        "type": "limited_time_offer",
        "parameters": [
          {
            "type": "limited_time_offer",
            "limited_time_offer": {
              "expiration_time_ms": 1209600000
            }
          }
        ]
      },
      {
        "type": "button",
        "sub_type": "copy_code",
        "index": 0,
        "parameters": [
          {
            "type": "coupon_code",
            "coupon_code": "CARIBE25"
          }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": 1,
        "parameters": [
          {
            "type": "text",
            "text": "n3mtql"
          }
        ]
      }
    ]
  }
}'
```

### Example response

```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "16505555555",
      "wa_id": "16505555555"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLMTY1MDUwNzY1MjAVAgARGBI5QTNDQTVCM0Q0Q0Q2RTY3RTcA"
    }
  ]
}
```

## Combining with payment request buttons

**Warning:** This feature is only available for businesses based in Brazil using payment request CTA buttons with Pix, Boleto, or Payment Link.

You can combine limited-time offer templates with payment request CTA buttons to send time-sensitive payment requests that display a countdown timer alongside payment options. This is useful for scenarios such as flash sales or promotional discounts with a deadline where the payment method should be readily accessible within the message.

For template creation payloads, supported payment methods, button configuration, and expiration management details, see [Payment Request CTA Templates (Brazil)](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/payment-request-cta).
