.PHONY: up down migrate test backend-test frontend-test lint build

up:
	docker compose up --build

down:
	docker compose down

migrate:
	docker compose exec backend alembic upgrade head

backend-test:
	cd backend && pytest -q

frontend-test:
	cd frontend && npm test -- --run

test: backend-test frontend-test

lint:
	cd frontend && npm run lint
	cd backend && ruff check .

build:
	cd frontend && npm run build
