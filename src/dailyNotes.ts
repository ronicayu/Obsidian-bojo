import { App, TFile, moment } from 'obsidian';

/**
 * Daily Notes plugin settings interface
 */
export interface DailyNotesSettings {
  folder: string;
  format: string;
  template: string;
}

/**
 * Get the daily notes settings from Obsidian's core plugin
 * Tries multiple access patterns for compatibility across Obsidian versions
 */
export function getDailyNotesSettings(app: App): DailyNotesSettings | null {
  const internalPlugins = (app as any).internalPlugins;
  
  // Try different ways to access the daily-notes plugin
  let dailyNotesPlugin = internalPlugins?.plugins?.['daily-notes'];
  
  // Alternative access via getPluginById (some Obsidian versions)
  if (!dailyNotesPlugin && internalPlugins?.getPluginById) {
    dailyNotesPlugin = internalPlugins.getPluginById('daily-notes');
  }
  
  if (!dailyNotesPlugin?.enabled) {
    return null;
  }

  // Settings can be in different locations depending on Obsidian version
  const instance = dailyNotesPlugin.instance;
  const settings = instance?.options || instance?.settings || instance;
  
  return {
    folder: settings?.folder ?? '',
    format: settings?.format ?? 'YYYY-MM-DD',
    template: settings?.template ?? '',
  };
}

/**
 * Format a date according to a Moment.js format string
 * Uses Obsidian's built-in moment for consistent formatting
 * See: https://momentjs.com/docs/#/displaying/format/
 */
export function formatDate(date: Date, format: string): string {
  return moment(date).format(format);
}

/**
 * Get the expected file path for a daily note on a given date
 */
export function getDailyNotePath(app: App, date: Date): string | null {
  const settings = getDailyNotesSettings(app);
  
  if (!settings) {
    return null;
  }

  const fileName = formatDate(date, settings.format);
  // Normalize folder path: remove leading/trailing slashes, then add trailing slash if non-empty
  const normalizedFolder = settings.folder.replace(/^\/+|\/+$/g, '');
  const folder = normalizedFolder ? normalizedFolder + '/' : '';
  
  return `${folder}${fileName}.md`;
}

/**
 * Get the daily note file for a given date
 */
export function getDailyNoteFile(app: App, date: Date): TFile | null {
  const path = getDailyNotePath(app, date);
  
  if (!path) {
    return null;
  }

  const file = app.vault.getAbstractFileByPath(path);
  
  return file instanceof TFile ? file : null;
}

/**
 * Get today's daily note file
 */
export function getTodaysDailyNote(app: App): TFile | null {
  return getDailyNoteFile(app, new Date());
}

/**
 * Check if the daily notes plugin is enabled
 */
export function isDailyNotesEnabled(app: App): boolean {
  const dailyNotesPlugin = (app as any).internalPlugins?.plugins?.['daily-notes'];
  return dailyNotesPlugin?.enabled ?? false;
}

/**
 * Parse a date from a daily note filename based on the format
 * Uses Obsidian's built-in moment for consistent parsing
 * Returns null if the filename doesn't match the format
 * See: https://momentjs.com/docs/#/parsing/string-format/
 */
export function parseDateFromFilename(filename: string, format: string): Date | null {
  // Remove .md extension if present
  const name = filename.replace(/\.md$/, '');
  
  // Use moment's strict parsing mode to ensure exact format match
  const parsed = moment(name, format, true);
  
  if (!parsed.isValid()) {
    return null;
  }
  
  return parsed.toDate();
}

/**
 * Create or get a daily note for the given date
 * If the note doesn't exist, creates it using the template if configured
 * Returns the file
 */
export async function getOrCreateDailyNote(app: App, date: Date): Promise<TFile | null> {
  const settings = getDailyNotesSettings(app);
  
  if (!settings) {
    return null;
  }
  
  // Check if the note already exists
  const existingFile = getDailyNoteFile(app, date);
  if (existingFile) {
    return existingFile;
  }
  
  // Need to create the note
  const path = getDailyNotePath(app, date);
  if (!path) {
    return null;
  }
  
  // Ensure the folder exists
  const folderPath = path.substring(0, path.lastIndexOf('/'));
  if (folderPath) {
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await app.vault.createFolder(folderPath);
    }
  }
  
  // Get template content if configured
  let content = '';
  if (settings.template) {
    const templatePath = settings.template.endsWith('.md') 
      ? settings.template 
      : settings.template + '.md';
    const templateFile = app.vault.getAbstractFileByPath(templatePath);
    if (templateFile instanceof TFile) {
      content = await app.vault.read(templateFile);
      // Replace template variables
      content = content
        .replace(/{{date}}/g, formatDate(date, settings.format))
        .replace(/{{title}}/g, formatDate(date, settings.format))
        .replace(/{{time}}/g, moment(date).format('HH:mm'));
    }
  }
  
  // Create the file
  const file = await app.vault.create(path, content);
  return file;
}
