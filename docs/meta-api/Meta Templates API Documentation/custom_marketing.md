# Custom marketing templates



Learn how to create and send a custom marketing template.

## Supported components

Custom marketing templates support the following components:

- 1 header (optional; all types supported)
- 1 body (required)
- 1 footer (optional)
- Up to 10 buttons (optional; all types supported)

## Step 1: Create a custom marketing template

Use the [Message Templates API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api#post-version-waba-id-message-templates) to create a custom marketing template.

### Request syntax

This example syntax creates a template with an image header, body text with 3 named parameters, a footer, and 3 buttons (url, phone number, and quick-reply).

```html
curl 'https://graph.facebook.com/<API_VERSION>/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer <ACCESS_TOKEN>' \
-d '
{
  "name": "<TEMPLATE_NAME>",
  "language": "<TEMPLATE_LANGUAGE>",
  "category": "marketing",
  "parameter_format": "<PARAMETER_FORMAT>",
  "components": [
    {
      "type": "header",
      "format": "image",
      "example": {
        "header_handle": [
          "<HEADER_ASSET_HANDLE>"
        ]
      }
    },
    {
      "type": "body",
      "text": "<BODY_TEXT>",
      "example": {
        "body_text_named_params": [
          {
            "param_name": "<BODY_PARAMETER_NAME>",
            "example": "<BODY_PARAMETER_EXAMPLE_VALUE>"
          },
          <!-- additional parameters and example values go here -->
        ]
      }
    },
    {
      "type": "footer",
      "text": "<FOOTER_TEXT>"
    },
    {
      "type": "buttons",
      "buttons": [
        {
          "type": "url",
          "text": "<URL_BUTTON_LABEL_TEXT>",
          "url": "<URL_BUTTON_URL>"
        },
        {
          "type": "phone_number",
          "text": "<PHONE_NUMBER_BUTTON_LABEL_TEXT>",
          "phone_number": "<PHONE_NUMBER_BUTTON_PHONE_NUMBER>"
        },
        {
          "type": "quick_reply",
          "text": "<QUICK_REPLY_BUTTON_LABEL_TEXT>"
        }
      ]
    }
  ]
}'
```

### Request parameters

| Placeholder | Description | Sample Value |
| --- | --- | --- |
| `<ACCESS_TOKEN>`<br><br>_String_ | **Required.**<br><br>Access token. | `EAAAN6tcBzAUBOZC82CW7iR2LiaZBwUHS4Y7FDtQxRUPy1PHZClDGZBZCgWdrTisgMjpFKiZAi1FBBQNO2IqZBAzdZAA16lmUs0XgRcCf6z1LLxQCgLXDEpg80d41UZBt1FKJZCqJFcTYXJvSMeHLvOdZwFyZBrV9ZPHZASSqxDZBUZASyFdzjiy2A1sippEsF4DVV5W2IlkOSr2LrMLuYoNMYBy8xQczzOKDOMccqHEZD` |
| `<API_VERSION>`<br><br>_String_ | **Optional.**<br><br>API version. If omitted, defaults to the newest API version available to your app. | `v23.0` |
| `<BODY_PARAMETER_EXAMPLE_VALUE>`<br><br>_String_ | **Required if using a body component string that includes one or more parameters.**<br><br>Example parameter value. You must supply an example for each parameter defined in your body component string. | `WELCOME20` |
| `<BODY_PARAMETER_NAME>`<br><br>_String_ | **Required if using named parameters.**<br><br>Parameter name. You must supply a name for each parameter defined in your body component string. Must be a unique string, composed of lowercase characters and underscores, wrapped in double curly brackets. | `{{discount_code}}` |
| `<BODY_TEXT>`<br><br>_String_ | **Required.**<br><br>Template body text. Variables are supported.<br><br>Maximum 1024 characters. | `Welcome to Lucky Shrub, {{first_name}}!\\n\\nUse code *{{discount_code}}* to get {{discount_amount}} off of your first purchase!` |
| `<FOOTER_TEXT>`<br><br>_String_ | **Optional.**<br><br>Footer text.<br><br>Maximum 60 characters. | `Lucky Shrub: Your gateway to succulents!` |
| `<PARAMETER_FORMAT>`<br><br>_String_ | **Optional.**<br><br>[Parameter format](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#parameter-formats). Value can be:<br><br>- `named`<br>- `positional`<br><br>If the `parameter_format` property is omitted, the template will use positional formatting. | `Lucky Shrub: Your gateway to succulents!` |
| `<HEADER_ASSET_HANDLE>`<br><br>_String_ | **Required if using a header with a media asset.**<br><br>Header [media asset handle](https://developers.facebook.com/docs/graph-api/guides/upload). | `4::aW1hZ2UvcG5n:ARYpf5zqqUjggwGfsZOJ2_o26Zs8ntcO2mss2vKpFb8P_IvskL043YXKpehYTD7IxqEB4t-uZcIzOTxOFRavEcN_tZLhk1WXFb3IOr4S8UKJcQ:e:1759093121:634974688087057:100089620928913:ARYyOAh63uQLhDpqOdk` |
| `<PHONE_NUMBER_BUTTON_LABEL_TEXT>`<br><br>_String_ | **Required if using a phone number button.**<br><br>Button label text. Maximum 25 characters. Alphanumeric characters only. | `Call us` |
| `<PHONE_NUMBER_BUTTON_PHONE_NUMBER>`<br><br>_String_ | **Required if using a phone number button component.**<br><br>Business phone number to be called in the WhatsApp user's default phone app when tapped by the user. Note that some countries have special phone numbers that have leading zeros after the country calling code (for example, +55-0-955-585-95436). If you assign one of these numbers to the button, the leading zero will be stripped from the number. If your number will not work without the leading zero, assign an alternate number to the button, or add the number as message body text.<br><br>Maximum 20 characters. Alphanumeric characters only. | `15550051310` |
| `<QUICK_REPLY_BUTTON_LABEL_TEXT>` | **Required if using a quick-reply button.**<br><br>Button label text. Maximum 25 characters. Alphanumeric characters only. | `Unsubscribe` |
| `<TEMPLATE_LANGUAGE>`<br><br>_String_ | **Required.**<br><br>Template [language code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Template name. Must be unique, unless existing templates with the same name have a different template language.<br><br>Maximum 512 characters. Lowercase, alphanumeric characters and underscores only. | `reservation_confirmation` |
| `<URL_BUTTON_URL>`<br><br>_String_ | **Required if including a URL button.**<br><br>URL to be loaded in WhatsApp user's default web browser when tapped. | `https://www.luckyshrubeater.com/reservations` |
| `<URL_BUTTON_LABEL_TEXT>`<br><br>_String_ | **Required if using a URL button.**<br><br>Button label text.<br><br>Maximum 25 characters. Alphanumeric characters only. | `View deals` |
| `<WHATSAPP_BUSINESS_ACCOUNT_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp Business account ID. | `546151681022936` |

### Response syntax

Upon success:

```html
{
  "id": "<TEMPLATE_ID>",
  "status": "<TEMPLATE_STATUS>",
  "category": "<TEMPLATE_CATEGORY>"
}
```

### Response parameters

| Placeholder | Description | Example value |
| --- | --- | --- |
| `<TEMPLATE_CATEGORY>` | [Template category](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization). | `MARKETING` |
| `<TEMPLATE_ID>` | Template ID. | `1627019861106475` |
| `<TEMPLATE_STATUS>` | [Template status](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#template-status). | `PENDING` |

### Example request

```curl
curl 'https://graph.facebook.com/v23.0/102290129340398/message_templates' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer EAAJB...' \
-d '
{
  "name": "welcome_discount_template",
  "language": "en_US",
  "category": "marketing",
  "parameter_format": "named",
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
      "type": "body",
      "text": "Welcome to Lucky Shrub, {{first_name}}!\n\nUse code *{{discount_code}}* to get {{discount_amount}} off of your first purchase!",
      "example": {
        "body_text_named_params": [
          {
            "param_name": "first_name",
            "example": "Pablo"
          },
          {
            "param_name": "discount_code",
            "example": "WELCOME20"
          },
          {
            "param_name": "discount_amount",
            "example": "20%"
          }
        ]
      }
    },
    {
      "type": "footer",
      "text": "Lucky Shrub: Your gateway to succulents!"
    },
    {
      "type": "buttons",
      "buttons": [
        {
          "type": "url",
          "text": "View deals",
          "url": "https://www.luckyshrub.com/deals"
        },
        {
          "type": "phone_number",
          "text": "Call us",
          "phone_number": "+15550051310"
        },
        {
          "type": "quick_reply",
          "text": "Unsubscribe"
        }
      ]
    }
  ]
}'
```

### Example response

```json
{
  "id": "1627019861106475",
  "status": "PENDING",
  "category": "MARKETING"
}
```

## Step 2: Send a custom marketing template

Use the [Messages API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api#post-version-phone-number-id-messages) to send an approved marketing template.

### Request syntax

This example syntax is for sending the template described in the [create syntax](#request-syntax) above, which expects a header image asset, and 3 body text parameter values which will replace their parameter placeholders in the body text string.

```html
curl 'https://graph.facebook.com/<API_VERSION>/<BUSINESS_PHONE_NUMBER_ID>/messages' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer <ACCESS_TOKEN>' \
-d '
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<WHATSAPP_USER_PHONE_NUMBER>",
  "type": "template",
  "template": {
    "name": "<TEMPLATE_NAME>",
    "language": {
      "code": "<TEMPLATE_LANGUAGE>"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": {
              "id": "<HEADER_ASSET_ID>"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "parameter_name": "<PARAMETER_NAME>",
            "text": "<PARAMETER_VALUE>"
          },
          <!-- additional parameters and values go here -->
        ]
      }
    ]
  }
}'
```

### Request parameters

| Placeholder | Description | Example value |
| --- | --- | --- |
| `<ACCESS_TOKEN>`<br><br>_String_ | **Required.**<br><br>Access token. | `EAAAN6tcBzAUBOZC82CW7iR2LiaZBwUHS4Y7FDtQxRUPy1PHZClDGZBZCgWdrTisgMjpFKiZAi1FBBQNO2IqZBAzdZAA16lmUs0XgRcCf6z1LLxQCgLXDEpg80d41UZBt1FKJZCqJFcTYXJvSMeHLvOdZwFyZBrV9ZPHZASSqxDZBUZASyFdzjiy2A1sippEsF4DVV5W2IlkOSr2LrMLuYoNMYBy8xQczzOKDOMccqHEZD` |
| `<API_VERSION>`<br><br>_String_ | **Optional.**<br><br>API version. If omitted, defaults to the newest API version available to your app. | `v23.0` |
| `<BUSINESS_PHONE_NUMBER_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp Business phone number ID. | `106540352242922` |
| `<HEADER_ASSET_ID>`<br><br>_String_ | **Required if template uses a header media.**<br><br>Header [media asset ID](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media#upload-media). | `1339522734477770` |
| `<PARAMETER_NAME>`<br><br>_String_ | **Required if template uses one or more named parameters.**<br><br>Name of [named parameter](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#named-parameters). | `discount_code` |
| `<PARAMETER_VALUE>`<br><br>_String_ | **Required if template uses one or more named parameters.**<br><br>[Named parameter](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#named-parameters) value. | `WELCOME25` |
| `<TEMPLATE_LANGUAGE>`<br><br>_String_ | **Required.**<br><br>[Template language](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Template name. | `welcome_discount_template` |
| `<WHATSAPP_USER_PHONE_NUMBER>`<br><br>_String_ | **Required.**<br><br>WhatsApp user phone number. | `16505551234` |

### Response syntax

Upon success:

```html
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "<WHATSAPP_USER_PHONE_NUMBER>",
      "wa_id": "<WHATSAPP_USER_ID>"
    }
  ],
  "messages": [
    {
      "id": "<WHATSAPP_MESSAGE_ID>",
      "message_status": "<PACING_STATUS>"
    }
  ]
}
```

### Response parameters

| Placeholder | Description | Example value |
| --- | --- | --- |
| `<PACING_STATUS>` | Template [pacing status](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing). | `accepted` |
| `<WHATSAPP_MESSAGE_ID>` | WhatsApp Message ID.<br><br>This ID is included in status [messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) webhooks for delivery status purposes. | `wamid.HBgLMTY1MDM4Nzk0MzkVAgARGBJBRkJENzExMTRFRjk2NTI1OTEA` |
| `<WHATSAPP_USER_ID>` | WhatsApp user's WhatsApp ID. May not match `input` value. | `16505551234` |
| `<WHATSAPP_USER_PHONE_NUMBER>` | WhatsApp user's WhatsApp phone number. May not match `wa_id` value. | `16505551234` |

### Example request

```curl
curl 'https://graph.facebook.com/v23.0/106540352242922/messages' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer EAAJB...' \
-d '
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "16505551234",
  "type": "template",
  "template": {
    "name": "welcome_discount_template",
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
              "id": "1339522734477770"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "parameter_name": "first_name",
            "text": "Jessica"
          },
          {
            "type": "text",
            "parameter_name": "discount_code",
            "text": "WELCOME25"
          },
          {
            "type": "text",
            "parameter_name": "discount_amount",
            "text": "25%"
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
      "input": "16505551234",
      "wa_id": "16505551234"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgARGBIyQjM2RTlERTY4QjFGNzUwNDgA",
      "message_status": "accepted"
    }
  ]
}
```
