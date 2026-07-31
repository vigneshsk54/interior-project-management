# API guide

All endpoints use the `/api/v1` prefix. Protected requests send
`Authorization: Bearer <access-token>`.

| Domain | Primary endpoints |
|---|---|
| Authentication | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Personal activity | `GET /profile/activity`, `PATCH /communications/{id}/status` |
| Client onboarding | `GET /portal/client`, `POST /portal/client/enquiries`, `GET /portal/client/enquiries/{id}`, `POST /portal/client/enquiries/{id}/messages`, `GET /portal/client/projects/{id}`, `POST /portal/client/messages` |
| Dashboard | `GET /dashboard` |
| Users | `GET /users`, `POST /users/clients`, `POST /users/team` |
| Customers | `GET/POST /customers`, `GET /customers/{id}` |
| Enquiries | `GET/POST /enquiries`, `GET/PATCH /enquiries/{id}`, `POST /enquiries/{id}/messages`, `POST /enquiries/bulk` |
| Quotations | `GET/POST /quotations`, `GET /quotations/{id}`, `POST /quotations/{id}/approve` |
| Projects | `GET/POST /projects`, `GET /projects/{id}` |
| Tasks | `GET/POST /tasks`, `PATCH/DELETE /tasks/{id}` |
| Designs | `GET /designs/list`, `POST /approvals/{id}/decision` |
| Vendors/materials | `GET /vendors/list`, `GET /materials/list` |
| Operations | `GET/POST /site-visits`, `/procurement`, `/site-reports`, `/budgets`, `/invoices`, `/payments` |
| Documents | `GET /documents/list`, `POST /documents/upload` |
| Notifications | `GET /notifications/list`, `POST /notifications/{id}/read` |
| Reports | `GET /reports/overview` |
| Portals | `GET /portal/client`, `GET /portal/vendor` |
| Automation | `POST /webhooks/n8n` |

Collection endpoints accept pagination and applicable `search`, `sort`, `status`,
assignee, project, and health filters. Validation errors use FastAPI's standard
field-aware response. Application errors use an HTTP status and a concise `detail`.

OpenAPI is the authoritative field-level reference at `/api/docs`.

`POST /auth/login` accepts `account_type: "client"` for client-portal
authentication or `account_type: "workspace"` for admin, staff, and vendor
authentication. A valid account submitted through the wrong login type is rejected.

Public registration always creates a client account. Existing administrators can create
studio accounts with `POST /users/team`; the endpoint accepts only studio roles and is
protected by the admin permission. Email addresses never determine authorization—the
role stored on the authenticated user does.

Client project responses are ownership-checked and intentionally omit internal budgets,
contracts, task assignments, and operational records. Clients can submit their details,
send a message to the administrators, and view only their own project completion,
milestones, expected completion date, and designs shared for review.

Creating an enquiry synchronously creates an acknowledgement for its client account and
a notification for every active studio user. Enquiry messages are ownership-checked:
studio questions notify only the client account attached to that enquiry, while client
replies notify the studio team. Both interfaces poll their notification feeds every five
seconds for near-real-time in-app delivery.

All studio roles can open enquiries and update their workflow status. Only administrators
can edit the client, property, budget, schedule, source, and requirements fields. Every
enquiry creation, message, and update stores the acting user, and `GET /profile/activity`
combines those records with that user's other audited work.

Client/studio messages are also stored as shared communications rather than one-sided
alerts. Both the associated client and authorized studio users can read the same message
in My activity and move it through `open`, `in_progress`, and `completed`. Status changes
store the acting user and notify the other side; unrelated clients are denied access.
