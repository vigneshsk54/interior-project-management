from app.db.session import SessionLocal
from app.models import Customer, User
from app.services.credentials import MONGO_CREDENTIAL_MARKER, get_credential_store


def test_login_and_refresh(client):
    login = client.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": "Password@123"}
    )
    assert login.status_code == 200
    tokens = login.json()
    assert tokens["access_token"] and tokens["refresh_token"]
    with SessionLocal() as db:
        admin = db.query(User).filter(User.email == "admin@example.com").one()
        assert admin.password_hash == MONGO_CREDENTIAL_MARKER
        assert get_credential_store().get_password_hash(admin.email)
    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["role"] == "admin"
    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 200
    assert refresh.json()["refresh_token"] != tokens["refresh_token"]


def test_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": "wrong-password"}
    )
    assert response.status_code == 401


def test_signup_rejects_invalid_email_and_non_ten_digit_phone(client):
    invalid_email = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Invalid Email",
            "email": "not-an-email",
            "phone": "9876543210",
            "password": "ValidPassword@123",
        },
    )
    assert invalid_email.status_code == 422

    mistyped_gmail = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Mistyped Gmail",
            "email": "ithurs123@gmail.co",
            "phone": "9123456700",
            "password": "ValidPassword@123",
        },
    )
    assert mistyped_gmail.status_code == 422
    assert "did you mean gmail.com" in str(mistyped_gmail.json())

    for phone in ("987654321", "98765432101", "98765abcde"):
        invalid_phone = client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Invalid Phone",
                "email": f"invalid-phone-{phone}@example.com",
                "phone": phone,
                "password": "ValidPassword@123",
            },
        )
        assert invalid_phone.status_code == 422
        assert "exactly 10 digits" in str(invalid_phone.json())


def test_signup_rejects_phone_used_by_another_person(client):
    first = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "First Phone Owner",
            "email": "first-phone-owner@example.com",
            "phone": "9550000001",
            "password": "ValidPassword@123",
        },
    )
    assert first.status_code == 201

    repeated = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Second Phone Owner",
            "email": "second-phone-owner@example.com",
            "phone": "9550000001",
            "password": "ValidPassword@123",
        },
    )
    assert repeated.status_code == 409
    assert "phone" in repeated.json()["detail"]


def test_client_and_workspace_logins_are_separate(client):
    admin_in_client_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "admin@example.com",
            "password": "Password@123",
            "account_type": "client",
        },
    )
    assert admin_in_client_login.status_code == 403
    assert "Admin / Team login" in admin_in_client_login.json()["detail"]

    client_in_workspace_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "client@example.com",
            "password": "Password@123",
            "account_type": "workspace",
        },
    )
    assert client_in_workspace_login.status_code == 403
    assert "Client login" in client_in_workspace_login.json()["detail"]

    client_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "client@example.com",
            "password": "Password@123",
            "account_type": "client",
        },
    )
    assert client_login.status_code == 200


def test_client_can_sign_up_and_is_logged_in(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "New Client",
            "email": "New.Client@example.com",
            "phone": "9876543210",
            "password": "NewClient@123",
        },
    )
    assert response.status_code == 201
    tokens = response.json()

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "new.client@example.com"
    assert me.json()["role"] == "client"
    with SessionLocal() as db:
        registered = db.query(User).filter(User.email == "new.client@example.com").one()
        assert registered.password_hash == MONGO_CREDENTIAL_MARKER
        assert get_credential_store().get_password_hash(registered.email)

    portal = client.get(
        "/api/v1/portal/client",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert portal.status_code == 200
    assert portal.json()["customer"]["name"] == "New Client"
    assert portal.json()["projects"] == []
    assert portal.json()["enquiries"] == []

    request = client.post(
        "/api/v1/portal/client/enquiries",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        json={
            "title": "New Client Residence",
            "property_type": "Apartment",
            "location": "Indiranagar, Bengaluru",
            "area_sqft": 1200,
            "budget_min": 1500000,
            "budget_max": 2500000,
            "requirements": "A warm modern home with additional storage.",
        },
    )
    assert request.status_code == 201
    assert request.json()["source"] == "Client portal"
    assert request.json()["client_reference"] == "ENQ-2026-0001"
    enquiry_id = request.json()["id"]

    updated_portal = client.get(
        "/api/v1/portal/client",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert updated_portal.json()["enquiries"][0]["title"] == "New Client Residence"
    assert any(
        item["title"] == "Enquiry received"
        for item in updated_portal.json()["notifications"]
    )

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Password@123"},
    ).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}
    dashboard = client.get("/api/v1/dashboard", headers=admin_headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["metrics"]["client_scheduled_projects"] >= 1
    scheduled = next(
        item
        for item in dashboard.json()["scheduled_projects"]
        if item["id"] == enquiry_id
    )
    assert scheduled["client_name"] == "New Client"
    assert scheduled["client_reference"] == request.json()["client_reference"]
    assert scheduled["expected_start_date"] is None

    edited = client.patch(
        f"/api/v1/enquiries/{enquiry_id}",
        headers=admin_headers,
        json={
            "title": "Updated Client Residence",
            "location": "Whitefield, Bengaluru",
            "area_sqft": 1350,
            "budget_min": 1800000,
            "budget_max": 2800000,
            "expected_start_date": "2026-09-15",
            "requirements": "A warm modern home, kitchen island, and additional storage.",
            "status": "contacted",
        },
    )
    assert edited.status_code == 200
    assert edited.json()["title"] == "Updated Client Residence"
    assert edited.json()["status"] == "contacted"
    assert (
        client.patch(
            f"/api/v1/enquiries/{enquiry_id}",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            json={"title": "Client attempted edit"},
        ).status_code
        == 403
    )
    client_view = client.get(
        f"/api/v1/portal/client/enquiries/{enquiry_id}",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert client_view.json()["enquiry"]["location"] == "Whitefield, Bengaluru"

    sales_login = client.post(
        "/api/v1/auth/login",
        json={"email": "sales@example.com", "password": "Password@123"},
    ).json()
    sales_headers = {"Authorization": f"Bearer {sales_login['access_token']}"}
    assert (
        client.get(f"/api/v1/enquiries/{enquiry_id}", headers=sales_headers).status_code
        == 200
    )
    team_status = client.patch(
        f"/api/v1/enquiries/{enquiry_id}",
        headers=sales_headers,
        json={"status": "requirement_collected"},
    )
    assert team_status.status_code == 200
    assert team_status.json()["status"] == "requirement_collected"
    denied_full_edit = client.patch(
        f"/api/v1/enquiries/{enquiry_id}",
        headers=sales_headers,
        json={"location": "Team cannot change this"},
    )
    assert denied_full_edit.status_code == 403
    sales_profile = client.get("/api/v1/profile/activity", headers=sales_headers)
    assert sales_profile.status_code == 200
    assert sales_profile.json()["summary"]["status_updates"] >= 1
    assert any(
        item["description"] == "Enquiry updated: status"
        for item in sales_profile.json()["activities"]
    )
    assert any(
        item["link"] == f"/enquiries/{enquiry_id}"
        for item in client.get("/api/v1/notifications/list", headers=admin_headers).json()
    )
    assert any(
        item["link"] == f"/enquiries/{enquiry_id}"
        for item in client.get("/api/v1/notifications/list", headers=sales_headers).json()
    )

    other_client_login = client.post(
        "/api/v1/auth/login",
        json={"email": "client@example.com", "password": "Password@123"},
    ).json()
    other_client_headers = {
        "Authorization": f"Bearer {other_client_login['access_token']}"
    }
    other_before = client.get(
        "/api/v1/notifications/list", headers=other_client_headers
    ).json()

    question = client.post(
        f"/api/v1/enquiries/{enquiry_id}/messages",
        headers=admin_headers,
        json={"message": "Could you confirm whether the kitchen needs an island?"},
    )
    assert question.status_code == 201
    admin_profile = client.get("/api/v1/profile/activity", headers=admin_headers)
    assert admin_profile.status_code == 200
    assert any(
        item["action"] == "team_message"
        and "kitchen needs an island" in item["description"]
        for item in admin_profile.json()["activities"]
    )
    shared_message = next(
        item
        for item in admin_profile.json()["messages"]
        if "kitchen needs an island" in item["message"]
    )
    assert shared_message["status"] == "open"
    client_notifications = client.get(
        "/api/v1/notifications/list",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    ).json()
    assert any(
        item["category"] == "enquiry_message"
        and item["link"].startswith("/client-activity?message=")
        for item in client_notifications
    )
    assert (
        client.get("/api/v1/notifications/list", headers=other_client_headers).json()
        == other_before
    )
    client_profile = client.get(
        "/api/v1/profile/activity",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert any(
        item["id"] == shared_message["id"] for item in client_profile.json()["messages"]
    )
    client_progress = client.patch(
        f"/api/v1/communications/{shared_message['id']}/status",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        json={"status": "in_progress"},
    )
    assert client_progress.status_code == 200
    assert client_progress.json()["status"] == "in_progress"
    admin_complete = client.patch(
        f"/api/v1/communications/{shared_message['id']}/status",
        headers=admin_headers,
        json={"status": "completed"},
    )
    assert admin_complete.status_code == 200
    assert admin_complete.json()["completed_at"] is not None
    assert (
        client.patch(
            f"/api/v1/communications/{shared_message['id']}/status",
            headers=other_client_headers,
            json={"status": "completed"},
        ).status_code
        == 403
    )

    conversation = client.get(
        f"/api/v1/portal/client/enquiries/{enquiry_id}",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert conversation.status_code == 200
    assert conversation.json()["messages"][0]["activity_type"] == "team_message"
    assert (
        client.get(
            f"/api/v1/portal/client/enquiries/{enquiry_id}",
            headers=other_client_headers,
        ).status_code
        == 403
    )

    reply = client.post(
        f"/api/v1/portal/client/enquiries/{enquiry_id}/messages",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        json={"message": "Yes, please include a four-seat kitchen island."},
    )
    assert reply.status_code == 201
    assert any(
        item["title"].startswith("Client replied")
        and item["link"].startswith("/profile?message=")
        for item in client.get("/api/v1/notifications/list", headers=admin_headers).json()
    )


def test_sign_up_rejects_duplicate_email(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Duplicate Admin",
            "email": "admin@example.com",
            "phone": "9876543210",
            "password": "Duplicate@123",
        },
    )
    assert response.status_code == 409


def test_sign_up_cannot_claim_an_existing_customer(client):
    with SessionLocal() as db:
        db.add(
            Customer(
                name="Existing Client",
                email="existing-client@example.com",
                phone="9123456701",
            )
        )
        db.commit()

    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Existing Client",
            "email": "existing-client@example.com",
            "phone": "9123456701",
            "password": "Existing@123",
        },
    )
    assert response.status_code == 409
    assert "email" in response.json()["detail"]


def test_role_permission_denied(client):
    token = client.post(
        "/api/v1/auth/login", json={"email": "client@example.com", "password": "Password@123"}
    ).json()["access_token"]
    response = client.get("/api/v1/enquiries", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert client.get("/api/v1/customers", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    assert client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    assert client.get("/api/v1/tasks", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    assert client.get("/api/v1/documents/list", headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_only_admin_can_create_team_and_admin_accounts(client, admin_headers, sales_headers):
    payload = {
        "full_name": "Second Administrator",
        "email": "second-admin@example.com",
        "phone": "9123456702",
        "role": "admin",
        "password": "AdminSecure@123",
    }
    denied = client.post("/api/v1/users/team", headers=sales_headers, json=payload)
    assert denied.status_code == 403

    created = client.post("/api/v1/users/team", headers=admin_headers, json=payload)
    assert created.status_code == 201
    assert created.json()["role"] == "admin"

    workspace_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": payload["email"],
            "password": payload["password"],
            "account_type": "workspace",
        },
    )
    assert workspace_login.status_code == 200
    client_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": payload["email"],
            "password": payload["password"],
            "account_type": "client",
        },
    )
    assert client_login.status_code == 403


def test_admin_can_create_client_sign_in(client, admin_headers, sales_headers):
    customer = client.post(
        "/api/v1/customers",
        headers=admin_headers,
        json={
            "name": "Portal Client",
            "email": "portal-client@example.com",
            "phone": "9123456703",
            "company": "Portal Client Studio",
            "tags": ["portal"],
            "notes": "",
        },
    )
    assert customer.status_code == 201

    duplicate_phone = client.post(
        "/api/v1/customers",
        headers=admin_headers,
        json={
            "name": "Different Client",
            "email": "different-client@example.com",
            "phone": "9123456703",
        },
    )
    assert duplicate_phone.status_code == 409
    assert "phone" in duplicate_phone.json()["detail"]

    denied = client.post(
        "/api/v1/users/clients",
        headers=sales_headers,
        json={"customer_id": customer.json()["id"], "password": "ClientPass@123"},
    )
    assert denied.status_code == 403

    created = client.post(
        "/api/v1/users/clients",
        headers=admin_headers,
        json={"customer_id": customer.json()["id"], "password": "ClientPass@123"},
    )
    assert created.status_code == 201
    assert created.json()["email"] == "portal-client@example.com"
    assert created.json()["role"] == "client"

    duplicate = client.post(
        "/api/v1/users/clients",
        headers=admin_headers,
        json={"customer_id": customer.json()["id"], "password": "AnotherPass@123"},
    )
    assert duplicate.status_code == 409

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "portal-client@example.com", "password": "ClientPass@123"},
    )
    assert login.status_code == 200
    client_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    portal = client.get("/api/v1/portal/client", headers=client_headers)
    assert portal.status_code == 200
    assert portal.json()["customer"]["name"] == "Portal Client"

    project = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={
            "name": "Portal Client Project",
            "customer_id": customer.json()["id"],
            "location": "Bengaluru",
            "contract_value": 2500000,
            "budget": 1800000,
        },
    )
    assert project.status_code == 201

    progress = client.get(
        f"/api/v1/portal/client/projects/{project.json()['id']}",
        headers=client_headers,
    )
    assert progress.status_code == 200
    assert progress.json()["project"]["progress"] == 0
    assert "budget" not in progress.json()["project"]
    assert "contract_value" not in progress.json()["project"]

    internal = client.get(f"/api/v1/projects/{project.json()['id']}", headers=client_headers)
    assert internal.status_code == 403

    message = client.post(
        "/api/v1/portal/client/messages",
        headers=client_headers,
        json={
            "subject": "Progress meeting",
            "message": "Please contact me to schedule our next progress discussion.",
            "project_id": project.json()["id"],
        },
    )
    assert message.status_code == 201
    assert message.json()["recipients"] >= 1
    notifications = client.get("/api/v1/notifications/list", headers=admin_headers)
    assert any(item["category"] == "client_message" for item in notifications.json())
