import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ISheetsClient } from '../interfaces/sheets.interface';
import { GSheetTaskRow, GSheetUserMappingRow } from '../../models';

export class GoogleSheetsClient implements ISheetsClient {
  private sheets: Map<string, GoogleSpreadsheet> = new Map();

  private async getSheet(sheetUrl: string, forceRefresh = false): Promise<GoogleSpreadsheet> {
    if (forceRefresh) {
      this.sheets.delete(sheetUrl);
    }

    if (this.sheets.has(sheetUrl)) {
      return this.sheets.get(sheetUrl)!;
    }

    try {
      // Extract sheet ID from URL
      const sheetId = this.extractSheetId(sheetUrl);

      // Create JWT auth
      const serviceAccountAuth = new JWT({
        email: config.sheets.serviceAccountEmail,
        key: config.sheets.privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      // Create and load sheet
      const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
      await doc.loadInfo();

      this.sheets.set(sheetUrl, doc);
      return doc;
    } catch (error) {
      logger.error('Failed to load Google Sheet', { error, sheetUrl });
      throw error;
    }
  }

  private extractSheetId(url: string): string {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error(`Invalid Google Sheets URL: ${url}`);
    }
    return match[1];
  }

  async getTaskAssignment(sheetUrl: string, taskName: string): Promise<GSheetTaskRow | null> {
    try {
      // Always refresh sheet data for task lookups to avoid stale cache
      const doc = await this.getSheet(sheetUrl, true);

      // Look for "Ticket Queue" tab first, then fall back to first sheet
      const sheet = doc.sheetsByTitle['Ticket Queue'] || doc.sheetsByIndex[0];

      logger.debug('Looking up task in sheet', {
        sheetTitle: sheet.title,
        availableTabs: Object.keys(doc.sheetsByTitle),
      });

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows();

      logger.debug('Sheet headers and row count', {
        headers: sheet.headerValues,
        rowCount: rows.length,
      });

      // Normalize task name for comparison (trim and lowercase)
      const normalizedTaskName = taskName.trim().toLowerCase();

      // Log all task names in sheet for debugging
      const allTaskNames = rows.map(row => row.get('Task Name') || row.get('task_name') || row.get('taskName')).filter(Boolean);
      logger.debug('Task names in sheet', { searchingFor: taskName, normalizedSearch: normalizedTaskName, taskNamesInSheet: allTaskNames });

      for (const row of rows) {
        const rowTaskName = row.get('Task Name') || row.get('task_name') || row.get('taskName');

        if (rowTaskName && rowTaskName.trim().toLowerCase() === normalizedTaskName) {
          const assignee = row.get('Recommended Developer') || row.get('recommended_developer') || row.get('Assignee') || row.get('assignee');

          if (!assignee || assignee === 'No developers available' || assignee === 'No Match') {
            logger.warn('Task found but no valid assignee specified', { taskName, assignee });
            return null;
          }

          const result: GSheetTaskRow = {
            taskName: rowTaskName,
            assignee,
          };

          // Add any additional columns dynamically
          const headers = sheet.headerValues;
          headers.forEach((header) => {
            if (header !== 'Task Name' && header !== 'Recommended Developer') {
              result[header] = row.get(header) || '';
            }
          });

          return result;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get task assignment from sheet', { error, sheetUrl, taskName });
      throw error;
    }
  }

  async getAllTaskAssignments(sheetUrl: string): Promise<GSheetTaskRow[]> {
    try {
      const doc = await this.getSheet(sheetUrl);

      // Look for "Ticket Queue" tab first, then fall back to first sheet
      const sheet = doc.sheetsByTitle['Ticket Queue'] || doc.sheetsByIndex[0];

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows();
      const results: GSheetTaskRow[] = [];

      for (const row of rows) {
        const taskName = row.get('Task Name') || row.get('task_name') || row.get('taskName');
        const assignee = row.get('Recommended Developer') || row.get('recommended_developer') || row.get('Assignee') || row.get('assignee');

        if (taskName && assignee && assignee !== 'No developers available' && assignee !== 'No Match') {
          const result: GSheetTaskRow = { taskName, assignee };

          const headers = sheet.headerValues;
          headers.forEach((header) => {
            if (header !== 'Task Name' && header !== 'Recommended Developer') {
              result[header] = row.get(header) || '';
            }
          });

          results.push(result);
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to get all task assignments', { error, sheetUrl });
      throw error;
    }
  }

  async getUserMapping(sheetUrl: string, slackUserId: string): Promise<GSheetUserMappingRow | null> {
    try {
      const doc = await this.getSheet(sheetUrl);

      // Look for "User Mapping" or similar sheet
      const mappingSheet = doc.sheetsByTitle['User Mapping'] ||
                          doc.sheetsByTitle['User Mappings'] ||
                          doc.sheetsByTitle['user_mapping'];

      if (!mappingSheet) {
        logger.warn('No user mapping sheet found', { sheetUrl });
        return null;
      }

      await mappingSheet.loadHeaderRow();
      const rows = await mappingSheet.getRows();

      for (const row of rows) {
        const slackId = row.get('Slack User ID') || row.get('slackUserId') || row.get('slack_user_id');

        if (slackId && slackId.trim() === slackUserId.trim()) {
          const asanaId = row.get('Asana User ID') || row.get('asanaUserId') || row.get('asana_user_id');

          if (!asanaId) {
            continue;
          }

          return {
            slackUserId: slackId,
            asanaUserId: asanaId,
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user mapping', { error, sheetUrl, slackUserId });
      throw error;
    }
  }

  async getAllUserMappings(sheetUrl: string): Promise<GSheetUserMappingRow[]> {
    try {
      const doc = await this.getSheet(sheetUrl);

      const mappingSheet = doc.sheetsByTitle['User Mapping'] ||
                          doc.sheetsByTitle['User Mappings'] ||
                          doc.sheetsByTitle['user_mapping'];

      if (!mappingSheet) {
        return [];
      }

      await mappingSheet.loadHeaderRow();
      const rows = await mappingSheet.getRows();
      const results: GSheetUserMappingRow[] = [];

      for (const row of rows) {
        const slackId = row.get('Slack User ID') || row.get('slackUserId') || row.get('slack_user_id');
        const asanaId = row.get('Asana User ID') || row.get('asanaUserId') || row.get('asana_user_id');

        if (slackId && asanaId) {
          results.push({
            slackUserId: slackId,
            asanaUserId: asanaId,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to get all user mappings', { error, sheetUrl });
      throw error;
    }
  }

  async verifyAccess(sheetUrl: string): Promise<boolean> {
    try {
      await this.getSheet(sheetUrl);
      return true;
    } catch (error) {
      logger.error('Failed to verify sheet access', { error, sheetUrl });
      return false;
    }
  }
}
