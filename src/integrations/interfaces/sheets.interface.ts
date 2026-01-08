/**
 * Abstract interface for spreadsheet systems (Google Sheets, Excel, etc.)
 * Allows for future extensibility to other spreadsheet platforms
 */

import { GSheetTaskRow } from '../../models';

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
   * Verify sheet access
   */
  verifyAccess(sheetUrl: string): Promise<boolean>;
}
