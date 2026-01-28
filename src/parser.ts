import { TFile, Vault, MetadataCache } from 'obsidian';
import { BujoItem, BujoSignifier, Priority, BojoSettings } from './types';

/**
 * Parser for extracting bullet journal items from markdown files
 */
export class BujoParser {
  private vault: Vault;
  private metadataCache: MetadataCache;
  private settings: BojoSettings;

  constructor(vault: Vault, metadataCache: MetadataCache, settings: BojoSettings) {
    this.vault = vault;
    this.metadataCache = metadataCache;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: BojoSettings): void {
    this.settings = settings;
  }

  /**
   * Parse all files in the configured source folders and files
   */
  async parseAll(): Promise<BujoItem[]> {
    const items: BujoItem[] = [];
    const filesToParse = await this.getFilesToParse();

    for (const file of filesToParse) {
      const fileItems = await this.parseFile(file);
      items.push(...fileItems);
    }

    return items;
  }

  /**
   * Get all files that should be parsed based on settings
   */
  private async getFilesToParse(): Promise<TFile[]> {
    const files: TFile[] = [];
    const allFiles = this.vault.getMarkdownFiles();

    // If no source folders or files are configured, scan all markdown files
    if (this.settings.sourceFolders.length === 0 && this.settings.sourceFiles.length === 0) {
      return allFiles;
    }

    // Add files from source folders
    for (const folder of this.settings.sourceFolders) {
      for (const file of allFiles) {
        if (this.settings.includeSubfolders) {
          if (file.path.startsWith(folder + '/') || file.path.startsWith(folder)) {
            if (!files.includes(file)) {
              files.push(file);
            }
          }
        } else {
          const fileFolder = file.parent?.path || '';
          if (fileFolder === folder || (folder === '/' && fileFolder === '')) {
            if (!files.includes(file)) {
              files.push(file);
            }
          }
        }
      }
    }

    // Add specific source files
    for (const filePath of this.settings.sourceFiles) {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile && !files.includes(file)) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Parse a single file for bullet journal items
   */
  async parseFile(file: TFile): Promise<BujoItem[]> {
    const items: BujoItem[] = [];
    const content = await this.vault.cachedRead(file);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const item = this.parseLine(line, file, i);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Parse a single line for a bullet journal item
   */
  parseLine(line: string, file: TFile, lineNumber: number): BujoItem | null {
    // Match checkbox patterns: - [X], * [X] where X is any single character
    // This allows custom markers to be recognized
    const checkboxRegex = /^(\s*)[-*]\s+\[(.)\]\s*(.*)$/;
    const match = line.match(checkboxRegex);

    if (!match) {
      return null;
    }

    const [, indent, marker, text] = match;
    const signifier = this.markerToSignifier(marker);
    const { content, tags, dueDate, scheduledDate, priority, recurrence, createdDate, startTime, endTime, location } = this.parseContent(text, signifier);

    // Set completedDate for completed tasks and done events
    const isCompleted = signifier === BujoSignifier.TASK_COMPLETE || signifier === BujoSignifier.EVENT_DONE;

    return {
      id: `${file.path}:${lineNumber}`,
      signifier,
      content,
      priority,
      tags,
      dueDate,
      scheduledDate,
      createdDate,
      completedDate: isCompleted ? new Date() : null,
      file,
      line: lineNumber,
      originalText: line,
      indentation: indent.length,
      recurrence,
      startTime,
      endTime,
      location,
    };
  }

  /**
   * Extract the marker character from a task marker setting (e.g., "[x]" -> "x")
   */
  private extractMarkerChar(markerSetting: string): string {
    const match = markerSetting.match(/\[(.)\]/);
    return match ? match[1] : '';
  }

  /**
   * Convert marker character to signifier, respecting custom markers from settings
   */
  private markerToSignifier(marker: string): BujoSignifier {
    const markers = this.settings.taskMarkers;

    // Check custom markers from settings first (exact match)
    if (marker === this.extractMarkerChar(markers.complete)) {
      return BujoSignifier.TASK_COMPLETE;
    }
    if (marker === this.extractMarkerChar(markers.migrated)) {
      return BujoSignifier.TASK_MIGRATED;
    }
    if (marker === this.extractMarkerChar(markers.scheduled)) {
      return BujoSignifier.TASK_SCHEDULED;
    }
    if (marker === this.extractMarkerChar(markers.cancelled)) {
      return BujoSignifier.TASK_CANCELLED;
    }
    if (marker === this.extractMarkerChar(markers.event)) {
      return BujoSignifier.EVENT;
    }
    if (marker === this.extractMarkerChar(markers.eventDone)) {
      return BujoSignifier.EVENT_DONE;
    }
    if (marker === this.extractMarkerChar(markers.eventCancelled)) {
      return BujoSignifier.EVENT_CANCELLED;
    }
    if (marker === this.extractMarkerChar(markers.task) || marker === ' ') {
      return BujoSignifier.TASK;
    }

    // Fallback to default mappings for backwards compatibility
    // (handles cases where marker doesn't match any custom setting)
    switch (marker) {
      case 'o':
        return BujoSignifier.EVENT;
      case 'O':
        return BujoSignifier.EVENT_DONE;
      case '~':
        return BujoSignifier.EVENT_CANCELLED;
    }

    const lowerMarker = marker.toLowerCase();
    switch (lowerMarker) {
      case 'x':
        return BujoSignifier.TASK_COMPLETE;
      case '>':
        return BujoSignifier.TASK_MIGRATED;
      case '<':
        return BujoSignifier.TASK_SCHEDULED;
      case '-':
        return BujoSignifier.TASK_CANCELLED;
      case '!':
        return BujoSignifier.INSPIRATION;
      default:
        return BujoSignifier.TASK;
    }
  }

  /**
   * Parse the content of a todo item for metadata
   */
  private parseContent(text: string, signifier?: BujoSignifier): {
    content: string;
    tags: string[];
    dueDate: Date | null;
    scheduledDate: Date | null;
    priority: Priority;
    recurrence: string | null;
    createdDate: Date | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
  } {
    let content = text;
    const tags: string[] = [];
    let dueDate: Date | null = null;
    let scheduledDate: Date | null = null;
    let priority = Priority.NONE;
    let recurrence: string | null = null;
    let createdDate: Date | null = null;
    let startTime: string | null = null;
    let endTime: string | null = null;
    let location: string | null = null;

    // Extract tags (#tag)
    const tagRegex = /#([a-zA-Z0-9_-]+)/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(text)) !== null) {
      tags.push(tagMatch[1]);
    }

    // Extract due date (📅 YYYY-MM-DD or due:YYYY-MM-DD)
    const dueDateRegex = /(?:📅|due:|🗓️)\s*(\d{4}-\d{2}-\d{2})/;
    const dueDateMatch = text.match(dueDateRegex);
    if (dueDateMatch) {
      dueDate = new Date(dueDateMatch[1]);
      content = content.replace(dueDateRegex, '').trim();
    }

    // Extract scheduled date (⏳ YYYY-MM-DD or scheduled:YYYY-MM-DD)
    const scheduledRegex = /(?:⏳|scheduled:)\s*(\d{4}-\d{2}-\d{2})/;
    const scheduledMatch = text.match(scheduledRegex);
    if (scheduledMatch) {
      scheduledDate = new Date(scheduledMatch[1]);
      content = content.replace(scheduledRegex, '').trim();
    }

    // Extract created date (➕ YYYY-MM-DD or created:YYYY-MM-DD)
    const createdRegex = /(?:➕|created:)\s*(\d{4}-\d{2}-\d{2})/;
    const createdMatch = text.match(createdRegex);
    if (createdMatch) {
      createdDate = new Date(createdMatch[1]);
      content = content.replace(createdRegex, '').trim();
    }

    // Extract time range first (HH:MM-HH:MM or HH:MM - HH:MM)
    // This must be checked before individual start/end times to avoid partial matches
    const timeRangeRegex = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/;
    const timeRangeMatch = text.match(timeRangeRegex);
    if (timeRangeMatch) {
      startTime = timeRangeMatch[1];
      endTime = timeRangeMatch[2];
      content = content.replace(timeRangeRegex, '').trim();
    }

    // Extract start time (🕐 HH:MM or time:HH:MM or @HH:MM)
    if (!startTime) {
      const startTimeRegex = /(?:🕐|🕑|🕒|🕓|🕔|🕕|🕖|🕗|🕘|🕙|🕚|🕛|time:|@)\s*(\d{1,2}:\d{2})/;
      const startTimeMatch = text.match(startTimeRegex);
      if (startTimeMatch) {
        startTime = startTimeMatch[1];
        content = content.replace(startTimeRegex, '').trim();
      }
    }

    // Extract end time (➡️ HH:MM or end:HH:MM or to:HH:MM)
    if (!endTime) {
      const endTimeRegex = /(?:➡️|end:|to:)\s*(\d{1,2}:\d{2})(?!\d)/;
      const endTimeMatch = text.match(endTimeRegex);
      if (endTimeMatch) {
        endTime = endTimeMatch[1];
        content = content.replace(endTimeRegex, '').trim();
      }
    }

    // Extract location (📍 location or location:xxx or @location after time)
    const locationRegex = /(?:📍|location:)\s*([^#📅⏳➕⏫🔼🔽🔁🕐]+?)(?=\s+[#📅⏳➕⏫🔼🔽🔁]|$)/;
    const locationMatch = text.match(locationRegex);
    if (locationMatch) {
      location = locationMatch[1].trim();
      content = content.replace(locationRegex, '').trim();
    }

    // Extract priority (⏫ high, 🔼 medium, 🔽 low, or priority:high/medium/low)
    if (text.includes('⏫') || /priority:\s*high/i.test(text)) {
      priority = Priority.HIGH;
      content = content.replace(/⏫|priority:\s*high/gi, '').trim();
    } else if (text.includes('🔼') || /priority:\s*medium/i.test(text)) {
      priority = Priority.MEDIUM;
      content = content.replace(/🔼|priority:\s*medium/gi, '').trim();
    } else if (text.includes('🔽') || /priority:\s*low/i.test(text)) {
      priority = Priority.LOW;
      content = content.replace(/🔽|priority:\s*low/gi, '').trim();
    }

    // Extract recurrence (🔁 every day/week/month or recur:daily/weekly/monthly)
    const recurrenceRegex = /(?:🔁|recur:)\s*([a-zA-Z0-9\s]+?)(?=\s+[#📅⏳➕⏫🔼🔽]|$)/;
    const recurrenceMatch = text.match(recurrenceRegex);
    if (recurrenceMatch) {
      recurrence = recurrenceMatch[1].trim();
      content = content.replace(recurrenceRegex, '').trim();
    }

    // Clean up content - remove extra spaces
    content = content.replace(/\s+/g, ' ').trim();

    return { content, tags, dueDate, scheduledDate, priority, recurrence, createdDate, startTime, endTime, location };
  }

  /**
   * Get the markdown representation for a signifier
   */
  getSignifierMarker(signifier: BujoSignifier): string {
    switch (signifier) {
      case BujoSignifier.TASK_COMPLETE:
        return this.settings.taskMarkers.complete;
      case BujoSignifier.TASK_MIGRATED:
        return this.settings.taskMarkers.migrated;
      case BujoSignifier.TASK_SCHEDULED:
        return this.settings.taskMarkers.scheduled;
      case BujoSignifier.TASK_CANCELLED:
        return this.settings.taskMarkers.cancelled;
      case BujoSignifier.EVENT:
        return this.settings.taskMarkers.event;
      case BujoSignifier.EVENT_DONE:
        return this.settings.taskMarkers.eventDone;
      case BujoSignifier.EVENT_CANCELLED:
        return this.settings.taskMarkers.eventCancelled;
      case BujoSignifier.TASK:
      default:
        return this.settings.taskMarkers.task;
    }
  }

  /**
   * Convert a BujoItem back to markdown text
   */
  itemToMarkdown(item: BujoItem): string {
    const indent = ' '.repeat(item.indentation);
    const marker = this.getSignifierMarker(item.signifier);
    let content = item.content;

    // Add time for events
    if (item.startTime) {
      if (item.endTime) {
        content += ` ${item.startTime}-${item.endTime}`;
      } else {
        content += ` 🕐 ${item.startTime}`;
      }
    }

    // Add location for events
    if (item.location) {
      content += ` 📍 ${item.location}`;
    }

    // Add metadata back
    if (item.priority === Priority.HIGH) {
      content += ' ⏫';
    } else if (item.priority === Priority.MEDIUM) {
      content += ' 🔼';
    } else if (item.priority === Priority.LOW) {
      content += ' 🔽';
    }

    if (item.dueDate) {
      content += ` 📅 ${this.formatDate(item.dueDate)}`;
    }

    if (item.scheduledDate) {
      content += ` ⏳ ${this.formatDate(item.scheduledDate)}`;
    }

    if (item.createdDate) {
      content += ` ➕ ${this.formatDate(item.createdDate)}`;
    }

    if (item.recurrence) {
      content += ` 🔁 ${item.recurrence}`;
    }

    // Add tags
    for (const tag of item.tags) {
      if (!content.includes(`#${tag}`)) {
        content += ` #${tag}`;
      }
    }

    return `${indent}- ${marker} ${content}`;
  }

  /**
   * Format a date according to settings
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
