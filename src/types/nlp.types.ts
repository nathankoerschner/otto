import { Conversation, ConversationMessage, Task, FollowUp } from '../models';

/**
 * Message intents recognized by the NLP system
 */
export enum MessageIntent {
  // Card proposition responses
  ACCEPT_TASK = 'accept_task',
  DECLINE_TASK = 'decline_task',
  ASK_QUESTION = 'ask_question',
  NEGOTIATE_TIMING = 'negotiate_timing',
  REQUEST_MORE_INFO = 'request_more_info',

  // Follow-up responses
  STATUS_UPDATE = 'status_update',
  REPORT_BLOCKER = 'report_blocker',
  REPORT_COMPLETION = 'report_completion',
  REQUEST_HELP = 'request_help',
  REQUEST_EXTENSION = 'request_extension',

  // General
  GENERAL_QUESTION = 'general_question',
  LIST_TASKS = 'list_tasks',
  GREETING = 'greeting',
  UNKNOWN = 'unknown',
}

/**
 * Result of intent classification
 */
export interface IntentClassification {
  intent: MessageIntent;
  confidence: number;
  extractedData: ExtractedData;
  reasoning?: string;
}

/**
 * Union type for extracted data based on intent
 */
export type ExtractedData =
  | TaskAcceptanceDetails
  | TaskDeclineDetails
  | StatusUpdateDetails
  | BlockerDetails
  | ExtensionRequestDetails
  | QuestionDetails
  | Record<string, unknown>;

/**
 * Details extracted when user accepts a task
 */
export interface TaskAcceptanceDetails {
  type: 'acceptance';
  accepted: true;
  conditions?: string;
  proposedStartDate?: string;
  notes?: string;
  [key: string]: unknown;
}

/**
 * Details extracted when user declines a task
 */
export interface TaskDeclineDetails {
  type: 'decline';
  reason?: string;
  suggestAlternative?: boolean;
  alternativePerson?: string;
  availabilityInfo?: string;
  wouldAcceptLater?: boolean;
  [key: string]: unknown;
}

/**
 * Details extracted from status update responses
 */
export interface StatusUpdateDetails {
  type: 'status_update';
  currentStatus: 'not_started' | 'in_progress' | 'blocked' | 'nearly_done' | 'completed';
  progressPercentage?: number;
  estimatedCompletion?: string;
  notes?: string;
  [key: string]: unknown;
}

/**
 * Details extracted when user reports a blocker
 */
export interface BlockerDetails {
  type: 'blocker';
  blockerType: 'technical' | 'dependency' | 'resource' | 'unclear_requirements' | 'external' | 'other';
  description: string;
  needsHelp: boolean;
  suggestedResolution?: string;
  blockedSince?: string;
  [key: string]: unknown;
}

/**
 * Details extracted when user requests a deadline extension
 */
export interface ExtensionRequestDetails {
  type: 'extension';
  requestedDueDate?: string;
  requestedDays?: number;
  reason: string;
  [key: string]: unknown;
}

/**
 * Details extracted from questions
 */
export interface QuestionDetails {
  type: 'question';
  questionType: 'task_details' | 'deadline' | 'scope' | 'process' | 'other';
  question: string;
  [key: string]: unknown;
}

/**
 * Conversation context for LLM processing
 */
export interface ConversationContext {
  conversation: Conversation;
  messages: ConversationMessage[];
  activeTask?: Task;
  pendingFollowUp?: FollowUp;
}

/**
 * Task context enriched with Asana details
 */
export interface TaskContext {
  task: Task;
  asanaTaskName: string;
  asanaTaskDescription?: string;
  asanaTaskUrl: string;
  followUps: FollowUp[];
  lastFollowUpSent?: FollowUp;
  /** Pre-formatted full task data from Asana for LLM context */
  formattedAsanaData?: string;
}

/**
 * Generated response from LLM
 */
export interface GeneratedResponse {
  text: string;
  blocks?: SlackBlock[];
  suggestedActions: SuggestedAction[];
}

/**
 * Slack block type (simplified)
 */
export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: unknown[];
  accessory?: unknown;
  [key: string]: unknown;
}

/**
 * Actions suggested by the LLM that should be executed
 */
export interface SuggestedAction {
  type: SuggestedActionType;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export enum SuggestedActionType {
  CLAIM_TASK = 'claim_task',
  DECLINE_TASK = 'decline_task',
  ESCALATE = 'escalate',
  SCHEDULE_FOLLOW_UP = 'schedule_follow_up',
  UPDATE_TASK_STATUS = 'update_task_status',
  NOTIFY_ADMIN = 'notify_admin',
  NO_ACTION = 'no_action',
}

/**
 * Full result from LLM conversation processing
 */
export interface ConversationResult {
  intent: IntentClassification;
  response: GeneratedResponse;
  updatedContext?: Partial<Conversation>;
}

/**
 * Incoming message from Slack
 */
export interface IncomingMessage {
  text: string;
  userId: string;
  tenantId: string;
  channelId: string;
  threadTs?: string;
  messageTs: string;
}

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: 'claude' | 'openai';
  apiKey: string;
  model: string;
  maxTokens: number;
}
