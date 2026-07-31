def test_create_and_update_interactive_records(client, admin_headers):
    customer = client.post(
        "/api/v1/customers",
        headers=admin_headers,
        json={
            "name": "Interactive Client",
            "email": "interactive@example.com",
            "phone": "9000000001",
            "tags": ["test"],
        },
    )
    assert customer.status_code == 201

    project = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={
            "name": "Interactive Project",
            "customer_id": customer.json()["id"],
            "location": "Bengaluru",
            "contract_value": 1500000,
            "budget": 1200000,
        },
    )
    assert project.status_code == 201

    task = client.post(
        "/api/v1/tasks",
        headers=admin_headers,
        json={
            "title": "Interactive task",
            "project_id": project.json()["id"],
            "priority": "high",
        },
    )
    assert task.status_code == 201

    visit = client.post(
        "/api/v1/site-visits",
        headers=admin_headers,
        json={
            "record_type": "site_visit",
            "reference": "VISIT-TEST-1",
            "title": "Initial measurement visit",
            "project_id": project.json()["id"],
            "status": "pending",
        },
    )
    assert visit.status_code == 201
    updated = client.patch(
        f"/api/v1/site-visits/{visit.json()['id']}",
        headers=admin_headers,
        json={"status": "completed"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "completed"

    vendor = client.post(
        "/api/v1/vendors",
        headers=admin_headers,
        json={
            "name": "Interactive Joinery",
            "category": "Carpentry",
            "email": "joinery@example.com",
            "phone": "9000000002",
        },
    )
    assert vendor.status_code == 201

    material = client.post(
        "/api/v1/materials",
        headers=admin_headers,
        json={
            "sku": "INTERACTIVE-001",
            "name": "Test Veneer",
            "category": "Veneer",
            "unit": "sheet",
            "unit_price": 2500,
        },
    )
    assert material.status_code == 201

    design = client.post(
        "/api/v1/designs",
        headers=admin_headers,
        json={
            "project_id": project.json()["id"],
            "room": "Living Room",
            "stage": "Concept",
            "title": "Interactive concept",
        },
    )
    assert design.status_code == 201


def test_exports_settings_and_notification_actions(client, admin_headers):
    setting = client.put(
        "/api/v1/settings/company_profile",
        headers=admin_headers,
        json={"value": {"name": "Atelier Flow"}},
    )
    assert setting.status_code == 200
    assert setting.json()["value"]["name"] == "Atelier Flow"

    export = client.get("/api/v1/reports/export.csv", headers=admin_headers)
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert "project_code,project_name" in export.text

    read_all = client.post("/api/v1/notifications/read-all", headers=admin_headers)
    assert read_all.status_code == 200
    assert "updated" in read_all.json()


def test_dashboard_financials_are_derived_from_payment_records(client, admin_headers):
    before = client.get("/api/v1/dashboard", headers=admin_headers)
    assert before.status_code == 200
    before_data = before.json()
    before_outstanding = before_data["metrics"]["outstanding_payments"]
    before_revenue = before_data["revenue"][-1]["value"]

    pending = client.post(
        "/api/v1/payments",
        headers=admin_headers,
        json={
            "record_type": "client_payment",
            "reference": "PAY-LIVE-PENDING",
            "title": "Live pending collection",
            "status": "pending",
            "amount": 123456,
        },
    )
    assert pending.status_code == 201
    collected = client.post(
        "/api/v1/payments",
        headers=admin_headers,
        json={
            "record_type": "client_payment",
            "reference": "PAY-LIVE-COLLECTED",
            "title": "Live received collection",
            "status": "received",
            "amount": 200000,
        },
    )
    assert collected.status_code == 201

    after = client.get("/api/v1/dashboard", headers=admin_headers)
    assert after.status_code == 200
    after_data = after.json()
    assert after_data["metrics"]["outstanding_payments"] == before_outstanding + 123456
    assert after_data["metrics"]["payment_milestones"] >= 1
    assert after_data["revenue"][-1]["value"] == before_revenue + 2
