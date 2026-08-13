# Coupon code templates



Coupon code templates are marketing templates that display a single copy code button. When the app user taps the button, WhatsApp copies the coupon code to the clipboard.

## Limitations

* Coupon code templates are currently not supported by the WhatsApp web client.
* Copy code button text cannot be customized.
* Templates are limited to one copy code button.

To create and send a coupon code template, follow these steps:

1. [Create a coupon code template](#step-1-create-a-coupon-code-template) using the Message Templates API.
2. [Send a coupon code template](#step-2-send-a-coupon-code-template) using the Messages API.

## Properties set at creation vs. send

Some properties are defined when you create the template, while others are provided when you send it. Some properties span both steps.

**Creation only:**
- Header text
- Body text (with parameter placeholders)
- Quick reply button label
- Copy code button example code

**Send only:**
- Body parameter values (`coupon_code`, `discount`)
- Coupon code (copy code button value)

**Both creation and send:**
- Template name, language (referenced at both steps)

## Step 1: Create a coupon code template

Use the [Message Templates API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api#post-version-waba-id-message-templates) to create a coupon code template.

### Request syntax

```html
curl 'https://graph.facebook.com/<API_VERSION>/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer <ACCESS_TOKEN>' \
-d '
{
  "name": "<TEMPLATE_NAME>",
  "language": "<TEMPLATE_LANGUAGE>",
  "category": "MARKETING",
  "parameter_format": "named",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "<HEADER_TEXT>"
    },
    {
      "type": "BODY",
      "text": "<BODY_TEXT>",
      "example": {
        "body_text_named_params": [
          {
            "param_name": "<BODY_PARAMETER_NAME>",
            "example": "<BODY_PARAMETER_EXAMPLE_VALUE>"
          }
        ]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "<QUICK_REPLY_BUTTON_LABEL_TEXT>"
        },
        {
          "type": "COPY_CODE",
          "example": "<COPY_CODE_BUTTON_EXAMPLE_CODE>"
        }
      ]
    }
  ]
}'
```

### Request parameters

| Placeholder | Description | Example Value |
| --- | --- | --- |
| `<ACCESS_TOKEN>`<br><br>_String_ | **Required.**<br><br>[System token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#system-user-access-tokens) or [business token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#business-integration-system-user-access-tokens). | `EAAA...` |
| `<API_VERSION>`<br><br>_String_ | **Optional.**<br><br>Graph API version. | v25.0 |
| `<BODY_PARAMETER_EXAMPLE_VALUE>`<br><br>_String_ | **Required if using a body component string that includes one or more parameters.**<br><br>Example parameter value. You must supply an example for each parameter defined in your body component string. | `WINTER25` |
| `<BODY_PARAMETER_NAME>`<br><br>_String_ | **Required if using named parameters.**<br><br>Parameter name. Must be a unique string, composed of lowercase characters and underscores. | `coupon_code` |
| `<BODY_TEXT>`<br><br>_String_ | **Required.**<br><br>Template body text. Variables are supported.<br><br>Maximum 1024 characters. | `Shop now through the end of December and use the one-time use code {{coupon_code}} to get {{discount}} off of your entire order!` |
| `<COPY_CODE_BUTTON_EXAMPLE_CODE>`<br><br>_String_ | **Required.**<br><br>String to copy to device clipboard.<br><br>Maximum 20 characters. | `WINTER25` |
| `<HEADER_TEXT>`<br><br>_String_ | **Required if using a text header component.**<br><br>Header text.<br><br>Maximum 60 characters. | `Our Winter Sale is on!` |
| `<QUICK_REPLY_BUTTON_LABEL_TEXT>`<br><br>_String_ | **Required if using a quick-reply button.**<br><br>Button label text. Maximum 25 characters. Alphanumeric characters only. | `Unsubscribe` |
| `<TEMPLATE_LANGUAGE>`<br><br>_String_ | **Required.**<br><br>Template [language code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Template name. Must be unique, unless existing templates with the same name have a different template language.<br><br>Maximum 512 characters. Lowercase, alphanumeric characters and underscores only. | `winter_sale_coupon` |
| `<WHATSAPP_BUSINESS_ACCOUNT_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp Business account ID. | `102290129340398` |

### Response syntax

Upon success, the API responds with:

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
curl 'https://graph.facebook.com/v25.0/102290129340398/message_templates' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer EAAJB...' \
-d '
{
  "name": "winter_sale_coupon",
  "language": "en_US",
  "category": "MARKETING",
  "parameter_format": "named",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Our Winter Sale is on!"
    },
    {
      "type": "BODY",
      "text": "Shop now through the end of December and use the one-time use code {{coupon_code}} to get {{discount}} off of your entire order!",
      "example": {
        "body_text_named_params": [
          {
            "param_name": "coupon_code",
            "example": "WINTER25"
          },
          {
            "param_name": "discount",
            "example": "30%"
          }
        ]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Unsubscribe"
        },
        {
          "type": "COPY_CODE",
          "example": "WINTER25"
        }
      ]
    }
  ]
}'
```


### Example response

```json
{
  "category" : "MARKETING",
  "id" : "1924084211297547",
  "status" : "PENDING"
}
```

## Step 2: Send a coupon code template

Use the [Messages API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api#post-version-phone-number-id-messages) to send an approved coupon template in a template message.

### Request syntax

```html
curl -X POST "https://graph.facebook.com/<API_VERSION>/<WHATSAPP_BUSINESS_PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '
{
    "messaging_product": "whatsapp",
    "to": "<WHATSAPP_USER_PHONE_NUMBER>",
    "type": "template",
    "template": {
      "name": "<TEMPLATE_NAME>",
      "language": {
        "code": "<TEMPLATE_LANGUAGE>"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "parameter_name": "<PARAMETER_NAME>",
              "text": "<PARAMETER_VALUE>"
            }
          ]
        },
        {
          "type": "button",
          "sub_type": "copy_code",
          "index": <BUTTON_INDEX>,
          "parameters": [
            {
              "type": "coupon_code",
              "coupon_code": "<COUPON_CODE>"
            }
          ]
        }
      ]
    }
  }'
```

### Request parameters

| Placeholder | Description | Example Value |
| --- | --- | --- |
| `<ACCESS_TOKEN>`<br><br>_String_ | **Required.**<br><br>[System token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#system-user-access-tokens) or [business token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#business-integration-system-user-access-tokens). | `EAAA...` |
| `<API_VERSION>`<br><br>_String_ | **Optional.**<br><br>Graph API version. | v25.0 |
| `<WHATSAPP_BUSINESS_PHONE_NUMBER_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp business phone number ID. | `106540352242922` |
| `<BUTTON_INDEX>`<br><br>_Integer_ | **Required.**<br><br>Indicates the order in which a button appears, if the template uses multiple buttons.<br><br>Buttons are zero-indexed, so setting the value to `0` causes the button to appear first, and another button with an index of `1` appears next, and so on. | `0` |
| `<COUPON_CODE>`<br><br>_String_ | **Required.**<br><br>String to copy to device clipboard.<br><br>Maximum 20 characters. | `WINTER25` |
| `<PARAMETER_NAME>`<br><br>_String_ | **Required if template uses one or more named parameters.**<br><br>[Named parameter](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#named-parameters) name. | `coupon_code` |
| `<PARAMETER_VALUE>`<br><br>_String_ | **Required if template uses one or more named parameters.**<br><br>[Named parameter](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#named-parameters) value. | `WINTER25` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Name of the template to be sent. | `winter_sale_coupon` |
| `<TEMPLATE_LANGUAGE>`<br><br>_String_ | **Required.**<br><br>The template's language and locale code. | `en_US` |
| `<WHATSAPP_USER_PHONE_NUMBER>`<br><br>_String_ | **Required.**<br><br>WhatsApp user phone number. | `+16505551234` |

### Response syntax

Upon success, the API responds with:

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
      "group_id": "<GROUP_ID>", <!-- Only included if messaging a group -->
      "message_status": "<PACING_STATUS>" <!-- Only included if sending a template -->
    }
  ]
}
```


### Response parameters

| Placeholder | Description | Sample Value |
| --- | --- | --- |
| `<GROUP_ID>`<br><br>_String_ | The string identifier of a group made using the Groups API.<br><br>This field shows when messages are sent, received, or read from a group.<br><br>[Learn more about the Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups) | `Y2FwaV9ncm91cDoxNzA1NTU1MDEzOToxMjAzNjM0MDQ2OTQyMzM4MjAZD` |
| `<PACING_STATUS>`<br><br>_String_ | Indicates [template pacing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing) status. The `message_status` property is only included in responses when sending a [template message](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) that uses a template that is being paced. | `wamid.HBgLMTY0NjcwNDM1OTUVAgARGBI4MjZGRDA0OUE2OTQ3RkEyMzcA` |
| `<WHATSAPP_USER_PHONE_NUMBER>`<br><br>_String_ | WhatsApp user's WhatsApp phone number. May not match `wa_id` value. | `+16505551234` |
| `<WHATSAPP_USER_ID>`<br><br>_String_ | WhatsApp user's WhatsApp ID. May not match `input` value. | `16505551234` |
| `<WHATSAPP_MESSAGE_ID>`<br><br>_String_ | WhatsApp Message ID. This ID appears in associated **messages** webhooks, such as sent, read, and delivered webhooks. | `wamid.HBgLMTY0NjcwNDM1OTUVAgARGBI4MjZGRDA0OUE2OTQ3RkEyMzcA` |

### Example request

```curl
curl 'https://graph.facebook.com/v25.0/106540352242922/messages' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer EAAJB...' \
-d '
{
  "messaging_product": "whatsapp",
  "to": "16505551234",
  "type": "template",
  "template": {
    "name": "winter_sale_coupon",
    "language": {
      "code": "en_US"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "parameter_name": "coupon_code",
            "text": "WINTER25"
          },
          {
            "type": "text",
            "parameter_name": "discount",
            "text": "30%"
          }
        ]
      },
      {
        "type": "button",
        "sub_type": "copy_code",
        "index": 1,
        "parameters": [
          {
            "type": "coupon_code",
            "coupon_code": "WINTER25"
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
      "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgARGBIxRjk1REYzMDBERDE3RUI0RDYA"
    }
  ]
}
```

