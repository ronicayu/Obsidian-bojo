import {
  App,
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
  MarkdownView,
  Editor,
  Notice,
} from 'obsidian';
import { BojoSettings, DEFAULT_SETTINGS, BujoSignifier } from './types';
import { BujoParser } from './parser';
import { BojoSettingTab } from './settings';
import { BojoView, BOJO_VIEW_TYPE } from './view';

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
        this.toggleTaskAtCursor(editor, BujoSignifier.TASK_SCHEDULED);
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

    // Check if this is a task line
    const checkboxRegex = /^(\s*[-*]\s+\[)([ x><!-])(\].*)$/i;
    const match = line.match(checkboxRegex);

    if (!match) {
      new Notice('No task found on current line');
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
      default:
        newMarker = ' ';
    }

    const newLine = `${prefix}${newMarker}${suffix}`;
    editor.setLine(cursor.line, newLine);
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
