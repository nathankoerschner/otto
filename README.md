# Otto - Task Ownership Bot

Otto is a Slack bot that integrates with Asana to manage task ownership across teams. When tasks are assigned to Otto in Asana, it automatically finds owners by messaging designated people in Slack, tracks progress, and follows up until completion.

## Features

- **Automated Task Assignment**: Seeks ownership for tasks assigned to the bot
- **Conversational Interface**: Natural language interaction via Slack
- **Smart Follow-ups**: Due date-based check-ins and reminders
- **User Mapping**: Automatic matching between Slack and Asana users
- **Multi-Tenant**: Single deployment serves multiple organizations
- **Extensible Design**: Abstract interfaces for easy integration with other platforms

## Architecture

- **Language**: TypeScript
- **Runtime**: Bun
- **Database**: PostgreSQL
- **Deployment**: Google Cloud Run
- **Integrations**: Slack, Asana, Google Sheets

## Quick Start

### Prerequisites

- Bun 1.0+
- PostgreSQL 15+
- Slack workspace with admin access
- Asana workspace with admin access
- Google Cloud Platform account (for production)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd otto3

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see below for detailed setup)
```

### Local Development Setup (Detailed)

#### 1. PostgreSQL Database

```bash
# macOS with Homebrew
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb otto

# Initialize schema
psql -d otto -f src/db/schema.sql
```

#### 2. Environment Configuration

Edit `.env` with your local values:

```bash
# Required for local development
PORT=3000
NODE_ENV=development

# Database (local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=otto
DB_USER=postgres
DB_PASSWORD=your_local_password
DB_SSL=false

# Disable GCP Secret Manager locally
GCP_SECRET_MANAGER_ENABLED=false

# Slack credentials (get from Slack app settings)
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_APP_TOKEN=xapp-...        # App-level token for Socket Mode
SLACK_BOT_TOKEN=xoxb-...        # Bot user OAuth token

# Asana credentials
ASANA_API_TOKEN=your_personal_access_token
ASANA_WEBHOOK_SECRET=your_webhook_secret

# Google Sheets (service account)
SHEETS_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Test tenant config (used by seed script)
TEST_SLACK_WORKSPACE_ID=T...
TEST_ASANA_WORKSPACE_ID=...
TEST_ASANA_BOT_USER_ID=...
TEST_GSHEET_URL=https://docs.google.com/spreadsheets/d/...
TEST_ADMIN_SLACK_USER_ID=U...
```

#### 3. Slack App Setup (for local dev)

1. Create a Slack app at https://api.slack.com/apps
2. Enable **Socket Mode** (for local development without public URL)
3. Add these **Bot Token Scopes**:
   - `chat:write`, `im:write`, `users:read`, `users:read.email`, `im:history`
4. Subscribe to **Events**: `message.im`, `app_mention`
5. Enable **Interactivity**
6. Install app to your workspace
7. Copy tokens to `.env`

#### 4. Asana Setup (for local dev)

1. Create a Personal Access Token at https://app.asana.com/0/developer-console
2. Create or use an existing bot user in your Asana workspace
3. Note the workspace ID and bot user ID

#### 5. Google Sheets Setup

1. Create a service account in GCP Console
2. Download the JSON key file
3. Extract `client_email` and `private_key` to `.env`
4. Share your test Google Sheet with the service account email

#### 6. Seed Test Data

```bash
# Create a test tenant in the database
bun run db:seed
```

#### 7. Start Development Server

```bash
bun dev
```

The server will start on `http://localhost:3000` with hot reload enabled.

### Development Commands

```bash
bun dev              # Start development server with hot reload
bun run build        # Compile TypeScript
bun start            # Start production server
bun test             # Run tests
bun run lint         # Lint code
bun run typecheck    # Type check without building
```

## Project Structure

```
src/
├── config/              # Configuration management
├── db/                  # Database setup and migrations
│   ├── migrations/      # SQL migration files
│   └── schema.sql       # Database schema
├── integrations/        # External service integrations
│   ├── interfaces/      # Abstract interfaces
│   ├── slack/           # Slack implementation
│   ├── asana/           # Asana implementation
│   └── sheets/          # Google Sheets implementation
├── services/            # Business logic
│   ├── task-assignment.service.ts
│   ├── follow-up.service.ts
│   └── user-matching.service.ts
├── handlers/            # Webhook and event handlers
│   ├── asana-webhook.handler.ts
│   └── slack-event.handler.ts
├── models/              # TypeScript types and interfaces
├── utils/               # Utility functions
└── index.ts             # Application entry point
```

## Configuration

### Environment Variables

See `.env.example` for all configuration options. Key variables:

- `PORT`: Server port (default: 3000)
- `DB_*`: Database connection settings
- `SLACK_*`: Slack app credentials
- `SHEETS_*`: Google Sheets service account
- `ASANA_WEBHOOK_SECRET`: Webhook verification secret
- `BOT_EMAIL_DOMAIN`: Domain for bot email addresses

### Google Sheets Structure

Tenants provide their own Google Sheet with the following structure:

**Main Sheet (Task Assignments):**
| Task URL | Assignee |
|----------|----------|
| https://app.asana.com/0/123/456 | John Doe |

## Deployment

See [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for detailed deployment instructions.

### Quick Deploy to Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/YOUR-PROJECT/otto
gcloud run deploy otto --image gcr.io/YOUR-PROJECT/otto --platform managed
```

## How It Works

### 1. Task Assignment Flow

1. Task assigned to Otto bot user in Asana
2. Asana webhook triggers Otto
3. Otto looks up task in tenant's Google Sheet
4. Finds designated assignee and sends DM in Slack
5. First person to claim becomes owner (first-come-first-served)
6. Task reassigned in Asana with comment

### 2. Follow-up Flow

1. When task is claimed, follow-ups are scheduled based on due date:
   - **Half-time check-in**: At 50% of time to due date
   - **Near-deadline reminder**: Close to due date
2. Otto sends conversational follow-up: "Hey, how's it going with [task]?"
3. If owner stops responding, escalates to admin

### 3. User Matching

1. Attempts to match by display name between Slack and Asana
2. If no match, checks manual mapping in Google Sheet
3. If still no match, alerts admin to add mapping

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /webhooks/asana` - Asana webhook receiver
- `POST /slack/events` - Slack event subscriptions
- `POST /slack/interactive` - Slack interactive components

## Database Schema

See `src/db/schema.sql` for complete schema. Core tables:

- `tenants` - Organization configurations
- `tasks` - Task tracking and ownership
- `follow_ups` - Scheduled follow-up reminders
- `user_mappings` - Slack ↔ Asana user mappings

## Multi-Tenant Design

- Single Cloud Run service serves all tenants
- Database isolation via `tenant_id` column
- Per-tenant Asana bot users and API tokens
- Per-tenant Slack bot tokens
- Shared infrastructure with tenant-specific configuration

## Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Contributing

1. Follow TypeScript best practices
2. Maintain abstraction layers for integrations
3. Add tests for new features
4. Update documentation

## Troubleshooting

### Database Reset: Service Must Be Restarted

**Important**: The service caches tenant information at startup. If you reset the database while the service is running, you **must restart the service** afterward.

The seed script generates a new random tenant ID each time it runs. If you clear and re-seed the database without restarting, the service will fail with:

```
Key (tenant_id)=(...) is not present in table "tenants"
```

**Correct procedure for database reset:**

```bash
# 1. Stop the service (Ctrl+C or kill the process)

# 2. Clear the database
psql -U postgres -d otto -c "TRUNCATE tasks, follow_ups, user_mappings, tenants CASCADE;"

# 3. Re-seed the database
bun run db:seed

# 4. Restart the service
bun dev
```

### Database Connection Failed

- Verify PostgreSQL is running
- Check `DB_*` environment variables
- Ensure database and schema exist

### Slack Events Not Received

- Verify webhook URL is accessible
- Check `SLACK_SIGNING_SECRET` is correct
- Review Slack app Event Subscriptions configuration

### Asana Webhook Issues

- Verify `ASANA_WEBHOOK_SECRET` matches Asana configuration
- Check webhook is registered for correct resource
- Review Cloud Run logs for errors

## License

MIT

## Support

For issues and questions:
- Create an issue in the repository
- Check [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for deployment help
- Review logs in Cloud Run console
