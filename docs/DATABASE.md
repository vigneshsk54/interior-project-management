# Entity overview

Identity is represented by users, roles, permissions, role-permission links, user-role
links, and rotating refresh-token records.

CRM uses customers, contacts, properties, enquiries, activities, follow-ups, and site
visits. Commercial records use quotations, immutable versions, and versioned line items.

Delivery uses projects, membership, configured stages, milestones, tasks, task
dependencies, comments, checklists, rooms, designs, versions, and generic approvals.

Supply and finance use vendors, materials, and the typed operational ledger. The ledger
stores the shared lifecycle contract for purchase requests/orders/work orders,
deliveries, inventory movements, reports, budgets, expenses, invoices, and payments.
Its `data` JSON field holds type-specific attributes while project/customer/vendor,
status, owner, reference, amount, due date, timestamps, and indexes remain strongly
typed.

Documents, notifications, shared client/studio communications, workflow executions,
webhook events, application settings, and audit logs provide cross-cutting services.
Communications retain the sender, particular client, optional enquiry/project, message,
completion status, last updater, and completion timestamp.

UUID primary keys are used throughout. Frequently filtered status, owner, project,
customer, email, due-date, creation-date, and compound workflow columns are indexed.
Operationally recoverable entities use `deleted_at` soft deletion.
