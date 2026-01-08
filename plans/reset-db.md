# Reset Database for Testing

## Quick Reset (Clear All Task Data)

Clears tasks, follow-ups, conversations, and messages while preserving tenant configuration:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
TRUNCATE conversation_messages, conversations, follow_ups, tasks CASCADE;
"
```

## What Gets Cleared

| Table | Description |
|-------|-------------|
| `tasks` | All tracked Asana tasks |
| `follow_ups` | Scheduled and sent follow-up reminders |
| `conversations` | NLP conversation state per user |
| `conversation_messages` | Message history for context |

## What's Preserved

| Table | Description |
|-------|-------------|
| `tenants` | Tenant configuration (Slack/Asana credentials) |
| `user_mappings` | Slack-to-Asana user mappings |

## Clear Everything (Including User Mappings)

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
TRUNCATE conversation_messages, conversations, follow_ups, tasks, user_mappings CASCADE;
"
```

## Verify Tables Are Empty

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
SELECT 'tasks' as table_name, count(*) FROM tasks
UNION ALL SELECT 'follow_ups', count(*) FROM follow_ups
UNION ALL SELECT 'conversations', count(*) FROM conversations
UNION ALL SELECT 'conversation_messages', count(*) FROM conversation_messages;
"
```

## Clear Slack DM Screen

Push old messages out of view by sending blank lines to the test user's DM channel:

```bash
# Get the Slack token and send blank messages
SLACK_TOKEN=$(grep "^SLACK_BOT_TOKEN=" .env | cut -d'=' -f2)
CHANNEL="D0A5ZF9JFJ5"  # Nathan's DM channel with Otto

for i in 1 2 3; do
  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"channel\": \"$CHANNEL\", \"text\": \".\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\"}"
done
```

## Full Reset (DB + Slack Screen)

```bash
# Reset database
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
TRUNCATE conversation_messages, conversations, follow_ups, tasks CASCADE;
"

# Clear Slack screen
SLACK_TOKEN=$(grep "^SLACK_BOT_TOKEN=" .env | cut -d'=' -f2)
for i in 1 2 3; do
  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"channel\": \"D0A5ZF9JFJ5\", \"text\": \".\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\\n.\"}" > /dev/null
done
```
