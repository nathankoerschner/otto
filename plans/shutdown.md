# Shutdown Otto Server

## Quick Shutdown

Kill all Otto and ngrok processes:

```bash
pkill -9 -f "tsx watch"
pkill -9 -f "bun dev"
pkill -9 -f ngrok
```

## One-liner

```bash
pkill -9 -f otto && pkill -9 -f ngrok
```

## Verify Shutdown

Check that nothing is running:

```bash
pgrep -f "otto|ngrok" || echo "All stopped"
```

Check that port 3002 is free:

```bash
lsof -i :3002 || echo "Port 3002 is free"
```

## Kill by Port

If processes are stuck, kill whatever is using port 3002:

```bash
lsof -ti:3002 | xargs kill -9
```

## Full Cleanup

Kill all related processes and verify:

```bash
pkill -9 -f "tsx watch"
pkill -9 -f "bun dev"
pkill -9 -f ngrok
sleep 1
pgrep -f "otto|ngrok" && echo "WARNING: Some processes still running" || echo "All stopped"
lsof -i :3002 && echo "WARNING: Port 3002 still in use" || echo "Port 3002 is free"
```

## Clear Database on Shutdown

When shutting down for a clean restart, clear task-related data while preserving tenant configuration:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
TRUNCATE conversation_messages, conversations, follow_ups, tasks CASCADE;
"
```

## Full Shutdown with DB Clear (Recommended)

```bash
# Kill processes
pkill -9 -f "tsx watch"
pkill -9 -f "bun dev"
pkill -9 -f ngrok

# Clear database
PGPASSWORD=postgres psql -h localhost -U postgres -d otto -c "
TRUNCATE conversation_messages, conversations, follow_ups, tasks CASCADE;
"

# Verify
sleep 1
pgrep -f "otto|ngrok" && echo "WARNING: Some processes still running" || echo "All stopped"
echo "Database cleared, ready for clean restart"
```
