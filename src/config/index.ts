import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'otto',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },

  // GCP
  gcp: {
    projectId: process.env.GCP_PROJECT_ID || '',
    secretManagerEnabled: process.env.GCP_SECRET_MANAGER_ENABLED === 'true',
  },

  // Slack (single app for all tenants)
  slack: {
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
  },

  // Google Sheets
  sheets: {
    serviceAccountEmail: process.env.SHEETS_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: process.env.SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  },

  // Asana
  asana: {
    webhookSecret: process.env.ASANA_WEBHOOK_SECRET || '',
  },

  // Bot settings
  bot: {
    claimTimeoutHours: 24,
    defaultDueDateDays: 14,
    botEmailDomain: process.env.BOT_EMAIL_DOMAIN || 'otto.example.com',
  },

  // LLM Provider Configuration
  llm: {
    provider: (process.env.LLM_PROVIDER || 'claude') as 'claude' | 'openai',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || '',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1024', 10),
  },

  // NLP Settings
  nlp: {
    confidenceThreshold: parseFloat(process.env.NLP_CONFIDENCE_THRESHOLD || '0.7'),
    conversationTtlHours: parseInt(process.env.CONVERSATION_TTL_HOURS || '24', 10),
    maxConversationHistory: parseInt(process.env.MAX_CONVERSATION_HISTORY || '10', 10),
  },
} as const;

export type Config = typeof config;
