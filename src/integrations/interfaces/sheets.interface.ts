/**
 * Abstract interface for spreadsheet systems (Google Sheets, Excel, etc.)
 * Allows for future extensibility to other spreadsheet platforms
 */

import { GSheetTaskRow, GSheetUserMappingRow } from '../../models';

export interface ISheetsClient {
  /**
   * Get task assignment row by task name
   */
  getTaskAssignment(sheetUrl: string, taskName: string): Promise<GSheetTaskRow | null>;

  /**
   * Get all task assignments from the sheet
   */
  getAllTaskAssignments(sheetUrl: string): Promise<GSheetTaskRow[]>;

  /**
   * Get user mapping by Slack user ID
   */
  getUserMapping(sheetUrl: string, slackUserId: string): Promise<GSheetUserMappingRow | null>;

  /**
   * Get all user mappings
   */
  getAllUserMappings(sheetUrl: string): Promise<GSheetUserMappingRow[]>;

  /**
   * Verify sheet access
   */
  verifyAccess(sheetUrl: string): Promise<boolean>;
}
