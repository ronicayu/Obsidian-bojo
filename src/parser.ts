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
    // Match checkbox patterns: - [ ], - [x], - [>], - [<], - [-], * [ ], etc.
    const checkboxRegex = /^(\s*)[-*]\s+\[([ x><!-])\]\s*(.*)$/i;
    const match = line.match(checkboxRegex);

    if (!match) {
      return null;
    }

    const [, indent, marker, text] = match;
    const signifier = this.markerToSignifier(marker);
    const { content, tags, dueDate, scheduledDate, priority, recurrence, createdDate } = this.parseContent(text);

    return {
      id: `${file.path}:${lineNumber}`,
      signifier,
      content,
      priority,
      tags,
      dueDate,
      scheduledDate,
      createdDate,
      completedDate: signifier === BujoSignifier.TASK_COMPLETE ? new Date() : null,
      file,
      line: lineNumber,
      originalText: line,
      indentation: indent.length,
      recurrence,
    };
  }

  /**
   * Convert marker character to signifier
   */
  private markerToSignifier(marker: string): BujoSignifier {
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
      case ' ':
      default:
        return BujoSignifier.TASK;
    }
  }

  /**
   * Parse the content of a todo item for metadata
   */
  private parseContent(text: string): {
    content: string;
    tags: string[];
    dueDate: Date | null;
    scheduledDate: Date | null;
    priority: Priority;
    recurrence: string | null;
    createdDate: Date | null;
  } {
    let content = text;
    const tags: string[] = [];
    let dueDate: Date | null = null;
    let scheduledDate: Date | null = null;
    let priority = Priority.NONE;
    let recurrence: string | null = null;
    let createdDate: Date | null = null;

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

    return { content, tags, dueDate, scheduledDate, priority, recurrence, createdDate };
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
