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
  state VARCHAR(50) NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'awaiting_proposition_response', 'in_conversation')),
  active_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  pending_proposition_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
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

-- Add LLM context column to tasks for tracking conversation history across users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='context') THEN
    ALTER TABLE tasks ADD COLUMN context JSONB DEFAULT '{"keyPoints": [], "currentUnderstanding": "", "openQuestions": [], "commitmentsMade": []}';
  END IF;
END $$;

-- Add admin columns to tenants for Firebase Auth
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='admin_email') THEN
    ALTER TABLE tenants ADD COLUMN admin_email VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='admin_firebase_uid') THEN
    ALTER TABLE tenants ADD COLUMN admin_firebase_uid VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='setup_completed') THEN
    ALTER TABLE tenants ADD COLUMN setup_completed BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='asana_project_id') THEN
    ALTER TABLE tenants ADD COLUMN asana_project_id VARCHAR(255);
  END IF;
END $$;

-- Sessions table for server-side session management
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,  -- Firebase UID
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Note: Session cleanup should be done via cron job or scheduled task
-- We don't create a partial index with CURRENT_TIMESTAMP as PostgreSQL
-- requires IMMUTABLE functions in index predicates
