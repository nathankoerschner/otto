# Startup Otto Server

## Prerequisites

- PostgreSQL running on localhost
- Node.js installed
- ngrok installed and authenticated
- `.env` file configured with Slack/Asana credentials

## Quick Start

### 1. Start ngrok (for Asana webhooks)

If using a reserved domain:
```bash
ngrok http 3002 --domain=entangleable-jess-dovetailed.ngrok-free.dev &
```

Or for a random URL:
```bash
ngrok http 3002 &
```

### 2. Verify ngrok is working

```bash
# Wait for ngrok to start
sleep 3

# Check tunnel is active
curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"'

# Verify external connectivity (get the URL first)
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | cut -d'"' -f4)
echo "ngrok URL: $NGROK_URL"

# Check ngrok status
curl -s http://localhost:4040/api/status | grep -o '"status":"[^"]*"'
```

If ngrok shows online but external requests fail, it may be a local TLS issue - the tunnel still works for external services like Asana.

### 3. Start Otto

```bash
bun dev
```

### 3. Verify Running

```bash
# Check Otto is listening
curl -s http://localhost:3002/webhooks/asana -X POST -H "Content-Type: application/json" -d '{"events":[]}' && echo " - OK"

# Check Slack connection (look for "connected:ready" in logs)
```

## Clean Start (Wipe Task Data)

Reset database while preserving tenant configuration:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
TRUNCATE conversation_messages, conversations, follow_ups, tasks CASCADE;
"
```

Clear Slack DM screen:

```bash
SLACK_TOKEN=$(grep "^SLACK_BOT_TOKEN=" .env | cut -d'=' -f2)
for i in 1 2 3; do
  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"channel": "D0A5ZF9JFJ5", "text": ".\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n.\n."}' > /dev/null
done
```

## Full Startup Sequence

```bash
# 1. Ensure clean state (kill any existing processes)
pkill -9 -f "tsx watch" 2>/dev/null
pkill -9 -f ngrok 2>/dev/null
sleep 1

# 2. Reset database (for clean testing)
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
TRUNCATE conversation_messages, conversations, follow_ups, tasks CASCADE;
"

# 3. Start ngrok with reserved domain
ngrok http 3002 --domain=entangleable-jess-dovetailed.ngrok-free.dev > /tmp/ngrok.log 2>&1 &
sleep 3

# 4. Verify ngrok is working
curl -s http://localhost:4040/api/status | grep -q '"status":"online"' && echo "ngrok: OK" || echo "ngrok: FAILED"

# 5. Start Otto
bun dev
```

## Asana Webhook Registration

If webhooks aren't firing, you may need to re-register:

```bash
# Check existing webhooks
ASANA_TOKEN=$(grep "^ASANA_API_TOKEN=" .env | cut -d'=' -f2)
WORKSPACE=$(grep "^TEST_ASANA_WORKSPACE_ID=" .env | cut -d'=' -f2)

curl -s "https://app.asana.com/api/1.0/webhooks?workspace=$WORKSPACE" \
  -H "Authorization: Bearer $ASANA_TOKEN"
```

```bash
# Register new webhook (if needed)
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | cut -d'"' -f4)

curl -s -X POST "https://app.asana.com/api/1.0/webhooks" \
  -H "Authorization: Bearer $ASANA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"data\":{\"resource\":\"1201958742227240\",\"target\":\"$NGROK_URL/webhooks/asana\"}}"
```

## Verify Everything Works

1. **Otto running**: `curl http://localhost:3002/webhooks/asana -X POST -d '{"events":[]}'` returns `{"success":true}`
2. **Slack connected**: Logs show `connected:ready`
3. **Webhooks active**: Assign a task to Otto bot in Asana, should trigger a Slack DM

## Troubleshooting

### Port 3002 in use
```bash
lsof -ti:3002 | xargs kill -9
```

### Multiple Otto instances
```bash
pkill -9 -f "tsx watch"
pkill -9 -f "npm run dev"
```

### Webhook not firing
- Check ngrok is running: `curl http://localhost:4040/api/tunnels`
- Check webhook is registered and active in Asana
- Re-register webhook if ngrok URL changed

### Too many websockets error
Kill all Otto processes and restart with only one instance.
