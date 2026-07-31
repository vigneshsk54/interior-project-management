# n8n webhook callbacks

Send callbacks to `POST /api/v1/webhooks/n8n`.

Required headers:

```text
Content-Type: application/json
Idempotency-Key: payment-<payment-id>-2026-07-25
X-Webhook-Signature: <hex HMAC-SHA256>
```

Example body:

```json
{
  "event_type": "payment.reminder.sent",
  "workflow": "payment-reminder",
  "entity_type": "payment",
  "entity_id": "dbda982e-693f-40a3-b466-ab85dad60450",
  "status": "completed",
  "data": {
    "channel": "email",
    "reminder_count": 2
  }
}
```

The signature is the lowercase hexadecimal HMAC-SHA256 digest of the exact raw request
body using `N8N_WEBHOOK_SECRET`. Do not reformat the JSON after signing.

Successful first delivery returns `{"accepted": true, "event_id": "..."}`. A retry with
the same key returns the stored response plus `"duplicate": true`.

