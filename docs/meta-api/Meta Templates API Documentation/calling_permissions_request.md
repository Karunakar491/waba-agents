# Call permission request message template



Call permission request templates allow you to request permission to call WhatsApp users. They include a required **body** component and a **call permission request** component. When a WhatsApp user receives the message, they can grant or deny your business permission to call them.

You can categorize call permission request templates as either `MARKETING` or `UTILITY`. This page demonstrates creating and sending a call permission request template with the `MARKETING` category. See [Call permission request templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-call-permission-request-templates/) for a utility example.

## Limitations

- Only templates categorized as `MARKETING` or `UTILITY` can include a call permission request component.
- You must include body text, and it must not be empty.
- You can't combine the call permission request component with other interactive components.

## Create a call permission request template

Use the [Message Templates API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api) to [create a call permission request template](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api#post-version-waba-id-message-templates).

### Request syntax

```html
curl -X POST \
  'https://graph.facebook.com/<API_VERSION>/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "<TEMPLATE_NAME>",
    "language": "<TEMPLATE_LANGUAGE>",
    "category": "<CATEGORY>",
    "parameter_format": "named",
    "components": [
      {
        "type": "body",
        "text": "<BODY_TEXT>",
        "example": {
          "body_text_named_params": [
            {
              "param_name": "<PARAM_NAME>",
              "example": "<EXAMPLE_PARAM_VALUE>"
            }
          ]
        }
      },
      {
        "type": "call_permission_request"
      }
   ]
}'
```

### Request parameters

| Placeholder | Description | Example value |
| --- | --- | --- |
| `<ACCESS_TOKEN>`<br><br>_String_ | **Required.**<br><br>[System token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#system-user-access-tokens) or [business token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#business-integration-system-user-access-tokens). | `EAAA...` |
| `<API_VERSION>`<br><br>_String_ | **Optional.**<br><br>Graph API version. | v25.0 |
| `<BODY_TEXT>`<br><br>_String_ | **Required.**<br><br>Body text string. Supports named parameters in `{{parameter_name}}` format.<br><br>Maximum 1024 characters. | `Hi {{first_name}}, as a Lucky Shrub VIP, get a first look at our rare new succulents before anyone else. Can we give you a quick call?` |
| `<CATEGORY>`<br><br>_Enum_ | **Required.**<br><br>Template category. Must be `MARKETING` or `UTILITY`. | `MARKETING` |
| `<EXAMPLE_PARAM_VALUE>`<br><br>_String_ | **Required if body text uses named parameters.**<br><br>Example value for the named parameter. | `Pablo` |
| `<PARAM_NAME>`<br><br>_String_ | **Required if body text uses named parameters.**<br><br>Name of the parameter, matching the placeholder in the body text. | `first_name` |
| `<TEMPLATE_LANGUAGE>`<br><br>_Enum_ | **Required.**<br><br>Template [language and locale code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Template name.<br><br>Maximum 512 characters. | `vip_early_access_call` |
| `<WHATSAPP_BUSINESS_ACCOUNT_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp Business account ID. | `106540352242922` |

### Example request


```bash
curl -X POST \
  'https://graph.facebook.com/v23.0/106540352242922/message_templates' \
  -H 'Authorization: Bearer EAAJB...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "vip_early_access_call",
    "language": "en_US",
    "category": "MARKETING",
    "parameter_format": "named",
    "components": [
      {
        "type": "body",
        "text": "Hi {{first_name}}, as a Lucky Shrub VIP, get a first look at our rare new succulents before anyone else. Can we give you a quick call?",
        "example": {
          "body_text_named_params": [
            {
              "param_name": "first_name",
              "example": "Pablo"
            }
          ]
        }
      },
      {
        "type": "call_permission_request"
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

## Send a call permission request template

Use the [Messages API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api) to [send an approved call permission request template](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api#post-version-phone-number-id-messages) in a template message.

### Request syntax

```html
curl -X POST \
  'https://graph.facebook.com/<API_VERSION>/<WHATSAPP_BUSINESS_PHONE_NUMBER_ID>/messages' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "<WHATSAPP_USER_PHONE_NUMBER>",
    "type": "template",
    "template": {
      "name": "<TEMPLATE_NAME>",
      "language": {
        "policy": "deterministic",
        "code": "<TEMPLATE_LANGUAGE_CODE>"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "parameter_name": "<PARAM_NAME>",
              "text": "<PARAM_VALUE>"
            }
          ]
        }
      ]
    }
}'
```

### Request parameters

| Placeholder | Description | Example value |
| --- | --- | --- |
| `<ACCESS_TOKEN>`<br><br>_String_ | **Required.**<br><br>[System token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#system-user-access-tokens) or [business token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#business-integration-system-user-access-tokens). | `EAAA...` |
| `<API_VERSION>`<br><br>_String_ | **Optional.**<br><br>Graph API version. | v25.0 |
| `<PARAM_NAME>`<br><br>_String_ | **Required if the template body uses named parameters.**<br><br>Name of the parameter to replace in the template body. | `first_name` |
| `<PARAM_VALUE>`<br><br>_String_ | **Required if the template body uses named parameters.**<br><br>Value to substitute for the named parameter. | `Pablo` |
| `<TEMPLATE_LANGUAGE_CODE>`<br><br>_Enum_ | **Required.**<br><br>Template [language and locale code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Name of the template to send. | `vip_early_access_call` |
| `<WHATSAPP_BUSINESS_PHONE_NUMBER_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp business phone number ID. | `106540352242922` |
| `<WHATSAPP_USER_PHONE_NUMBER>`<br><br>_String_ | **Required.**<br><br>WhatsApp user phone number. | `+16505551234` |

### Example request

```bash
curl -X POST \
  'https://graph.facebook.com/v23.0/106540352242922/messages' \
  -H 'Authorization: Bearer EAAJB...' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "+15551234567",
    "type": "template",
    "template": {
      "name": "vip_early_access_call",
      "language": {
        "policy": "deterministic",
        "code": "en_US"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "parameter_name": "first_name",
              "text": "Pablo"
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
      "input": "+15551234567",
      "wa_id": "15551234567"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLMTMyMzI4NjU2NzgVAgARGBJBQzRBRDBEMDEwQzVBM0M0QkIA",
      "message_status": "accepted"
    }
  ]
}
```
