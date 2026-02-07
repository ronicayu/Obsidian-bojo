import {
  App,
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
  MarkdownView,
  Editor,
  Notice,
  Modal,
  Setting,
} from 'obsidian';
import { BojoSettings, DEFAULT_SETTINGS, BujoSignifier } from './types';
import { BujoParser } from './parser';
import { BojoSettingTab } from './settings';
import { BojoView, BOJO_VIEW_TYPE } from './view';
import { getOrCreateDailyNote, isDailyNotesEnabled } from './dailyNotes';

/**
 * Bullet Journal Todo Plugin for Obsidian
 *
 * This plugin helps organize todos using the Bullet Journal methodology.
 * It consolidates tasks from specified files and folders, and provides
 * typical bullet journal actions like migrate, schedule, complete, and cancel.
 */
export default class BojoPlugin extends Plugin {
  settings: BojoSettings;
  parser: BujoParser;

  async onload(): Promise<void> {
    console.log('Loading Bullet Journal Todo plugin');

    // Load settings
    await this.loadSettings();

    // Initialize parser
    this.parser = new BujoParser(this.app.vault, this.app.metadataCache, this.settings);

    // Register view
    this.registerView(BOJO_VIEW_TYPE, (leaf) => new BojoView(leaf, this));

    // Add ribbon icon
    this.addRibbonIcon('checkbox-glyph', 'Open Bullet Journal Todos', () => {
      this.activateView();
    });

    // Add commands
    this.addCommands();

    // Add settings tab
    this.addSettingTab(new BojoSettingTab(this.app, this));

    // Register event handlers
    this.registerEventHandlers();
  }

  onunload(): void {
    console.log('Unloading Bullet Journal Todo plugin');
  }

  /**
   * Load plugin settings
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Save plugin settings
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.parser?.updateSettings(this.settings);

    // Refresh any open views
    this.app.workspace.getLeavesOfType(BOJO_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view as BojoView;
      view.refresh();
    });
  }

  /**
   * Activate the Bojo view
   */
  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(BOJO_VIEW_TYPE);

    if (leaves.length > 0) {
      // View already exists, reveal it
      leaf = leaves[0];
    } else {
      // Create new leaf in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: BOJO_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * Add plugin commands
   */
  private addCommands(): void {
    // Open todo view
    this.addCommand({
      id: 'open-bojo-view',
      name: 'Open Bullet Journal Todo View',
      callback: () => this.activateView(),
    });

    // Toggle task complete
    this.addCommand({
      id: 'toggle-task-complete',
      name: 'Toggle Task Complete',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.toggleTaskAtCursor(editor, BujoSignifier.TASK_COMPLETE);
      },
    });

    // Migrate task
    this.addCommand({
      id: 'migrate-task',
      name: 'Migrate Task (>)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.toggleTaskAtCursor(editor, BujoSignifier.TASK_MIGRATED);
      },
    });

    // Schedule task
    this.addCommand({
      id: 'schedule-task',
      name: 'Schedule Task (<)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.scheduleTaskWithDatePicker(editor);
      },
    });

    // Cancel task
    this.addCommand({
      id: 'cancel-task',
      name: 'Cancel Task (-)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.toggleTaskAtCursor(editor, BujoSignifier.TASK_CANCELLED);
      },
    });

    // Add task with due date
    this.addCommand({
      id: 'add-task-due-today',
      name: 'Add Task Due Today',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.insertTask(editor, { dueToday: true });
      },
    });

    // Add task with high priority
    this.addCommand({
      id: 'add-task-high-priority',
      name: 'Add High Priority Task',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.insertTask(editor, { highPriority: true });
      },
    });

    // Convert to event
    this.addCommand({
      id: 'convert-to-event',
      name: 'Convert to Event (o)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.toggleTaskAtCursor(editor, BujoSignifier.EVENT);
      },
    });

    // Insert new event
    this.addCommand({
      id: 'insert-event',
      name: 'Insert Event',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.insertEvent(editor);
      },
    });

    // Insert event with time
    this.addCommand({
      id: 'insert-event-with-time',
      name: 'Insert Event with Time',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.insertEvent(editor, { withTime: true });
      },
    });

    // Mark event as done
    this.addCommand({
      id: 'mark-event-done',
      name: 'Mark Event as Done (O)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.toggleTaskAtCursor(editor, BujoSignifier.EVENT_DONE);
      },
    });

    // Cancel event
    this.addCommand({
      id: 'cancel-event',
      name: 'Cancel Event (~)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.toggleTaskAtCursor(editor, BujoSignifier.EVENT_CANCELLED);
      },
    });

    // Refresh view
    this.addCommand({
      id: 'refresh-bojo-view',
      name: 'Refresh Bullet Journal Todo View',
      callback: () => {
        this.app.workspace.getLeavesOfType(BOJO_VIEW_TYPE).forEach((leaf) => {
          const view = leaf.view as BojoView;
          view.refresh();
        });
        new Notice('Todo view refreshed');
      },
    });

    // Add current folder to sources
    this.addCommand({
      id: 'add-folder-to-sources',
      name: 'Add Current Folder to Todo Sources',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          if (!checking) {
            const folder = file.parent?.path || '/';
            if (!this.settings.sourceFolders.includes(folder)) {
              this.settings.sourceFolders.push(folder);
              this.saveSettings();
              new Notice(`Added "${folder}" to todo sources`);
            } else {
              new Notice(`"${folder}" is already in todo sources`);
            }
          }
          return true;
        }
        return false;
      },
    });

    // Add current file to sources
    this.addCommand({
      id: 'add-file-to-sources',
      name: 'Add Current File to Todo Sources',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          if (!checking) {
            if (!this.settings.sourceFiles.includes(file.path)) {
              this.settings.sourceFiles.push(file.path);
              this.saveSettings();
              new Notice(`Added "${file.path}" to todo sources`);
            } else {
              new Notice(`"${file.path}" is already in todo sources`);
            }
          }
          return true;
        }
        return false;
      },
    });
  }

  /**
   * Toggle task status at cursor position
   */
  private toggleTaskAtCursor(editor: Editor, targetSignifier: BujoSignifier): void {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    // Check if this is a task/event line (including ~ for cancelled events)
    const checkboxRegex = /^(\s*[-*]\s+\[)([ xX><!oO~-])(\].*)$/;
    const match = line.match(checkboxRegex);

    if (!match) {
      new Notice('No task or event found on current line');
      return;
    }

    const [, prefix, currentMarker, suffix] = match;
    let newMarker: string;

    // Determine new marker based on target signifier
    switch (targetSignifier) {
      case BujoSignifier.TASK_COMPLETE:
        newMarker = currentMarker.toLowerCase() === 'x' ? ' ' : 'x';
        break;
      case BujoSignifier.TASK_MIGRATED:
        newMarker = '>';
        break;
      case BujoSignifier.TASK_SCHEDULED:
        newMarker = '<';
        break;
      case BujoSignifier.TASK_CANCELLED:
        newMarker = '-';
        break;
      case BujoSignifier.EVENT:
        // Toggle between event and task (not event done)
        newMarker = currentMarker === 'o' ? ' ' : 'o';
        break;
      case BujoSignifier.EVENT_DONE:
        // Toggle between done and pending event
        newMarker = currentMarker === 'O' ? 'o' : 'O';
        break;
      case BujoSignifier.EVENT_CANCELLED:
        // Toggle between cancelled and pending event
        newMarker = currentMarker === '~' ? 'o' : '~';
        break;
      default:
        newMarker = ' ';
    }

    const newLine = `${prefix}${newMarker}${suffix}`;
    editor.setLine(cursor.line, newLine);
  }

  /**
   * Show date picker and schedule the task at cursor (set [<] and add scheduled date)
   */
  private scheduleTaskWithDatePicker(editor: Editor): void {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    const checkboxRegex = /^(\s*[-*]\s+\[)([ xX><!oO~-])(\].*)$/;
    const match = line.match(checkboxRegex);

    if (!match) {
      new Notice('No task or event found on current line');
      return;
    }

    const [, prefix, , suffix] = match;
    // Default to today; or existing scheduled date if present
    const scheduledRegex = /(?:⏳|scheduled:)\s*(\d{4}-\d{2}-\d{2})/;
    const scheduledMatch = suffix.match(scheduledRegex);
    let defaultDate = new Date();
    defaultDate.setHours(0, 0, 0, 0);
    if (scheduledMatch) {
      defaultDate = new Date(scheduledMatch[1]);
      defaultDate.setHours(0, 0, 0, 0);
    }

    const modal = new ScheduleDatePickerModal(this.app, defaultDate, async (date: Date) => {
      date.setHours(0, 0, 0, 0);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const suffixWithoutScheduled = suffix.replace(scheduledRegex, '').replace(/\s+/g, ' ').trim();
      const newSuffix = suffixWithoutScheduled ? `${suffixWithoutScheduled} ⏳ ${dateStr}` : `⏳ ${dateStr}`;
      const newLine = `${prefix}<] ${newSuffix}`;
      editor.setLine(cursor.line, newLine);

      // Create the date's daily note if missing and add an open task copy there
      if (isDailyNotesEnabled(this.app)) {
        const targetFile = await getOrCreateDailyNote(this.app, date);
        if (targetFile) {
          const openLine = `${prefix} ] ${newSuffix}`;
          const targetContent = await this.app.vault.read(targetFile);
          const lines = targetContent.split('\n');
          const heading = this.settings.migrateToHeading.trim();
          if (heading) {
            const insertIndex = this.findHeadingInsertIndex(lines, heading);
            if (insertIndex === -1) {
              const newContent = targetContent.trimEnd() + '\n\n' + heading + '\n' + openLine + '\n';
              await this.app.vault.modify(targetFile, newContent);
            } else {
              lines.splice(insertIndex, 0, openLine);
              await this.app.vault.modify(targetFile, lines.join('\n'));
            }
          } else {
            const newContent = targetContent.trimEnd() + '\n' + openLine + '\n';
            await this.app.vault.modify(targetFile, newContent);
          }
        }
      }

      new Notice(`Scheduled for ${dateStr}`);
    });
    modal.open();
  }

  /**
   * Find the line index to insert content after a heading. Returns -1 if heading not found.
   */
  private findHeadingInsertIndex(lines: string[], heading: string): number {
    const headingLevel = (heading.match(/^#+/) || [''])[0].length;
    const headingText = heading.replace(/^#+\s*/, '').trim().toLowerCase();
    let foundIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#+)\s+(.*)$/);
      if (m && m[1].length === headingLevel && m[2].trim().toLowerCase() === headingText) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex === -1) return -1;
    for (let i = foundIndex + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(#+)\s+/);
      if (m && m[1].length <= headingLevel) return i;
    }
    return lines.length;
  }

  /**
   * Insert a new task at cursor position
   */
  private insertTask(editor: Editor, options: { dueToday?: boolean; highPriority?: boolean } = {}): void {
    const cursor = editor.getCursor();
    let taskText = '- [ ] ';

    if (options.highPriority) {
      taskText += '⏫ ';
    }

    if (options.dueToday) {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      taskText += `📅 ${dateStr} `;
    }

    editor.replaceRange(taskText, cursor);
    editor.setCursor({ line: cursor.line, ch: cursor.ch + taskText.length });
  }

  /**
   * Insert a new event at cursor position
   */
  private insertEvent(editor: Editor, options: { withTime?: boolean } = {}): void {
    const cursor = editor.getCursor();
    let eventText = '- [o] ';

    if (options.withTime) {
      // Get current time rounded to nearest 30 minutes
      const now = new Date();
      const minutes = now.getMinutes();
      const roundedMinutes = minutes < 30 ? '00' : '30';
      const hours = String(now.getHours()).padStart(2, '0');
      eventText += `${hours}:${roundedMinutes} `;
    }

    editor.replaceRange(eventText, cursor);
    editor.setCursor({ line: cursor.line, ch: cursor.ch + eventText.length });
  }

  /**
   * Register event handlers
   */
  private registerEventHandlers(): void {
    // Refresh view when files are modified
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          // Debounce refresh
          this.refreshViewsDebounced();
        }
      })
    );

    // Refresh view when files are created or deleted
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.refreshViewsDebounced();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile) {
          this.refreshViewsDebounced();
        }
      })
    );

    // Refresh view when file is renamed
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          // Update source files if the renamed file was in the list
          const index = this.settings.sourceFiles.indexOf(oldPath);
          if (index !== -1) {
            this.settings.sourceFiles[index] = file.path;
            this.saveSettings();
          }
          this.refreshViewsDebounced();
        }
      })
    );
  }

  private refreshTimeout: NodeJS.Timeout | null = null;

  /**
   * Debounced refresh of all open views
   */
  private refreshViewsDebounced(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      this.app.workspace.getLeavesOfType(BOJO_VIEW_TYPE).forEach((leaf) => {
        const view = leaf.view as BojoView;
        view.refresh();
      });
    }, 500);
  }
}

/**
 * Modal for choosing a date when scheduling a task (editor command)
 */
class ScheduleDatePickerModal extends Modal {
  private onSubmit: (date: Date) => void;
  private selectedDate: Date;
  private dateInputEl: HTMLInputElement | null = null;

  constructor(app: App, defaultDate: Date, onSubmit: (date: Date) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.selectedDate = new Date(defaultDate);
    this.selectedDate.setHours(0, 0, 0, 0);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('bojo-schedule-modal');

    contentEl.createEl('h2', { text: 'Schedule Task For' });

    const quickDatesContainer = contentEl.createDiv({ cls: 'bojo-quick-dates' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);

    const quickDates = [
      { label: 'Today', date: today },
      { label: 'Tomorrow', date: tomorrow },
      { label: 'Next Week', date: nextWeek },
    ];

    const updateDateInput = (): void => {
      if (this.dateInputEl) {
        const y = this.selectedDate.getFullYear();
        const m = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
        const d = String(this.selectedDate.getDate()).padStart(2, '0');
        this.dateInputEl.value = `${y}-${m}-${d}`;
      }
    };

    for (const { label, date } of quickDates) {
      const btn = quickDatesContainer.createEl('button', { text: label, cls: 'bojo-quick-date-btn' });
      btn.addEventListener('click', () => {
        this.selectedDate = new Date(date);
        updateDateInput();
      });
    }

    new Setting(contentEl)
      .setName('Or choose a specific date')
      .addText((text) => {
        text.inputEl.type = 'date';
        const y = this.selectedDate.getFullYear();
        const m = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
        const d = String(this.selectedDate.getDate()).padStart(2, '0');
        text.inputEl.value = `${y}-${m}-${d}`;
        this.dateInputEl = text.inputEl;
        text.onChange((value) => {
          if (value) this.selectedDate = new Date(value + 'T00:00:00');
        });
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('Schedule').setCta().onClick(() => {
          this.close();
          this.onSubmit(this.selectedDate);
        })
      )
      .addButton((btn) =>
        btn.setButtonText('Cancel').onClick(() => this.close())
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
