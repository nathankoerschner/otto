import { MessageIntent } from '../../types/nlp.types';
import { AsanaTaskFull } from '../asana';

/**
 * Format full Asana task data for LLM context
 */
export function formatAsanaTaskForLLM(task: AsanaTaskFull): string {
  let context = `TASK DETAILS:\n`;
  context += `- Name: ${task.name}\n`;
  context += `- URL: ${task.url}\n`;

  if (task.description) {
    context += `- Description: ${task.description}\n`;
  }

  if (task.dueDate) {
    context += `- Due date: ${task.dueDate.toLocaleDateString()}\n`;
  }

  if (task.assignee) {
    context += `- Currently assigned to: ${task.assignee.name}\n`;
  }

  if (task.createdBy) {
    context += `- Created by: ${task.createdBy.name}\n`;
  }

  if (task.completed) {
    context += `- Status: Completed\n`;
  }

  if (task.projects && task.projects.length > 0) {
    context += `- Projects: ${task.projects.map(p => p.name).join(', ')}\n`;
  }

  if (task.tags && task.tags.length > 0) {
    context += `- Tags: ${task.tags.join(', ')}\n`;
  }

  // Include custom fields (this is where time estimates, priority, etc. live)
  if (task.customFields && task.customFields.length > 0) {
    context += `- Custom fields:\n`;
    for (const field of task.customFields) {
      context += `  - ${field.name}: ${field.value}\n`;
    }
  }

  if (task.createdAt) {
    context += `- Created: ${task.createdAt.toLocaleDateString()}\n`;
  }

  return context;
}

/**
 * System prompt for intent classification
 */
export const INTENT_CLASSIFICATION_SYSTEM_PROMPT = `You are Otto, a helpful task assignment assistant for Slack integrated with Asana.

Your role is to understand user messages in the context of task management and ownership.

Given a user message and context, classify the user's intent into one of these categories:

TASK PROPOSITION RESPONSES (when user is responding to a task assignment request):
- accept_task: User wants to take on/claim a task (e.g., "Sure!", "I'll do it", "Yes, I can handle this")
- decline_task: User cannot or does not want to take the task (e.g., "Sorry, I can't", "Too busy right now")
- ask_question: User has questions about the task before deciding (e.g., "What's the deadline?", "Who requested this?")
- negotiate_timing: User wants to discuss due dates or timing (e.g., "Can we push the deadline?", "I can do it next week")
- request_more_info: User needs more details before deciding (e.g., "Tell me more about this task", "What exactly is needed?")

GENERAL:
- general_question: General question about tasks or Otto (e.g., "How does this work?", "What tasks are assigned to me?")
- list_tasks: User wants to see their tasks (e.g., "Show my tasks", "What's on my plate?")
- greeting: Simple greeting (e.g., "Hi", "Hello")
- unknown: Cannot determine intent

Consider the conversation context carefully:
- If there's a pending proposition (awaiting_proposition_response state), prioritize proposition-related intents
- Look for both explicit statements and implicit signals

Extract relevant data based on the intent:
- For declines: extract reason, whether they suggest someone else

Respond with JSON only.`;

/**
 * User prompt template for intent classification
 */
export function buildIntentClassificationPrompt(
  userMessage: string,
  conversationState: string,
  taskData?: string,
  recentMessages?: { role: string; content: string }[]
): string {
  let prompt = `Classify the intent of this user message:\n\n`;
  prompt += `MESSAGE: "${userMessage}"\n\n`;

  prompt += `CONTEXT:\n`;
  prompt += `- Conversation state: ${conversationState}\n`;

  if (taskData) {
    prompt += `\n${taskData}\n`;
  }

  if (recentMessages && recentMessages.length > 0) {
    prompt += `\nRECENT CONVERSATION:\n`;
    for (const msg of recentMessages.slice(-5)) {
      prompt += `${msg.role}: ${msg.content}\n`;
    }
  }

  prompt += `\nRespond with JSON in this exact format:
{
  "intent": "<one of the intent categories>",
  "confidence": <0.0 to 1.0>,
  "extractedData": { <relevant extracted data based on intent> },
  "reasoning": "<brief explanation of why you chose this intent>"
}`;

  return prompt;
}

/**
 * System prompts for response generation based on intent
 */
export const RESPONSE_GENERATION_PROMPTS: Record<MessageIntent, string> = {
  [MessageIntent.ACCEPT_TASK]: `The user has agreed to take on the task. Generate a warm, friendly confirmation message.
Include:
- Thank them for taking it on
- Confirm the task name and due date if available
- Let them know you'll check in on progress
- Keep it brief and conversational`,

  [MessageIntent.DECLINE_TASK]: `The user has declined the task. Generate an understanding, supportive response.
Include:
- Acknowledge their response without judgment
- If they provided a reason, acknowledge it
- Let them know you'll find someone else
- Keep it brief and positive`,

  [MessageIntent.ASK_QUESTION]: `The user has a question about the task. Generate a helpful response that directly answers their question, then gently guide them back toward making a decision.
Include:
- IMPORTANT: Read the TASK DETAILS provided and use that information to answer the user's specific question
- If the information they asked about is in the task details (name, description, due date, assignee, created by, custom fields, etc.), provide it directly
- If the information is not available in the task details, clearly say you don't have that specific information
- After answering, gently ask if they'd like to take on the task or if they have other questions
- Keep the tone conversational and not pushy`,

  [MessageIntent.NEGOTIATE_TIMING]: `The user wants to discuss timing. Generate a collaborative response that moves toward a decision.
Include:
- Acknowledge their timing concern
- Show flexibility where appropriate
- If they proposed a new date, confirm you've noted it and ask if that means they're willing to take it on with that adjusted timeline
- If no specific date was proposed, ask what timeline would work for them
- Keep it constructive and aim to reach agreement`,

  [MessageIntent.REQUEST_MORE_INFO]: `The user needs more information about the task. Generate an informative response using the task data provided, then guide toward a decision.
Include:
- IMPORTANT: Review the TASK DETAILS section and share relevant information from it
- Include key details like: task name, description, due date, who created it, current assignee, project, custom fields
- If they asked about something specific, focus on that
- If certain information isn't available, say so clearly
- After sharing the info, ask if this helps them decide or if they have more questions`,

  [MessageIntent.GENERAL_QUESTION]: `The user has a general question. Generate a helpful response.
Include:
- Answer the question clearly
- Offer additional help if relevant
- Keep it conversational`,

  [MessageIntent.LIST_TASKS]: `The user wants to see their tasks. Generate a response introducing the task list.
Include:
- Acknowledge their request
- Present the task information clearly
- Offer to help with any specific task`,

  [MessageIntent.GREETING]: `The user greeted you. Generate a friendly greeting response.
Include:
- Return the greeting warmly
- Briefly mention what you can help with
- Keep it concise and welcoming`,

  [MessageIntent.UNKNOWN]: `The intent wasn't clear. Generate a helpful clarification response.
Include:
- Acknowledge their message
- Gently ask for clarification
- Offer examples of what you can help with
- Keep it friendly and helpful`,
};

/**
 * Build the response generation prompt
 */
export function buildResponseGenerationPrompt(
  intent: MessageIntent,
  userMessage: string,
  taskData?: string,
  additionalContext?: string
): string {
  const basePrompt = RESPONSE_GENERATION_PROMPTS[intent];

  let prompt = `${basePrompt}\n\n`;

  // Put task data first so LLM has context before seeing the question
  if (taskData) {
    prompt += `${taskData}\n`;
  }

  if (additionalContext) {
    prompt += `Additional context: ${additionalContext}\n\n`;
  }

  // User's question comes after the context so LLM knows what to answer
  prompt += `USER'S QUESTION: "${userMessage}"\n\n`;

  prompt += `Generate a natural, conversational response that directly answers the user's question above. Be warm but professional. Keep it concise (1-3 sentences max). Do not use emojis unless the user did. Use the task details provided to answer their question.`;

  return prompt;
}

/**
 * JSON schema for intent classification output
 */
export const INTENT_CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: Object.values(MessageIntent),
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    extractedData: {
      type: 'object',
    },
    reasoning: {
      type: 'string',
    },
  },
  required: ['intent', 'confidence', 'extractedData'],
};
