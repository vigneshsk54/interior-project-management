import hashlib
import hmac
import json
from datetime import date, timedelta
from decimal import Decimal

from app.schemas.domain import QuotationItemIn
from app.services.quotations import calculate


def enquiry_payload():
    return {
        "title": "Test Residence",
        "contact_name": "Leena Menon",
        "email": "leena@example.com",
        "phone": "9123456706",
        "property_type": "Apartment",
        "location": "Koramangala, Bengaluru",
        "area_sqft": 1450,
        "budget_min": 2000000,
        "budget_max": 3500000,
        "requirements": "Warm minimal apartment with custom storage.",
        "source": "Referral",
    }


def test_quotation_calculation():
    items = [
        QuotationItemIn(
            room="Living",
            category="Furniture",
            description="Media unit",
            quantity=Decimal("2"),
            unit="nos",
            rate=Decimal("10000"),
            tax_rate=Decimal("18"),
            margin_rate=Decimal("10"),
        )
    ]
    subtotal, tax, total = calculate(items, Decimal("1000"))
    assert subtotal == Decimal("22000.00")
    assert tax == Decimal("3960.00")
    assert total == Decimal("24960.00")


def test_enquiry_quote_approval_conversion(client, sales_headers):
    enquiry_response = client.post(
        "/api/v1/enquiries", json=enquiry_payload(), headers=sales_headers
    )
    assert enquiry_response.status_code == 201
    enquiry = enquiry_response.json()
    quote_response = client.post(
        "/api/v1/quotations",
        headers=sales_headers,
        json={
            "enquiry_id": enquiry["id"],
            "title": "Complete interior package",
            "valid_until": str(date.today() + timedelta(days=15)),
            "discount": 25000,
            "items": [
                {
                    "room": "Living Room",
                    "category": "Furniture",
                    "description": "Custom media and display unit",
                    "quantity": 1,
                    "unit": "lot",
                    "rate": 800000,
                    "tax_rate": 18,
                    "margin_rate": 12,
                },
                {
                    "room": "Kitchen",
                    "category": "Modular",
                    "description": "Kitchen cabinetry and hardware",
                    "quantity": 1,
                    "unit": "lot",
                    "rate": 950000,
                    "tax_rate": 18,
                    "margin_rate": 10,
                },
            ],
        },
    )
    assert quote_response.status_code == 201
    quote = quote_response.json()
    project_response = client.post(
        f"/api/v1/quotations/{quote['id']}/approve", headers=sales_headers
    )
    assert project_response.status_code == 200
    project = project_response.json()
    detail = client.get(f"/api/v1/projects/{project['id']}", headers=sales_headers)
    assert detail.status_code == 200
    assert len(detail.json()["milestones"]) == 4
    assert len(detail.json()["tasks"]) == 5
    updated = client.get(f"/api/v1/enquiries/{enquiry['id']}", headers=sales_headers)
    assert updated.json()["enquiry"]["status"] == "won"


def test_webhook_signature_and_idempotency(client):
    payload = {
        "event_type": "task.reminder.sent",
        "workflow": "task-reminder",
        "status": "completed",
    }
    body = json.dumps(payload).encode()
    signature = hmac.new(b"test-webhook-secret", body, hashlib.sha256).hexdigest()
    headers = {
        "X-Webhook-Signature": signature,
        "Idempotency-Key": "reminder-test-1",
        "Content-Type": "application/json",
    }
    first = client.post("/api/v1/webhooks/n8n", content=body, headers=headers)
    assert first.status_code == 200
    second = client.post("/api/v1/webhooks/n8n", content=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
