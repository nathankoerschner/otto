# Otto - Local Development Setup

## Prerequisites

- Bun 1.0+
- PostgreSQL (you have 18.1 installed ✓)
- Slack workspace (for testing)
- Asana workspace (for testing)

## Step 1: Start PostgreSQL

If PostgreSQL isn't running, start it manually:

```bash
# Option 1: If using Postgres.app, start it from Applications
# Option 2: If using Homebrew
brew services start postgresql

# Option 3: Manual start (find your data directory)
pg_ctl -D /path/to/your/postgres/data start

# Verify it's running
pg_isready
```

## Step 2: Create Database

```bash
# Create the database
createdb otto

# Or using psql
psql postgres -c "CREATE DATABASE otto;"
```

## Step 3: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

### Minimal Configuration for Local Testing

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=otto
DB_USER=postgres          # Your PostgreSQL user
DB_PASSWORD=              # Your PostgreSQL password (leave empty if none)
DB_SSL=false

# GCP (disabled for local dev)
GCP_PROJECT_ID=local-dev
GCP_SECRET_MANAGER_ENABLED=false

# Slack - Get these from https://api.slack.com/apps
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Google Sheets - Service account credentials
# For local testing, you can create a service account at:
# https://console.cloud.google.com/iam-admin/serviceaccounts
SHEETS_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Asana
ASANA_WEBHOOK_SECRET=any_random_string_for_local_testing

# Bot
BOT_EMAIL_DOMAIN=otto.local.test
```

## Step 4: Run Database Migrations

```bash
bun run db:migrate
```

This creates all the necessary tables (tenants, tasks, follow_ups, user_mappings).

## Step 5: Seed Test Data (Optional)

Add a test tenant to the database:

```bash
bun run db:seed
```

This will create a sample tenant. You'll need to edit the seed script with your actual values.

## Step 6: Start the Bot

```bash
# Development mode with hot reload
bun dev

# Or build and run
bun run build
bun start
```

You should see:
```
[INFO] Starting Otto bot...
[INFO] Database initialized
[INFO] Slack bot started
[INFO] Asana client initialized
[INFO] Tenants initialized
[INFO] Services initialized
[INFO] Scheduler started
[INFO] Otto bot listening on port 3000
```

## Step 7: Testing

### Test the Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-12-30T..."}
```

### Test Asana Webhook (Manual)

```bash
curl -X POST http://localhost:3000/webhooks/asana \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "resource": {
        "resource_type": "task",
        "gid": "123456",
        "workspace": {"gid": "your-workspace-id"}
      },
      "action": "changed",
      "change": {
        "field": "assignee",
        "new_value": {"gid": "your-bot-user-id"}
      }
    }]
  }'
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Check your connection settings
psql -h localhost -U postgres -d otto
```

### Slack Connection Issues

- Verify your `SLACK_APP_TOKEN` starts with `xapp-`
- Check Socket Mode is enabled in your Slack app
- Verify the signing secret matches

### Environment Variable Issues

```bash
# Test that environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.DB_NAME)"
```

## Next Steps

1. **Set up Slack App**: https://api.slack.com/apps
   - Enable Socket Mode
   - Add Bot Token Scopes: `chat:write`, `users:read`, `im:write`
   - Install to your workspace

2. **Set up Asana**:
   - Create a bot user account
   - Generate Personal Access Token
   - Store in database (see seed script)

3. **Create Google Sheet**:
   - Create a sheet with columns: "Task URL", "Assignee"
   - Share with your service account email
   - Add the URL to your tenant configuration

4. **Add Tenant** (using seed script or direct SQL):
   ```sql
   INSERT INTO tenants (
     name, slack_workspace_id, slack_bot_token_secret_name,
     asana_workspace_id, asana_bot_user_id, asana_api_token_secret_name,
     gsheet_url, admin_slack_user_id
   ) VALUES (
     'My Test Tenant',
     'T1234567890',
     'slack-bot-token',  -- Will use .env value in local dev
     'W9876543210',
     'A1111111111',
     'asana-api-token',  -- Will use .env value in local dev
     'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID',
     'U0987654321'       -- Your Slack user ID
   );
   ```

## Development Tips

- Use `npm run dev` for hot reload during development
- Check logs in the console for debugging
- Test webhooks using ngrok: `ngrok http 3000`
- Use the `/health` endpoint to verify the bot is running

## Common Commands

```bash
bun dev              # Start with hot reload
bun run build        # Compile TypeScript
bun run typecheck    # Type check without building
bun run lint         # Lint code
bun test             # Run tests
bun run db:migrate   # Run database migrations
bun run db:seed      # Seed test data
```
