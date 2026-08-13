# Location templates



You can send marketing location template messages that include a map header that displays a specific location. When a WhatsApp user taps the map, their default map app opens to those coordinates. Location templates are useful for promoting store openings, event invitations, pop-up shops, and other location-based promotions.

Categorize a location template as either `MARKETING` or `UTILITY`. This page demonstrates creating and sending a location template with the `MARKETING` category. See [utility location templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/location-templates/) for a utility example.

WhatsApp does not support real-time locations. Specify the location at send time, not at template creation time.

## Limitations

- Only templates categorized as `UTILITY` or `MARKETING` can include a location header
- Real-time locations are not supported
- The location (latitude, longitude, name, address) is specified at send time, not at template creation time

## Create a location template

Use the [Message Templates API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api) to [create a location template](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api#post-version-waba-id-message-templates).

### Supported components

Location templates support the following components:

- 1 location header (**required**)
- 1 body (**required**; supports named parameters)
- 1 footer (optional)
- Buttons (optional)

### Request syntax

```bash
curl -X POST \
  'https://graph.facebook.com/<API_VERSION>/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "<TEMPLATE_NAME>",
    "language": "<TEMPLATE_LANGUAGE>",
    "category": "MARKETING",
    "parameter_format": "named",
    "components": [
      {
        "type": "header",
        "format": "location"
      },
      {
        "type": "body",
        "text": "<BODY_TEXT>",
        "example": {
          "body_text_named_params": [
            {
              "param_name": "<BODY_PARAM_NAME>",
              "example": "<BODY_PARAM_EXAMPLE>"
            }
          ]
        }
      },
      {
        "type": "footer",
        "text": "<FOOTER_TEXT>"
      }
    ]
}'
```

### Request parameters

| Placeholder | Description | Example Value |
| --- | --- | --- |
| `<ACCESS_TOKEN>`<br><br>_String_ | **Required.**<br><br>[System token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#system-user-access-tokens) or [business token](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens#business-integration-system-user-access-tokens). | `EAAA...` |
| `<API_VERSION>`<br><br>_String_ | **Optional.**<br><br>Graph API version. | v25.0 |
| `<BODY_PARAM_EXAMPLE>`<br><br>_String_ | **Required if body text contains named parameters.**<br><br>Example value for the named parameter. You must supply one example for each parameter in your body text. | `Lisa` |
| `<BODY_PARAM_NAME>`<br><br>_String_ | **Required if body text contains named parameters.**<br><br>Name of the parameter, matching the placeholder in the body text. | `customer_name` |
| `<BODY_TEXT>`<br><br>_String_ | **Required.**<br><br>Body text string. Supports named parameters in `{{parameter_name}}` format.<br><br>Maximum 1024 characters. | `Hi {{customer_name}}! We are opening a new store near you. Visit us on opening day for {{discount}} off your first purchase!` |
| `<FOOTER_TEXT>`<br><br>_String_ | **Optional.**<br><br>Footer text. Maximum 60 characters. | `Reply STOP to unsubscribe.` |
| `<TEMPLATE_LANGUAGE>`<br><br>_Enum_ | **Required.**<br><br>Template [language and locale code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Template name.<br><br>Maximum 512 characters. | `store_grand_opening` |
| `<WHATSAPP_BUSINESS_ACCOUNT_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp Business account ID. | `106540352242922` |

### Example request

Create a marketing template with a location header, body with named parameters, footer, and a quick reply button:


```bash
curl -X POST \
  'https://graph.facebook.com/v25.0/106540352242922/message_templates' \
  -H 'Authorization: Bearer EAAJB...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "store_grand_opening",
    "language": "en_US",
    "category": "MARKETING",
    "parameter_format": "named",
    "components": [
      {
        "type": "HEADER",
        "format": "LOCATION"
      },
      {
        "type": "BODY",
        "text": "Hi {{customer_name}}! We are opening a new store near you. Visit us on opening day for {{discount}} off your first purchase!",
        "example": {
          "body_text_named_params": [
            {
              "param_name": "customer_name",
              "example": "Lisa"
            },
            {
              "param_name": "discount",
              "example": "20%"
            }
          ]
        }
      },
      {
        "type": "FOOTER",
        "text": "Reply STOP to unsubscribe."
      },
      {
        "type": "BUTTONS",
        "buttons": [
          {
            "type": "QUICK_REPLY",
            "text": "Unsubscribe from Promos"
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

## Send a location template

Call the [Messages API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api) to [send an approved location template](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api#post-version-phone-number-id-messages) in a template message. You must specify the location coordinates at send time in the header component.

### Request syntax

```bash
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
          "type": "header",
          "parameters": [
            {
              "type": "location",
              "location": {
                "latitude": "<LOCATION_LATITUDE>",
                "longitude": "<LOCATION_LONGITUDE>",
                "name": "<LOCATION_NAME>",
                "address": "<LOCATION_ADDRESS>"
              }
            }
          ]
        },
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "parameter_name": "<BODY_PARAM_NAME>",
              "text": "<BODY_PARAM_VALUE>"
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
| `<BODY_PARAM_NAME>`<br><br>_String_ | **Required if the template body uses named parameters.**<br><br>Name of the parameter to replace in the template body. | `customer_name` |
| `<BODY_PARAM_VALUE>`<br><br>_String_ | **Required if the template body uses named parameters.**<br><br>Value to substitute for the named parameter. | `Maria` |
| `<LOCATION_ADDRESS>`<br><br>_String_ | **Optional.**<br><br>Location address. | `3250 Ocean Park Blvd, Santa Monica, CA 90405` |
| `<LOCATION_LATITUDE>`<br><br>_String_ | **Required.**<br><br>Location latitude in decimal degrees. | `34.01881798498779` |
| `<LOCATION_LONGITUDE>`<br><br>_String_ | **Required.**<br><br>Location longitude in decimal degrees. | `-118.46708679200001` |
| `<LOCATION_NAME>`<br><br>_String_ | **Optional.**<br><br>Location name. | `Lucky Shrub - Santa Monica` |
| `<TEMPLATE_LANGUAGE_CODE>`<br><br>_Enum_ | **Required.**<br><br>Template [language and locale code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages). | `en_US` |
| `<TEMPLATE_NAME>`<br><br>_String_ | **Required.**<br><br>Name of the template to send. | `store_grand_opening` |
| `<WHATSAPP_BUSINESS_PHONE_NUMBER_ID>`<br><br>_String_ | **Required.**<br><br>WhatsApp business phone number ID. | `106540352242922` |
| `<WHATSAPP_USER_PHONE_NUMBER>`<br><br>_String_ | **Required.**<br><br>WhatsApp user phone number. | `+16505551234` |

### Example request

Send the template [created in the example request above](#example-request). You provide the location coordinates and body parameter values at send time. Note that the send-time values differ from the creation-time example values to demonstrate that they are independent.

```bash
curl -X POST \
  'https://graph.facebook.com/v25.0/106540352242922/messages' \
  -H 'Authorization: Bearer EAAJB...' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "+16505551234",
    "type": "template",
    "template": {
      "name": "store_grand_opening",
      "language": {
        "policy": "deterministic",
        "code": "en_US"
      },
      "components": [
        {
          "type": "header",
          "parameters": [
            {
              "type": "location",
              "location": {
                "latitude": "34.01881798498779",
                "longitude": "-118.46708679200001",
                "name": "Lucky Shrub - Santa Monica",
                "address": "3250 Ocean Park Blvd, Santa Monica, CA 90405"
              }
            }
          ]
        },
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "parameter_name": "customer_name",
              "text": "Maria"
            },
            {
              "type": "text",
              "parameter_name": "discount",
              "text": "15%"
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
      "input": "+16505551234",
      "wa_id": "16505551234"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLMTY0NjcwNDM1OTUVAgARGBI1RjQyNUE3NEYxMzAzMzQ5MkEA"
    }
  ]
}
```

