# Currently Working On

Last updated: 2025-01-07

## Active Bug: "Could not claim task" Error on Task Acceptance

### Problem Description
When a user accepts a task invitation from Otto in Slack (clicks "Yes, I can take this" button), the task IS correctly assigned in Asana, but an error message still appears in Slack:

```
Only visible to you
❌ Could not claim task. It may have already been claimed.
```

The task assignment succeeds (visible in Asana), but the user sees an error message.

### Root Cause Analysis
The issue appears to be a **race condition / double-click scenario**. When the Slack button is clicked:

1. First request processes → `claimTask()` succeeds → task assigned in Asana → returns `true`
2. Second request (duplicate) → finds task already has status `OWNED` → returns `false` → error shown

The error message is ephemeral ("only visible to you") which confirms it's coming from a secondary request.

### Fix Applied (needs verification)
**File:** `src/services/task-assignment.service.ts` (lines 167-172)

Added idempotency check to `claimTask()` method:

```typescript
if (task.status === TaskStatus.OWNED) {
  // If the same user is trying to claim again (double-click), return success (idempotent)
  if (task.ownerSlackUserId === slackUserId) {
    logger.info('Task already claimed by same user, returning success (idempotent)', { taskId, slackUserId });
    return true;
  }
  // ... rest of error handling for different user
}
```

### Status
- [x] Fix implemented in source code
- [x] Build errors fixed (asana SDK type issues, unused variables)
- [x] Build passes successfully
- [ ] **Fix NOT verified** - User reports error still occurring

### Next Steps to Debug
1. Check if the tsx watch process actually reloaded with new code
2. Add more logging to trace the exact flow when button is clicked
3. Check if there's something else causing the `false` return (exception in catch block?)
4. Look at Slack's request logs to see if duplicate requests are being sent
5. Consider adding request deduplication based on action timestamp

### Possible Alternative Causes
- Exception thrown somewhere in `claimTask()` that falls through to catch block (line 257-265)
- Database transaction issue causing first update to not be visible to second request
- Slack sending multiple webhook requests for single button click
- Something in the Asana API call failing silently

### Files Modified in This Session
1. `src/services/task-assignment.service.ts` - Added idempotency check
2. `src/integrations/asana/index.ts` - Fixed asana v3 SDK type issues
3. `src/integrations/slack/index.ts` - Fixed middleware type issue
4. `src/db/repositories/user-mappings.repository.ts` - Removed unused function
5. `src/services/user-matching.service.ts` - Removed unused methods and imports
6. `README.md` - Enhanced local development setup documentation

---

## Build Issues Fixed

### Problem
TypeScript build was failing with multiple errors before the main bug fix could take effect.

### Errors Fixed
1. **Asana SDK type mismatch**: `@types/asana` (v0.18.17) doesn't match `asana` SDK (v3.0.0)
   - Fix: Cast asana import to `any` and use `AsanaApi` wrapper

2. **Slack middleware types**: `event` property not on middleware args
   - Fix: Extract `event` from args using type assertion

3. **Unused variables**: Various unused functions and imports
   - Fix: Removed dead code

### Build Status
✅ `npm run build` passes successfully

---

## Environment Notes

- **Runtime**: Node.js with tsx (TypeScript execution)
- **Dev server**: `npm run dev` uses tsx watch for hot reload
- **Database**: PostgreSQL (local)
- **Process running**: tsx watch on src/index.ts

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Build TypeScript
npm run build

# Run database migrations
npm run db:migrate

# Seed test data
npm run db:seed

# Check running processes
ps aux | grep -E "node.*otto|npm.*dev"

# Kill dev server
pkill -f "tsx watch"
```
