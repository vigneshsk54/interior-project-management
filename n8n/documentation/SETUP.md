# n8n setup

1. Start the stack with `docker compose up --build`.
2. Open `http://localhost/n8n/` and create the owner account.
3. Import each JSON file from `n8n/workflows`.
4. Configure SMTP credentials on all Email Send nodes.
5. Add these n8n environment variables: `APP_API_URL`, `APP_SERVICE_TOKEN`,
   `APP_WEBHOOK_SIGNATURE`, and `FINANCE_EMAIL`.
6. Generate the signature as an HMAC-SHA256 of the exact callback body using
   `N8N_WEBHOOK_SECRET`. In production, replace the static expression in the example
   callback nodes with an n8n Code node that signs the serialized body.
7. Run each workflow manually with a test record, verify its callback under workflow
   executions in Atelier Flow, then activate it.

Webhook callbacks require both `Idempotency-Key` and `X-Webhook-Signature`. Reusing an
idempotency key returns the stored result and does not repeat processing.
