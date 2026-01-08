# Otto - Quick Start Guide

Follow these steps to get Otto running locally:

## ✅ Step-by-Step Setup

### 1. Start PostgreSQL

```bash
# Check if it's running
pg_isready

# If not running, start it (choose one):
brew services start postgresql   # If installed via Homebrew
# OR open Postgres.app if you use that
# OR check your system's service manager
```

### 2. Create the Database

```bash
createdb otto
```

### 3. Configure Environment

```bash
# Copy the example
cp .env.example .env

# Edit .env and set these minimal values:
nano .env  # or use your favorite editor
```

**Minimum required in .env:**
```bash
# Database (update if your settings differ)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=otto
DB_USER=postgres
DB_PASSWORD=your_password_if_any

# For local dev, disable Secret Manager
GCP_SECRET_MANAGER_ENABLED=false

# Get these from Slack:
SLACK_APP_TOKEN=xapp-your-token-here        # Socket mode token
SLACK_BOT_TOKEN=xoxb-your-bot-token-here    # Bot user OAuth token

# Get this from Asana:
ASANA_API_TOKEN=your-personal-access-token-here

# For local testing, any value works:
ASANA_WEBHOOK_SECRET=local-test-secret
```

### 4. Run Migrations

```bash
bun run db:migrate
```

You should see: `Database migration completed successfully`

### 5. (Optional) Add Test Tenant

```bash
# Edit .env and add test values:
TEST_SLACK_WORKSPACE_ID=T123456789    # Your Slack workspace ID
TEST_ASANA_WORKSPACE_ID=W987654321    # Your Asana workspace ID
TEST_ASANA_BOT_USER_ID=A111111111     # Asana bot user ID
TEST_GSHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID
TEST_ADMIN_SLACK_USER_ID=U0123456789  # Your Slack user ID

# Then run:
bun run db:seed
```

### 6. Start the Bot!

```bash
bun dev
```

You should see:
```
[INFO] Starting Otto bot...
[INFO] Database initialized
[INFO] Slack bot started
[INFO] Tenants initialized (0 tenants)  # or 1 if you seeded
[INFO] Scheduler started
[INFO] Otto bot listening on port 3000
```

### 7. Test It

```bash
# In another terminal:
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-12-30T..."}
```

---

## 🔑 Getting API Credentials

### Slack App Setup

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "Otto" and select your workspace
4. In **OAuth & Permissions**:
   - Add scopes: `chat:write`, `users:read`, `im:write`, `im:history`
   - Install to workspace
   - Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. In **Socket Mode**:
   - Enable Socket Mode
   - Generate an app-level token with `connections:write` scope
   - Copy the token (starts with `xapp-`)
6. In **Event Subscriptions** → Enable Events (if using HTTP mode)
7. In **Interactivity & Shortcuts** → Enable and set Request URL

### Asana API Token

1. Go to https://app.asana.com/0/my-apps
2. Click "Personal Access Token"
3. Create a new token
4. Copy the token

### Google Sheets Setup

1. Create a service account at https://console.cloud.google.com/iam-admin/serviceaccounts
2. Create and download a JSON key
3. From the JSON, copy:
   - `client_email` → `SHEETS_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `SHEETS_PRIVATE_KEY` (keep the \n characters)
4. Create a test Google Sheet with columns: `Task URL`, `Assignee`
5. Share the sheet with your service account email

---

## 🎯 How to Test

### Test the Full Flow

1. **In Asana**: Assign a task to your bot user
2. **Watch logs**: Otto should detect the webhook
3. **Check Slack**: You should receive a DM with claim buttons
4. **Click "I'll take it"**: Task should be reassigned to you in Asana

### Test Without Webhooks (Manual Trigger)

```javascript
// In a separate test script:
const task = await taskAssignmentService.seekOwnership('ASANA_TASK_ID', 'TENANT_ID');
```

---

## 🐛 Troubleshooting

### "No tenants found in database"

This is OK for initial testing! Otto will start but won't process any tasks. Add a tenant using the seed script or manually via SQL.

### "Failed to connect to database"

```bash
# Check PostgreSQL is running
pg_isready

# Test connection manually
psql -h localhost -U postgres -d otto

# If it fails, check your DB_* values in .env
```

### "Failed to initialize Slack bot"

- Check that `SLACK_APP_TOKEN` starts with `xapp-`
- Verify Socket Mode is enabled in your Slack app
- Check the token has `connections:write` scope

### "Local dev mode requires SLACK_BOT_TOKEN and ASANA_API_TOKEN"

Make sure these are in your `.env` file (not just the example).

---

## 📝 Next Steps

Once everything is running:

1. **Add your first tenant** (via seed script or SQL)
2. **Create a Google Sheet** with Task URL and Assignee columns
3. **Set up Asana webhooks** (or test manually first)
4. **Assign a test task** to your bot user in Asana
5. **Watch it work!** 🎉

For detailed documentation, see [LOCAL_SETUP.md](./LOCAL_SETUP.md)
