from datetime import date
from unittest.mock import Mock

from app.api.v1.router import (
    next_client_enquiry_reference,
    next_enquiry_reference,
)


def test_enquiry_reference_uses_highest_number_for_the_year():
    db = Mock()
    db.scalars.return_value.all.return_value = [
        "ENQ-2026-0002",
        "ENQ-2026-0031",
        "ENQ-2026-NOT-A-NUMBER",
    ]

    assert next_enquiry_reference(db, date(2026, 7, 30)) == "ENQ-2026-0032"


def test_first_enquiry_reference_starts_at_one():
    db = Mock()
    db.scalars.return_value.all.return_value = []

    assert next_enquiry_reference(db, date(2027, 1, 1)) == "ENQ-2027-0001"


def test_client_enquiry_reference_has_its_own_sequence():
    db = Mock()
    db.scalars.return_value.all.return_value = [
        "ENQ-2026-0001",
        "ENQ-2026-0002",
    ]

    assert (
        next_client_enquiry_reference(db, Mock(), date(2026, 7, 30))
        == "ENQ-2026-0003"
    )


def test_each_client_gets_an_independent_enquiry_sequence(client):
    def register(email: str, name: str, phone: str) -> dict[str, str]:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "full_name": name,
                "email": email,
                "phone": phone,
                "password": "ClientSecure@123",
            },
        )
        assert response.status_code == 201
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def create(headers: dict[str, str], title: str) -> dict:
        response = client.post(
            "/api/v1/portal/client/enquiries",
            headers=headers,
            json={
                "title": title,
                "property_type": "Apartment",
                "location": "Bengaluru",
                "requirements": "Complete interior design and execution.",
            },
        )
        assert response.status_code == 201
        return response.json()

    sruthi = register(
        "sequence.sruthi@example.com",
        "Sequence Sruthi",
        "9123456704",
    )
    vignesh = register(
        "sequence.vignesh@example.com",
        "Sequence Vignesh",
        "9123456705",
    )
    enquiries = [
        create(sruthi, "Sruthi request one"),
        create(sruthi, "Sruthi request two"),
        create(vignesh, "Vignesh request one"),
        create(vignesh, "Vignesh request two"),
    ]

    assert [item["client_reference"] for item in enquiries] == [
        "ENQ-2026-0001",
        "ENQ-2026-0002",
        "ENQ-2026-0001",
        "ENQ-2026-0002",
    ]
    assert len({item["reference"] for item in enquiries}) == 4
