import { Conversation, ConversationMessage, Task } from '../models';

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
}

/**
 * Task context enriched with Asana details
 */
export interface TaskContext {
  task: Task;
  asanaTaskName: string;
  asanaTaskDescription?: string;
  asanaTaskUrl: string;
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
  UPDATE_TASK_STATUS = 'update_task_status',
  NOTIFY_ADMIN = 'notify_admin',
  NO_ACTION = 'no_action',
}

/**
 * Outcome of executing an action - used to generate appropriate LLM response
 */
export type ActionOutcome =
  | ClaimTaskOutcome
  | DeclineTaskOutcome
  | GenericActionOutcome;

export interface ClaimTaskOutcome {
  action: 'claim_task';
  success: boolean;
  failureReason?: 'already_claimed' | 'asana_match_failed' | 'task_not_found' | 'error';
  claimedByName?: string;  // Name of user who already claimed (for already_claimed)
}

export interface DeclineTaskOutcome {
  action: 'decline_task';
  success: boolean;
  failureReason?: 'task_not_found' | 'error';
}

export interface GenericActionOutcome {
  action: 'escalate' | 'update_task_status' | 'notify_admin' | 'no_action';
  success: boolean;
  failureReason?: string;
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
