import { TFile } from 'obsidian';

/**
 * Bullet Journal Signifiers
 * Based on the Bullet Journal methodology by Ryder Carroll
 */
export enum BujoSignifier {
  TASK = 'task',           // • (bullet) - Task
  TASK_COMPLETE = 'x',     // × - Completed task
  TASK_MIGRATED = '>',     // > - Migrated task (moved to future log/collection)
  TASK_SCHEDULED = '<',    // < - Scheduled task (moved to calendar)
  TASK_CANCELLED = '-',    // - Cancelled/irrelevant task
  EVENT = 'o',             // ○ - Event (open circle)
  EVENT_DONE = 'O',        // ● - Done/occurred event (filled circle)
  EVENT_CANCELLED = 'oc',  // Event cancelled
  NOTE = 'note',           // - (dash) - Note
  PRIORITY = '*',          // * - Priority marker
  INSPIRATION = '!',       // ! - Inspiration/idea
}

/**
 * Priority levels for tasks
 */
export enum Priority {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
}

/**
 * Represents a single bullet journal item
 */
export interface BujoItem {
  /** Unique identifier */
  id: string;
  /** The signifier/type of the item */
  signifier: BujoSignifier;
  /** The text content of the item */
  content: string;
  /** Priority level */
  priority: Priority;
  /** Tags associated with this item */
  tags: string[];
  /** Due date (if any) */
  dueDate: Date | null;
  /** Scheduled date (if any) */
  scheduledDate: Date | null;
  /** Creation date */
  createdDate: Date | null;
  /** Completion date (if completed) */
  completedDate: Date | null;
  /** The source file */
  file: TFile;
  /** Line number in the source file */
  line: number;
  /** Original markdown text */
  originalText: string;
  /** Indentation level */
  indentation: number;
  /** Recurrence rule (if any) */
  recurrence: string | null;
  /** Start time for events (HH:MM format) */
  startTime: string | null;
  /** End time for events (HH:MM format) */
  endTime: string | null;
  /** Location for events */
  location: string | null;
}

/**
 * Plugin settings interface
 */
export interface BojoSettings {
  /** Folders to scan for todos */
  sourceFolders: string[];
  /** Files to scan for todos (specific files) */
  sourceFiles: string[];
  /** Whether to include subfolders */
  includeSubfolders: boolean;
  /** Date format for display */
  dateFormat: string;
  /** Default view sort order */
  sortOrder: SortOrder;
  /** Group by option */
  groupBy: GroupBy;
  /** Show completed tasks */
  showCompleted: boolean;
  /** Show cancelled tasks */
  showCancelled: boolean;
  /** Show events */
  showEvents: boolean;
  /** Auto-refresh interval in seconds (0 = disabled) */
  autoRefreshInterval: number;
  /** Custom task markers */
  taskMarkers: TaskMarkers;
}

/**
 * Custom task markers configuration
 */
export interface TaskMarkers {
  task: string;
  complete: string;
  migrated: string;
  scheduled: string;
  cancelled: string;
  event: string;
  eventDone: string;
  eventCancelled: string;
}

/**
 * Sort order options
 */
export enum SortOrder {
  DUE_DATE = 'dueDate',
  PRIORITY = 'priority',
  CREATED_DATE = 'createdDate',
  FILE_NAME = 'fileName',
  STATUS = 'status',
}

/**
 * Group by options
 */
export enum GroupBy {
  NONE = 'none',
  FILE = 'file',
  FOLDER = 'folder',
  STATUS = 'status',
  DUE_DATE = 'dueDate',
  PRIORITY = 'priority',
  TAG = 'tag',
}

/**
 * Filter criteria for displaying todos
 */
export interface FilterCriteria {
  signifiers: BujoSignifier[];
  tags: string[];
  priorities: Priority[];
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
  searchText: string;
  files: string[];
  folders: string[];
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: BojoSettings = {
  sourceFolders: [],
  sourceFiles: [],
  includeSubfolders: true,
  dateFormat: 'YYYY-MM-DD',
  sortOrder: SortOrder.DUE_DATE,
  groupBy: GroupBy.FILE,
  showCompleted: false,
  showCancelled: false,
  showEvents: true,
  autoRefreshInterval: 0,
  taskMarkers: {
    task: '[ ]',
    complete: '[x]',
    migrated: '[>]',
    scheduled: '[<]',
    cancelled: '[-]',
    event: '[o]',
    eventDone: '[O]',
    eventCancelled: '[~]',
  },
};
