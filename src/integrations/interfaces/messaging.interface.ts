/**
 * Abstract interface for messaging systems (Slack, Teams, etc.)
 * Allows for future extensibility to other messaging platforms
 */

export interface MessagingUser {
  id: string;
  name: string;
  email?: string;
}

export interface MessagingMessage {
  text: string;
  blocks?: unknown[];
  threadTs?: string;
}

export interface MessagingEvent {
  userId: string;
  channelId: string;
  text: string;
  threadTs?: string;
  messageTs?: string;
}

export interface IMessagingClient {
  /**
   * Send a direct message to a user
   */
  sendDirectMessage(userId: string, message: MessagingMessage): Promise<string>;

  /**
   * Send a message to a channel
   */
  sendChannelMessage(channelId: string, message: MessagingMessage): Promise<string>;

  /**
   * Get user information by ID
   */
  getUserById(userId: string): Promise<MessagingUser | null>;

  /**
   * Get user by display name
   */
  getUserByName(name: string): Promise<MessagingUser | null>;

  /**
   * Listen for messages and user interactions
   */
  onMessage(handler: (event: unknown) => Promise<void>): void;

  /**
   * Start the messaging client
   */
  start(): Promise<void>;

  /**
   * Stop the messaging client
   */
  stop(): Promise<void>;
}
