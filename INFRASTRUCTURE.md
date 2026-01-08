# Infrastructure Setup Guide

This document provides step-by-step instructions for setting up the infrastructure for Otto bot on Google Cloud Platform.

## Prerequisites

- Google Cloud Platform account
- `gcloud` CLI installed and configured
- Domain for bot emails (e.g., `otto.example.com`)
- Slack workspace with admin access
- Asana workspace with admin access

## 1. GCP Project Setup

### Create Project

```bash
# Create new GCP project
gcloud projects create otto-bot-prod --name="Otto Bot"

# Set as active project
gcloud config set project otto-bot-prod

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com
```

## 2. Database Setup (Cloud SQL - PostgreSQL)

### Create PostgreSQL Instance

```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create otto-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=03:00

# Set root password
gcloud sql users set-password postgres \
  --instance=otto-db \
  --password=YOUR_SECURE_PASSWORD

# Create application database
gcloud sql databases create otto \
  --instance=otto-db
```

### Initialize Database Schema

```bash
# Connect to the database
gcloud sql connect otto-db --user=postgres

# Run the schema file
\i src/db/schema.sql
```

## 3. Secret Manager Setup

Store sensitive credentials in GCP Secret Manager:

```bash
# Create secrets
echo -n "YOUR_SLACK_SIGNING_SECRET" | \
  gcloud secrets create slack-signing-secret --data-file=-

echo -n "YOUR_SLACK_APP_TOKEN" | \
  gcloud secrets create slack-app-token --data-file=-

echo -n "YOUR_ASANA_WEBHOOK_SECRET" | \
  gcloud secrets create asana-webhook-secret --data-file=-

# Store service account key for Google Sheets
gcloud secrets create sheets-service-account-key \
  --data-file=path/to/service-account-key.json
```

## 4. Service Account Setup

### Create Service Account for Otto

```bash
# Create service account
gcloud iam service-accounts create otto-bot \
  --display-name="Otto Bot Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding otto-bot-prod \
  --member="serviceAccount:otto-bot@otto-bot-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding otto-bot-prod \
  --member="serviceAccount:otto-bot@otto-bot-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Create Service Account for Google Sheets Access

```bash
# Create sheets service account
gcloud iam service-accounts create otto-sheets \
  --display-name="Otto Sheets Access"

# Generate key
gcloud iam service-accounts keys create sheets-key.json \
  --iam-account=otto-sheets@otto-bot-prod.iam.gserviceaccount.com

# Store the key in Secret Manager (done above)
```

**Important**: Share tenant Google Sheets with `otto-sheets@otto-bot-prod.iam.gserviceaccount.com`

## 5. Cloud Run Setup

### Build and Deploy

```bash
# Build container image
gcloud builds submit --tag gcr.io/otto-bot-prod/otto

# Deploy to Cloud Run
gcloud run deploy otto \
  --image gcr.io/otto-bot-prod/otto \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --service-account otto-bot@otto-bot-prod.iam.gserviceaccount.com \
  --add-cloudsql-instances otto-bot-prod:us-central1:otto-db \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DB_HOST=/cloudsql/otto-bot-prod:us-central1:otto-db" \
  --set-env-vars "DB_NAME=otto" \
  --set-env-vars "DB_USER=postgres" \
  --set-env-vars "GCP_PROJECT_ID=otto-bot-prod" \
  --set-env-vars "GCP_SECRET_MANAGER_ENABLED=true" \
  --set-env-vars "BOT_EMAIL_DOMAIN=otto.example.com" \
  --set-secrets "DB_PASSWORD=db-password:latest" \
  --set-secrets "SLACK_SIGNING_SECRET=slack-signing-secret:latest" \
  --set-secrets "SLACK_APP_TOKEN=slack-app-token:latest" \
  --set-secrets "ASANA_WEBHOOK_SECRET=asana-webhook-secret:latest" \
  --set-secrets "SHEETS_PRIVATE_KEY=sheets-service-account-key:latest" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10
```

Note the Cloud Run service URL (e.g., `https://otto-abcd1234-uc.a.run.app`)

## 6. Slack App Setup

### Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "Otto"
4. Select your workspace

### Configure OAuth & Permissions

**Bot Token Scopes:**
- `chat:write` - Send messages
- `im:write` - Send DMs
- `users:read` - Read user information
- `users:read.email` - Read user emails
- `im:history` - Read DM history
- `channels:history` - Read channel messages

### Configure Event Subscriptions

1. Enable Events
2. Request URL: `https://YOUR-CLOUD-RUN-URL/slack/events`
3. Subscribe to bot events:
   - `message.im` - Direct messages to bot
   - `app_mention` - Bot mentions

### Configure Interactivity

1. Enable Interactivity
2. Request URL: `https://YOUR-CLOUD-RUN-URL/slack/interactive`

### Enable Socket Mode (for local development)

1. Enable Socket Mode
2. Generate App-Level Token with `connections:write` scope

### Install App

1. Install to your workspace
2. Copy Bot User OAuth Token → Store in Secret Manager

## 7. Asana Setup

### Create Bot User Accounts

For each tenant:

```bash
# Generate bot email
# Format: bot+{tenant_id}@otto.example.com
```

1. Create Asana account with bot email
2. Invite to tenant's workspace
3. Generate Personal Access Token
4. Store PAT in Secret Manager

### Set Up Webhooks

Webhooks are created programmatically when a tenant is onboarded.

Webhook URL: `https://YOUR-CLOUD-RUN-URL/webhooks/asana`

## 8. Domain Configuration

### Set Up Email Domain

Configure `otto.example.com` to receive emails for bot accounts:

1. Add MX records pointing to email service
2. Configure catch-all forwarding (optional)
3. Set up SPF/DKIM records

**Note**: Asana bot accounts don't need to receive emails, just use the address for account creation.

## 9. Cloud Scheduler (Optional - for periodic tasks)

Set up scheduled jobs for follow-up processing:

```bash
# Create scheduler job for processing follow-ups
gcloud scheduler jobs create http process-followups \
  --schedule="*/10 * * * *" \
  --uri="https://YOUR-CLOUD-RUN-URL/cron/process-followups" \
  --http-method=POST \
  --oidc-service-account-email=otto-bot@otto-bot-prod.iam.gserviceaccount.com \
  --location=us-central1
```

## 10. Monitoring & Logging

### View Logs

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=otto" \
  --limit 50 \
  --format json

# View real-time logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=otto"
```

### Set Up Alerts

Configure alerts for:
- High error rate
- Database connection failures
- Integration failures (Slack/Asana)

## 11. Tenant Onboarding Process

For each new tenant:

1. **Create tenant record in database:**
   ```sql
   INSERT INTO tenants (name, slack_workspace_id, asana_workspace_id, ...)
   VALUES (...);
   ```

2. **Create Asana bot account:**
   - Email: `bot+{tenant_id}@otto.example.com`
   - Invite to tenant's Asana workspace
   - Generate PAT

3. **Store Asana PAT in Secret Manager:**
   ```bash
   echo -n "TENANT_ASANA_PAT" | \
     gcloud secrets create asana-token-{tenant_id} --data-file=-
   ```

4. **Install Slack app to tenant workspace:**
   - Tenant installs via OAuth flow
   - Store bot token in Secret Manager

5. **Configure Google Sheet:**
   - Tenant creates sheet with required structure
   - Shares with `otto-sheets@otto-bot-prod.iam.gserviceaccount.com`
   - Add sheet URL to tenant record

6. **Set admin contact:**
   - Store admin Slack user ID in tenant record

## 12. Local Development Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with local values
# - Use local PostgreSQL instance
# - Disable Secret Manager (GCP_SECRET_MANAGER_ENABLED=false)
# - Add Slack/Asana credentials directly

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## Security Considerations

1. **Never commit secrets** - Always use Secret Manager in production
2. **Rotate credentials regularly** - PATs, webhook secrets, etc.
3. **Use least-privilege IAM** - Service accounts should have minimal permissions
4. **Enable Cloud SQL SSL** - For production databases
5. **Set up VPC** - For additional network isolation (optional)
6. **Enable Cloud Armor** - For DDoS protection (optional)

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
gcloud sql connect otto-db --user=postgres

# Check Cloud SQL instances
gcloud sql instances list
```

### Secret Manager Issues

```bash
# List secrets
gcloud secrets list

# Get secret value (for debugging)
gcloud secrets versions access latest --secret=slack-signing-secret
```

### Cloud Run Issues

```bash
# View service details
gcloud run services describe otto --region=us-central1

# Check recent revisions
gcloud run revisions list --service=otto --region=us-central1
```

## Cost Optimization

- **Cloud Run**: Only charged when handling requests
- **Cloud SQL**: Use smallest instance needed, enable automatic scaling
- **Secret Manager**: Minimal cost for secret storage and access
- **Cloud Storage**: Optional for log archival

Estimated monthly cost for small deployment: $20-50
