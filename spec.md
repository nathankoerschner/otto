# Otto - Task Ownership Bot

## Overview

Otto is a Slack bot that integrates with Asana to manage task ownership. When tasks are assigned to Otto's bot user in Asana, it messages designated people in Slack to find an owner, tracks their progress, and follows up until completion.

## Core Workflow

1. Task is assigned to Otto bot user in Asana
2. Otto detects assignment via Asana webhooks (near real-time)
3. Otto looks up the task URL in tenant's Google Sheet to find designated assignee
4. Otto DMs that person in Slack asking them to claim the task
5. First person to claim becomes the owner
6. Otto reassigns the task in Asana to the new owner and adds a comment
7. Otto follows up based on due date until task is marked complete in Asana

## Technology Stack

- **Language**: TypeScript
- **Database**: PostgreSQL
- **Deployment**: Google Cloud Run
- **Secrets**: GCP Secret Manager
- **Task System**: Asana (v1 only, designed for extensibility)
- **Communication**: Slack
- **Configuration**: Google Sheets (tenant-provided)

## Multi-Tenant Architecture

### Shared Infrastructure
- Single Cloud Run service
- Single PostgreSQL database with `tenant_id` column isolation
- Single Slack app installed across all tenant workspaces via OAuth

### Per-Tenant Resources
- Dedicated Asana bot user per tenant (email: `bot+{tenant_id}@ottodomain.com`)
- Tenant-provided Google Sheet (shared with service account)
- Tenant-specific configuration stored in database

### Tenant Onboarding
Manual setup process:
1. Create tenant record in database
2. Generate bot email using domain subaddressing
3. Create Asana bot user account with generated email
4. Tenant invites bot user to their Asana workspace
5. Store Asana API token (PAT from bot account) in Secret Manager
6. Tenant installs Slack app to their workspace
7. Tenant creates Google Sheet and shares with service account
8. Configure tenant with Sheet URL and admin contact

## Google Sheets Structure

### Task Assignment Sheet
Tenant provides their own Google Sheet. Required columns:
- **Task URL**: Link to the Asana task (required)
- **Assignee**: Name or identifier of person to contact (required)

Optional columns detected dynamically. Rows are manually entered by tenant.

### User Mapping Sheet (Tab)
For resolving identity mismatches between Slack and Asana:
- **Slack User ID**: Slack's internal user ID
- **Asana User ID**: Asana's internal user ID

This tab is used when automatic name matching fails.

## User Identity Matching

1. Attempt to match user by display name between Slack and Asana
2. If no match found: **fail and alert tenant admin**
3. Admin adds mapping to User Mapping sheet tab
4. Bot retries with explicit mapping

**Strict matching only** - no fuzzy matching, no guessing.

## Task Detection

### Asana Webhooks
- Register webhooks for task assignment events per tenant workspace
- Filter for tasks assigned to tenant's bot user
- Trigger ownership-seeking flow for newly detected tasks

### Historical Tasks
Ignore tasks assigned before system setup. Only process new assignments.

## Ownership-Seeking Flow

### Initial Contact
1. Look up task URL in tenant's Google Sheet
2. Find designated assignee
3. DM that specific person in Slack (no broadcast)
4. Message includes task details and way to claim

### If No Sheet Entry Exists
Escalate directly to tenant's hardcoded admin contact.

### Claiming
- First responder wins (first person to claim gets the task)
- Race condition handling: if task already claimed, show friendly "sorry, already claimed by @person" message
- On successful claim:
  - Update internal tracking
  - Reassign task in Asana from bot to claimer
  - Add comment to Asana task: "Assigned to @name via Otto" with timestamp

### Escalation (No Claim)
If no one claims within **24 hours**:
- Alert tenant's hardcoded admin
- Admin can manually assign or take action

## Follow-Up System

### Trigger Conditions
Based on task due date:
1. **Half-time check-in**: When 50% of time until due date has elapsed
2. **Near-deadline reminder**: Close to due date if task not completed

### No Due Date Handling
If task has no due date, bot sets a **default due date of 2 weeks** from claim time.

### Follow-Up Message
Simple conversational: "Hey, how's it going with [task]?"

### Completion Detection
Poll Asana task status. Stop following up when task's **completed flag** is checked.

### Escalation (Unresponsive Owner)
If owner stops responding to follow-ups:
- Escalate upward to tenant's hardcoded admin

## Slack Bot Capabilities

### App Configuration
- Single Slack app across all tenants
- Companies install via OAuth flow
- Bot name: **Otto** (consistent across all tenants)

### Conversation Style
Conversational - can understand natural language replies, not just button clicks.

### Supported Intents
Core functionality only:
- **Claim task**: "I'll take it", "claiming this", etc.
- **Decline/pass**: "Can't do this one", "pass", etc.
- **Status update**: "Working on it", "blocked on X", "almost done"
- Check current assigned tasks

### Operating Hours
24/7 - no business hours restrictions.

## Asana Integration

### Authentication
- Per-tenant bot user with Personal Access Token
- Bot user created with subaddressed email: `bot+{tenant_id}@ottodomain.com`
- PAT stored in GCP Secret Manager

### Bot User Setup
Each tenant gets a dedicated bot user that:
1. Is invited to their Asana workspace
2. Receives task assignments
3. Makes API calls with its own PAT

### Task Updates
When claiming:
- Reassign task from bot to claiming user
- Add comment: "Assigned to @name via Otto" with timestamp

Completion detection via Asana's built-in completed flag only (not section/status based).

## Google Sheets Integration

### Authentication
Single GCP service account. Tenants share their sheet with the service account email.

### Error Handling
If sheet is malformed, deleted, or access lost:
- Stop processing for that tenant
- Alert tenant admin
- Wait for fix (no fallback behavior)

## Database Schema (PostgreSQL)

### Core Tables

```
tenants
- id (uuid, PK)
- name
- slack_workspace_id
- slack_bot_token (reference to Secret Manager)
- asana_workspace_id
- asana_bot_user_id
- asana_api_token (reference to Secret Manager)
- gsheet_url
- admin_slack_user_id
- created_at
- updated_at

tasks
- id (uuid, PK)
- tenant_id (FK)
- asana_task_id
- asana_task_url
- status (pending_owner, owned, completed, escalated)
- owner_slack_user_id
- owner_asana_user_id
- due_date
- claimed_at
- created_at
- updated_at

follow_ups
- id (uuid, PK)
- task_id (FK)
- type (half_time, near_deadline)
- scheduled_at
- sent_at
- response_received

user_mappings
- id (uuid, PK)
- tenant_id (FK)
- slack_user_id
- asana_user_id
- created_at
```

## Error Handling

### Slack/Asana Access Revoked
- Log the error
- Alert operators (us) for manual intervention
- No automatic recovery attempt

### Name Matching Failure
- Alert tenant admin via Slack DM
- Provide instructions to add mapping to sheet
- Retry after mapping added

### General Errors
- Console logging only (minimal observability for v1)
- Manual investigation when issues arise

## Infrastructure Documentation

Deployment documentation should cover:
- GCP project setup
- Cloud Run service configuration
- Cloud SQL (PostgreSQL) setup
- Secret Manager configuration
- Service account setup and permissions
- Slack app creation and configuration
- Asana app/integration setup
- Domain configuration for bot emails

## Design Principles

### Abstraction
Abstract integrations (Slack, Asana, Google Sheets) behind interfaces to enable:
- Future support for Linear, Jira, etc.
- Testing with mock implementations
- Swapping implementations without core logic changes

### Simplicity
- No metrics/analytics in v1
- No admin dashboard in v1
- No configurable settings per tenant (hardcoded defaults)
- Minimal logging

### Multi-Tenant Safety
- All database queries include tenant_id
- Validate tenant ownership on all operations
- Isolate webhook handlers per tenant

## Out of Scope for v1

- Linear, Jira, or other task system integrations
- Metrics, analytics, or reporting
- Admin web dashboard
- Self-service tenant onboarding
- Business hours / timezone awareness
- Configurable escalation timeouts
- Backup assignees
- User OOO detection
- Historical task backfill
