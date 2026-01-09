/**
 * Key point from a conversation about a task
 */
export interface TaskContextKeyPoint {
  timestamp: string;
  slackUserId: string;
  summary: string;
}

/**
 * LLM-generated context stored at the task level.
 * Accumulates across all conversations about this task.
 */
export interface TaskLLMContext {
  keyPoints: TaskContextKeyPoint[];
  currentUnderstanding: string;
  openQuestions: string[];
  commitmentsMade: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slackWorkspaceId: string;
  slackBotTokenSecretName: string;
  asanaWorkspaceId: string;
  asanaBotUserId: string;
  asanaApiTokenSecretName: string;
  asanaProjectId: string | null;
  gsheetUrl: string;
  adminSlackUserId: string;
  adminEmail: string | null;
  adminFirebaseUid: string | null;
  setupCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  PENDING_OWNER = 'pending_owner',
  OWNED = 'owned',
  COMPLETED = 'completed',
  ESCALATED = 'escalated',
}

export interface Task {
  id: string;
  tenantId: string;
  asanaTaskId: string;
  asanaTaskUrl: string;
  status: TaskStatus;
  ownerSlackUserId: string | null;
  ownerAsanaUserId: string | null;
  dueDate: Date | null;
  claimedAt: Date | null;
  propositionMessageTs: string | null;
  propositionSentAt: Date | null;
  /** LLM-generated context accumulated across all conversations about this task */
  context: TaskLLMContext | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum FollowUpType {
  HALF_TIME = 'half_time',
  NEAR_DEADLINE = 'near_deadline',
}

export interface FollowUp {
  id: string;
  taskId: string;
  type: FollowUpType;
  scheduledAt: Date;
  sentAt: Date | null;
  responseReceived: boolean;
  responseText: string | null;
  responseIntent: string | null;
  responseData: Record<string, unknown> | null;
  responseAt: Date | null;
  createdAt: Date;
}

export interface UserMapping {
  id: string;
  tenantId: string;
  slackUserId: string;
  asanaUserId: string;
  createdAt: Date;
}

export interface GSheetTaskRow {
  taskName: string;
  assignee: string;
  [key: string]: string;
}

// Conversation state for NLP context tracking
export enum ConversationState {
  IDLE = 'idle',
  AWAITING_PROPOSITION_RESPONSE = 'awaiting_proposition_response',
  AWAITING_FOLLOW_UP_RESPONSE = 'awaiting_follow_up_response',
  IN_CONVERSATION = 'in_conversation',
}

export interface Conversation {
  id: string;
  tenantId: string;
  slackUserId: string;
  slackChannelId: string | null;
  state: ConversationState;
  activeTaskId: string | null;
  pendingPropositionTaskId: string | null;
  pendingFollowUpId: string | null;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  classifiedIntent: string | null;
  confidence: number | null;
  extractedData: Record<string, unknown> | null;
  slackMessageTs: string | null;
  createdAt: Date;
}
