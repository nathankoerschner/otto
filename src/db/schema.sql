-- Otto Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slack_workspace_id VARCHAR(255) NOT NULL UNIQUE,
  slack_bot_token_secret_name VARCHAR(255) NOT NULL,
  asana_workspace_id VARCHAR(255) NOT NULL,
  asana_bot_user_id VARCHAR(255) NOT NULL,
  asana_api_token_secret_name VARCHAR(255) NOT NULL,
  gsheet_url TEXT NOT NULL,
  admin_slack_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asana_task_id VARCHAR(255) NOT NULL,
  asana_task_url TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending_owner', 'owned', 'completed', 'escalated')),
  owner_slack_user_id VARCHAR(255),
  owner_asana_user_id VARCHAR(255),
  due_date TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, asana_task_id)
);

-- Follow-ups table
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('half_time', 'near_deadline')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  response_received BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User mappings table
CREATE TABLE IF NOT EXISTS user_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slack_user_id VARCHAR(255) NOT NULL,
  asana_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slack_user_id)
);

-- Conversations table for NLP context tracking
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slack_user_id VARCHAR(255) NOT NULL,
  slack_channel_id VARCHAR(255),
  state VARCHAR(50) NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'awaiting_proposition_response', 'awaiting_follow_up_response', 'in_conversation')),
  active_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  pending_proposition_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  pending_follow_up_id UUID REFERENCES follow_ups(id) ON DELETE SET NULL,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slack_user_id)
);

-- Conversation messages table for history
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  classified_intent VARCHAR(50),
  confidence DECIMAL(3,2),
  extracted_data JSONB,
  slack_message_ts VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_task_id ON follow_ups(task_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_mappings_tenant_slack ON user_mappings(tenant_id, slack_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_user ON conversations(tenant_id, slack_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations(state) WHERE state != 'idle';
CREATE INDEX IF NOT EXISTS idx_conversations_last_interaction ON conversations(last_interaction_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(conversation_id, created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add response columns to follow_ups if they don't exist (for NLP response tracking)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='response_text') THEN
    ALTER TABLE follow_ups ADD COLUMN response_text TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='response_intent') THEN
    ALTER TABLE follow_ups ADD COLUMN response_intent VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='response_data') THEN
    ALTER TABLE follow_ups ADD COLUMN response_data JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='response_at') THEN
    ALTER TABLE follow_ups ADD COLUMN response_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add proposition tracking columns to tasks if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='proposition_message_ts') THEN
    ALTER TABLE tasks ADD COLUMN proposition_message_ts VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='proposition_sent_at') THEN
    ALTER TABLE tasks ADD COLUMN proposition_sent_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;
