# Otto Frontend User Flow Specification

## Overview

A registration and setup wizard flow that allows users to:
1. Register an admin account (email/password via Firebase Auth)
2. Connect Slack and Asana by pasting tokens
3. View a dashboard showing connection status

## User Flow

### Step 1: Registration
- Email/password form (Firebase Auth)
- Optional: Google SSO via Firebase
- Fields: email, password, workspace name
- No email verification required
- On success: create tenant in DB, proceed to Step 2

### Step 2: Integration Setup (Single Page)
- Stepper UI showing progress
- **Slack Token Input:**
  - Text field for `xoxb-` bot token
  - Instructions/help text for getting token from Slack app settings
  - Validate on form submit (test API call to Slack)
- **Asana Token Input:**
  - Text field for Personal Access Token
  - Instructions for generating PAT in Asana
  - Validate on submit (test API call to Asana, verify project access)
- **Asana Project Selection:**
  - After token validation, show dropdown of accessible projects
  - User selects which project to sync
- Both integrations required before proceeding
- On validation failure: show error with instructions to fix in Slack/Asana, retry

### Step 3: Dashboard
- Connection status for Slack and Asana
- Last sync timestamp
- Error display if any integration issues
- "Update Token" buttons to re-configure tokens (with re-validation)

## Technical Architecture

### Authentication
- **Provider:** Firebase Auth (SDK only, not hosting)
- **Methods:** Email/password, optional Google SSO
- **Sessions:** Server-side in PostgreSQL
- **Flow:**
  1. User signs up/logs in via Firebase Auth SDK in React
  2. Frontend sends Firebase ID token to backend
  3. Backend verifies token with Firebase Admin SDK
  4. Backend creates session in PostgreSQL, returns session cookie

### Token Storage
- Tokens stored in GCP Secret Manager (encrypts at rest)
- Database stores secret NAME only (not the token)
- Pattern: `{tenant_id}-slack-token`, `{tenant_id}-asana-token`
- On token paste: create/update secret in GCP SM, store name in tenant record

### Database Changes
New `sessions` table:
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,  -- Firebase UID
  tenant_id UUID REFERENCES tenants(id),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Update `tenants` table - add:
```sql
admin_email VARCHAR(255),
admin_firebase_uid VARCHAR(255)
```

### API Endpoints (New Design)

#### Auth
- `POST /api/auth/register` - Create tenant + link Firebase user
- `POST /api/auth/login` - Verify Firebase token, create session
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/me` - Get current user/tenant info

#### Setup
- `POST /api/setup/validate-slack` - Test Slack token, return workspace info
- `POST /api/setup/validate-asana` - Test Asana token, return projects list
- `POST /api/setup/complete` - Save both tokens to GCP SM, mark setup complete

#### Dashboard
- `GET /api/dashboard/status` - Connection health, last sync, errors
- `PUT /api/dashboard/tokens/slack` - Update Slack token (with validation)
- `PUT /api/dashboard/tokens/asana` - Update Asana token (with validation)

### Frontend Changes

#### Remove
- `web/src/components/setup/SlackConnect.tsx` (OAuth popup)
- `web/src/components/setup/AsanaConnect.tsx` (OAuth popup)

#### Modify
- `web/src/components/setup/SetupProgress.tsx` - 3 steps instead of 4
- `web/src/components/setup/WorkspaceForm.tsx` - Add password field, Firebase auth
- `web/src/App.tsx` - Add auth state, protected routes, dashboard route

#### Add
- `web/src/components/setup/TokensForm.tsx` - Combined Slack + Asana token inputs
- `web/src/components/dashboard/Dashboard.tsx` - Status display
- `web/src/components/dashboard/TokenUpdateModal.tsx` - For editing tokens
- `web/src/lib/firebase.ts` - Firebase SDK initialization
- `web/src/hooks/useAuth.ts` - Auth state management
- `web/src/api/auth.ts` - Auth API client functions

#### shadcn Components to Add
- Form (react-hook-form integration)
- Select (for Asana project dropdown)
- Alert (for error/success messages)
- Dialog (for token update modal)
- Separator

### Backend Changes

#### New Files
- `src/handlers/auth.handler.ts` - Auth endpoints
- `src/handlers/setup.handler.ts` - Setup validation endpoints
- `src/handlers/dashboard.handler.ts` - Dashboard endpoints
- `src/services/auth.service.ts` - Firebase verification, session management
- `src/services/setup.service.ts` - Token validation logic
- `src/db/repositories/sessions.repository.ts` - Session CRUD
- `src/middleware/auth.middleware.ts` - Session validation middleware

#### Modify
- `src/index.ts` - Register new routes
- `src/db/schema.sql` - Add sessions table, update tenants
- `src/utils/secrets.ts` - Add createSecret/updateSecret functions

### Token Refresh Handling
- When token expires/revokes during operation:
  1. Attempt silent refresh (for Asana OAuth tokens)
  2. If refresh fails, send Slack DM to admin with re-auth link
  3. Link goes to dashboard with "Update Token" flow

### Duplicate Workspace Prevention
- On registration, check if `slack_workspace_id` already exists
- If exists, show error: "This Slack workspace is already registered"
- One admin account per tenant

## Security Considerations
- All API endpoints (except auth) require valid session
- Tokens validated immediately on input (fail fast)
- Tokens never logged or exposed in API responses
- Session cookies: httpOnly, secure, sameSite=strict
- CSRF protection on state-changing endpoints

## Out of Scope (Future)
- Disconnect/revoke integrations
- Admin ownership transfer
- Multiple users per tenant
- Email verification

## Files to Modify

### Backend
- `src/index.ts`
- `src/db/schema.sql`
- `src/utils/secrets.ts`
- New: `src/handlers/auth.handler.ts`
- New: `src/handlers/setup.handler.ts`
- New: `src/handlers/dashboard.handler.ts`
- New: `src/services/auth.service.ts`
- New: `src/services/setup.service.ts`
- New: `src/db/repositories/sessions.repository.ts`
- New: `src/middleware/auth.middleware.ts`

### Frontend
- `web/src/App.tsx`
- `web/src/components/setup/WorkspaceForm.tsx`
- `web/src/components/setup/SetupProgress.tsx`
- `web/src/api/types.ts`
- Delete: `web/src/components/setup/SlackConnect.tsx`
- Delete: `web/src/components/setup/AsanaConnect.tsx`
- New: `web/src/components/setup/TokensForm.tsx`
- New: `web/src/components/dashboard/Dashboard.tsx`
- New: `web/src/components/dashboard/TokenUpdateModal.tsx`
- New: `web/src/lib/firebase.ts`
- New: `web/src/hooks/useAuth.ts`
- New: `web/src/api/auth.ts`

### Config/Deps
- `web/package.json` - Add firebase SDK
- `package.json` - Add firebase-admin SDK
- `.env.example` - Add Firebase config vars
