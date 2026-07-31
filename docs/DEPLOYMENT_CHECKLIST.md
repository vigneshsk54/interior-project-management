# Deployment checklist

- [ ] Replace `SECRET_KEY`, database credentials, n8n encryption key, and webhook secret
- [ ] Use managed PostgreSQL with TLS, automated backups, and point-in-time recovery
- [ ] Run `alembic upgrade head` once as a release job before application rollout
- [ ] Set exact `CORS_ORIGINS`; do not use wildcard origins with credentials
- [ ] Terminate TLS at a managed load balancer or hardened Nginx instance
- [ ] Store uploads in private object storage and enable antivirus scanning
- [ ] Configure SMTP credentials and test every imported n8n workflow
- [ ] Restrict n8n editor access with SSO, VPN, or an IP allow list
- [ ] Forward application, audit, proxy, and workflow logs to centralized retention
- [ ] Add uptime, error-rate, database saturation, queue, and disk alerts
- [ ] Run backend tests, frontend lint/tests, and the production web build
- [ ] Perform restore, token rotation, client isolation, and webhook replay tests
- [ ] Confirm the initial administrator uses a real email and a unique password
