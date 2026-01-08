# Task Assignment Flow: Asana → Otto → Slack

This document traces the complete code flow when a task is assigned to the Otto bot in Asana.

## Overview

```
Asana Task Assigned to Otto Bot
         ↓
    Webhook fires
         ↓
    Otto receives POST /webhooks/asana
         ↓
    Checks if assignee = bot user
         ↓
    Looks up owner in Google Sheet
         ↓
    Finds Slack user by name
         ↓
    Sends DM asking if they can take the task
         ↓
    Waits for response (NLP or button click)
```

---

## Step 1: Webhook Reception

**File:** `src/handlers/asana-webhook.handler.ts`

When Asana detects a change, it sends a POST request to `/webhooks/asana`.

```typescript
// Line 46-83: Main webhook endpoint
app.post('/webhooks/asana', async (req, res) => {
  // Line 54-58: Handle webhook handshake (initial setup)
  if (req.headers['x-hook-secret']) {
    res.setHeader('x-hook-secret', req.headers['x-hook-secret']);
    return res.status(200).send();
  }

  // Line 62-69: Verify signature (production)
  // Line 71: Extract events from body
  const events = req.body.events || [];

  // Line 74-76: Process each event
  for (const event of events) {
    await handleAsanaEvent(event, tenantId);
  }
});
```

---

## Step 2: Event Filtering

**File:** `src/handlers/asana-webhook.handler.ts`

```typescript
// Line 86-147: handleAsanaEvent()
async function handleAsanaEvent(event: AsanaEvent, tenantId: string) {
  // Line 97-100: Only process task events
  if (event.resource.resource_type !== 'task') {
    return; // Ignore non-task events (stories, projects, etc.)
  }

  // Line 102-106: Extract task ID
  const taskId = event.resource.gid;

  // Line 118-132: Check if this is an assignee change TO the bot
  if (event.action === 'changed' && event.change?.field === 'assignee') {
    const newAssigneeId = event.change.new_value?.gid;

    // Line 122: THE KEY CHECK - is the new assignee our bot?
    if (newAssigneeId === tenant.asanaBotUserId) {
      // Line 129: Start the ownership-seeking flow
      await taskAssignmentService.seekOwnership(taskId, tenantId);
    }
  }
}
```

**Key Decision Point:** Line 122 checks if the task was assigned to the Otto bot user. This is what triggers the entire ownership-seeking flow.

---

## Step 3: Ownership Seeking

**File:** `src/services/task-assignment.service.ts`

```typescript
// Line 36-165: seekOwnership()
async seekOwnership(asanaTaskId: string, tenantId: string): Promise<void> {
  // Line 47: Fetch full task details from Asana
  const asanaTask = await this.asanaClient.getTask(asanaTaskId, tenantId);

  // Line 51-55: Check if we're already processing this task
  const existingTask = await this.tasksRepo.findByAsanaTaskId(asanaTaskId);
  if (existingTask && existingTask.status !== TaskStatus.PENDING_OWNER) {
    return; // Already being handled
  }

  // Line 58-67: Create task record in database
  const task = existingTask || await this.tasksRepo.create({
    tenantId,
    asanaTaskId,
    asanaTaskUrl: asanaTask.url,
    status: TaskStatus.PENDING_OWNER,
    dueDate: asanaTask.dueDate,
  });
```

---

## Step 4: Google Sheets Lookup

**File:** `src/services/task-assignment.service.ts` → `src/integrations/sheets/index.ts`

```typescript
  // Line 70: Look up who should own this task
  const sheetRow = await this.sheetsClient.getTaskAssignment(
    asanaTask.name,
    tenant.googleSheetUrl
  );

  // Line 72-78: If not in sheet, escalate to admin
  if (!sheetRow) {
    await this.escalateToAdmin(task.id, tenant, 'Task not found in assignment sheet');
    return;
  }
```

**File:** `src/integrations/sheets/index.ts`

```typescript
// Line 51-105: getTaskAssignment()
async getTaskAssignment(taskName: string, sheetUrl: string) {
  // Line 58: Load Google Sheet
  const doc = new GoogleSpreadsheet(sheetId, this.auth);
  await doc.loadInfo();

  // Line 66-69: Find the "Ticket Queue" tab
  const sheet = doc.sheetsByTitle['Ticket Queue'] || doc.sheetsByIndex[0];

  // Line 75-88: Search for task by name (case-insensitive)
  for (const row of rows) {
    const rowTaskName = row.get('Task Name') || row.get('Name');
    if (normalize(rowTaskName) === normalize(taskName)) {
      // Line 83: Get assignee from "Recommended Developer" or "Assignee" column
      const assignee = row.get('Recommended Developer') || row.get('Assignee');
      return { assignee, ... };
    }
  }
}
```

---

## Step 5: Slack User Lookup

**File:** `src/services/task-assignment.service.ts` → `src/integrations/slack/index.ts`

```typescript
  // Line 84-93: Find the Slack user by name
  const slackUser = await this.slackBot.getUserByName(sheetRow.assignee, tenantId);

  // Line 86-92: If user not found, escalate
  if (!slackUser) {
    await this.escalateToAdmin(task.id, tenant, `Could not find Slack user: ${sheetRow.assignee}`);
    return;
  }
```

**File:** `src/integrations/slack/index.ts`

```typescript
// Line 102-131: getUserByName()
async getUserByName(name: string, tenantId: string) {
  const client = this.getClient(tenantId);

  // Line 106: Fetch all workspace users from Slack
  const result = await client.users.list({});

  // Line 112-116: Search for matching name
  for (const member of result.members) {
    if (member.real_name?.toLowerCase() === name.toLowerCase() ||
        member.name?.toLowerCase() === name.toLowerCase()) {
      return { id: member.id, name: member.real_name, email: member.profile?.email };
    }
  }
  return null;
}
```

---

## Step 6: Send Slack DM

**File:** `src/services/task-assignment.service.ts`

```typescript
  // Line 96-110: Calculate due date text
  let dueDateText = 'no due date';
  if (asanaTask.dueDate) {
    const daysUntilDue = differenceInDays(asanaTask.dueDate, new Date());
    if (daysUntilDue < 0) dueDateText = `overdue by ${Math.abs(daysUntilDue)} days`;
    else if (daysUntilDue === 0) dueDateText = 'due today';
    else if (daysUntilDue === 1) dueDateText = 'due tomorrow';
    else dueDateText = `due in ${daysUntilDue} days`;
  }

  // Line 111-129: Build Slack message with blocks
  const message = {
    text: `New task: ${asanaTask.name}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi there! Based on your expertise and the team's current workload, I thought you'd be a good fit for this task:\n\n<${asanaTask.url}|${asanaTask.name} (${dueDateText})>`
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Would you be able to take this one on?' }
      }
    ]
  };

  // Line 131-136: Send the DM
  const messageTs = await this.slackBot.sendDirectMessage(slackUser.id, message, tenantId);
```

**File:** `src/integrations/slack/index.ts`

```typescript
// Line 45-61: sendDirectMessage()
async sendDirectMessage(userId: string, message: SlackMessage, tenantId: string) {
  const client = this.getClient(tenantId);

  // Line 49-54: Send via Slack API
  const result = await client.chat.postMessage({
    channel: userId,  // DM channel
    text: message.text,
    blocks: message.blocks,
  });

  return result.ts; // Message timestamp (used as ID)
}
```

---

## Step 7: Update Database & Set Context

**File:** `src/services/task-assignment.service.ts`

```typescript
  // Line 139-144: Store message details for tracking
  await this.tasksRepo.update(task.id, {
    propositionMessageTs: messageTs,
    propositionSentAt: new Date(),
  });

  // Line 147-157: Set conversation context for NLP (if enabled)
  if (this.conversationContextService) {
    await this.conversationContextService.setAwaitingPropositionResponse(
      tenantId,
      slackUser.id,
      task.id
    );
  }

  // Line 160: Schedule auto-escalation if no response
  this.scheduleEscalation(task.id, tenant);
```

---

## Step 8: Escalation Timer

**File:** `src/services/task-assignment.service.ts`

```typescript
// Line 433-445: scheduleEscalation()
private scheduleEscalation(taskId: string, tenant: Tenant) {
  const timeoutMs = (tenant.claimTimeoutHours || 24) * 60 * 60 * 1000;

  setTimeout(async () => {
    // Line 439-442: Check if still unclaimed after timeout
    const task = await this.tasksRepo.findById(taskId);
    if (task?.status === TaskStatus.PENDING_OWNER) {
      await this.escalateUnclaimedTask(taskId);
    }
  }, timeoutMs);
}
```

---

## File Summary

| Component | File | Key Methods |
|-----------|------|-------------|
| Webhook Handler | `src/handlers/asana-webhook.handler.ts` | `handleAsanaEvent()` |
| Task Assignment | `src/services/task-assignment.service.ts` | `seekOwnership()`, `scheduleEscalation()` |
| Slack Integration | `src/integrations/slack/index.ts` | `sendDirectMessage()`, `getUserByName()` |
| Asana Integration | `src/integrations/asana/index.ts` | `getTask()`, `getTaskFull()` |
| Google Sheets | `src/integrations/sheets/index.ts` | `getTaskAssignment()` |
| Database | `src/db/repositories/tasks.repository.ts` | `create()`, `update()`, `findByAsanaTaskId()` |

---

## Key Decision Points

1. **Is assignee the bot?** (`asana-webhook.handler.ts:122`)
   - Only triggers flow if task is assigned to Otto bot

2. **Is task in Google Sheet?** (`task-assignment.service.ts:72`)
   - If not found, escalates to admin instead

3. **Can we find the Slack user?** (`task-assignment.service.ts:84`)
   - If user not found by name, escalates to admin

4. **Did user respond in time?** (`task-assignment.service.ts:439`)
   - If no response after timeout (default 24h), auto-escalates

---

## Database State Transitions

```
Task Created → PENDING_OWNER
                    ↓
        User claims → CLAIMED
        User declines → PENDING_OWNER (reassign)
        Timeout → ESCALATED
                    ↓
        Completed in Asana → COMPLETED
```
