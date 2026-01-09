.PHONY: help install dev build start test lint clean docker-build docker-run deploy

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	bun install

dev: ## Start development server
	bun run dev

build: ## Build TypeScript
	bun run build

start: ## Start production server
	bun start

test: ## Run tests
	bun test

test-watch: ## Run tests in watch mode
	bun test --watch

lint: ## Lint code
	bun run lint

lint-fix: ## Lint and fix code
	bun run lint:fix

typecheck: ## Type check without building
	bun run typecheck

clean: ## Clean build artifacts
	rm -rf dist coverage node_modules

docker-build: ## Build Docker image
	docker build -t otto:latest .

docker-run: ## Run Docker container locally
	docker run -p 3000:3000 --env-file .env otto:latest

# GCP Deployment targets
GCP_PROJECT ?= otto-482718
GCP_REGION ?= us-central1
IMAGE_NAME ?= gcr.io/$(GCP_PROJECT)/otto

gcp-build: ## Build and push image to GCR
	gcloud builds submit --tag $(IMAGE_NAME) --project $(GCP_PROJECT)

gcp-deploy: ## Deploy to Cloud Run
	gcloud run deploy otto \
		--image $(IMAGE_NAME) \
		--platform managed \
		--region $(GCP_REGION) \
		--project $(GCP_PROJECT)

gcp-logs: ## Tail Cloud Run logs
	gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=otto" \
		--project $(GCP_PROJECT)

# Database targets
db-connect: ## Connect to Cloud SQL database
	gcloud sql connect otto-db --user=postgres --project $(GCP_PROJECT)

db-migrate: ## Run database migrations
	bun run db:migrate

db-seed: ## Seed database with test data
	bun run db:seed

# Local development
setup: install ## Full local setup
	cp .env.example .env
	@echo "Please edit .env with your configuration"

setup-db: ## Set up local PostgreSQL database
	createdb otto || true
	psql otto < src/db/schema.sql
