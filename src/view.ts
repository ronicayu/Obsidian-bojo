import {
  ItemView,
  WorkspaceLeaf,
  Menu,
  TFile,
  Notice,
  setIcon,
  Modal,
  Setting,
} from 'obsidian';
import {
  BujoItem,
  BujoSignifier,
  Priority,
  SortOrder,
  GroupBy,
  FilterCriteria,
} from './types';
import BojoPlugin from './main';
import { getDailyNoteFile, getDailyNotesSettings, isDailyNotesEnabled, formatDate, getOrCreateDailyNote } from './dailyNotes';

export const BOJO_VIEW_TYPE = 'bojo-todo-view';

/**
 * Main view for displaying consolidated bullet journal todos
 */
export class BojoView extends ItemView {
  plugin: BojoPlugin;
  private items: BujoItem[] = [];
  private filteredItems: BujoItem[] = [];
  private filter: FilterCriteria;
  private refreshInterval: number | null = null;
  private dailyNoteDate: Date | null = null; // null = show all, Date = show specific day's daily note

  constructor(leaf: WorkspaceLeaf, plugin: BojoPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.filter = this.getDefaultFilter();
  }

  getViewType(): string {
    return BOJO_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Bullet Journal Todos';
  }

  getIcon(): string {
    return 'checkbox-glyph';
  }

  private getDefaultFilter(): FilterCriteria {
    return {
      signifiers: [],
      tags: [],
      priorities: [],
      dueDateFrom: null,
      dueDateTo: null,
      searchText: '',
      files: [],
      folders: [],
    };
  }

  async onOpen(): Promise<void> {
    await this.refresh();
    this.setupAutoRefresh();
  }

  async onClose(): Promise<void> {
    this.clearAutoRefresh();
  }

  private setupAutoRefresh(): void {
    this.clearAutoRefresh();
    const interval = this.plugin.settings.autoRefreshInterval;
    if (interval > 0) {
      this.refreshInterval = window.setInterval(() => {
        this.refresh();
      }, interval * 1000);
    }
  }

  private clearAutoRefresh(): void {
    if (this.refreshInterval !== null) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Refresh the todo list
   */
  async refresh(): Promise<void> {
    this.items = await this.plugin.parser.parseAll();
    this.applyFilters();
    this.render();
  }

  /**
   * Apply current filters to items
   */
  private applyFilters(): void {
    let filtered = [...this.items];

    // Filter by signifier (status)
    if (!this.plugin.settings.showCompleted) {
      filtered = filtered.filter((item) =>
        item.signifier !== BujoSignifier.TASK_COMPLETE &&
        item.signifier !== BujoSignifier.EVENT_DONE
      );
    }
    if (!this.plugin.settings.showCancelled) {
      filtered = filtered.filter((item) =>
        item.signifier !== BujoSignifier.TASK_CANCELLED &&
        item.signifier !== BujoSignifier.EVENT_CANCELLED
      );
    }
    if (!this.plugin.settings.showMigrated) {
      filtered = filtered.filter((item) =>
        item.signifier !== BujoSignifier.TASK_MIGRATED
      );
    }
    if (!this.plugin.settings.showEvents) {
      filtered = filtered.filter((item) =>
        item.signifier !== BujoSignifier.EVENT &&
        item.signifier !== BujoSignifier.EVENT_DONE &&
        item.signifier !== BujoSignifier.EVENT_CANCELLED
      );
    }

    // Filter by daily note date
    if (this.dailyNoteDate) {
      const dailyNoteFile = getDailyNoteFile(this.app, this.dailyNoteDate);
      if (dailyNoteFile) {
        filtered = filtered.filter((item) => item.file.path === dailyNoteFile.path);
      } else {
        // No daily note exists for this date, show nothing
        filtered = [];
      }
    }

    // Filter by search text
    if (this.filter.searchText) {
      const searchLower = this.filter.searchText.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.content.toLowerCase().includes(searchLower) ||
          item.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Filter by tags
    if (this.filter.tags.length > 0) {
      filtered = filtered.filter((item) =>
        this.filter.tags.some((tag) => item.tags.includes(tag))
      );
    }

    // Filter by priority
    if (this.filter.priorities.length > 0) {
      filtered = filtered.filter((item) => this.filter.priorities.includes(item.priority));
    }

    // Filter by due date range
    if (this.filter.dueDateFrom) {
      filtered = filtered.filter(
        (item) => item.dueDate && item.dueDate >= this.filter.dueDateFrom!
      );
    }
    if (this.filter.dueDateTo) {
      filtered = filtered.filter(
        (item) => item.dueDate && item.dueDate <= this.filter.dueDateTo!
      );
    }

    // Sort
    filtered = this.sortItems(filtered);

    this.filteredItems = filtered;
  }

  /**
   * Sort items according to settings
   */
  private sortItems(items: BujoItem[]): BujoItem[] {
    const sorted = [...items];
    const sortOrder = this.plugin.settings.sortOrder;

    sorted.sort((a, b) => {
      switch (sortOrder) {
        case SortOrder.DUE_DATE:
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();

        case SortOrder.PRIORITY:
          return b.priority - a.priority;

        case SortOrder.CREATED_DATE:
          if (!a.createdDate && !b.createdDate) return 0;
          if (!a.createdDate) return 1;
          if (!b.createdDate) return -1;
          return b.createdDate.getTime() - a.createdDate.getTime();

        case SortOrder.FILE_NAME:
          return a.file.basename.localeCompare(b.file.basename);

        case SortOrder.STATUS:
          return this.getStatusOrder(a.signifier) - this.getStatusOrder(b.signifier);

        default:
          return 0;
      }
    });

    return sorted;
  }

  private getStatusOrder(signifier: BujoSignifier): number {
    switch (signifier) {
      case BujoSignifier.EVENT:
        return 0;
      case BujoSignifier.TASK:
        return 1;
      case BujoSignifier.TASK_SCHEDULED:
        return 2;
      case BujoSignifier.TASK_MIGRATED:
        return 3;
      case BujoSignifier.TASK_COMPLETE:
        return 4;
      case BujoSignifier.EVENT_DONE:
        return 5;
      case BujoSignifier.TASK_CANCELLED:
        return 6;
      case BujoSignifier.EVENT_CANCELLED:
        return 7;
      default:
        return 8;
    }
  }

  /**
   * Render the view
   */
  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    
    // Preserve scroll position before re-rendering
    const existingList = container.querySelector('.bojo-list') as HTMLElement;
    const scrollTop = existingList?.scrollTop ?? 0;
    
    container.empty();
    container.addClass('bojo-container');

    // Header with controls
    this.renderHeader(container);

    // Stats
    this.renderStats(container);

    // Todo list
    this.renderTodoList(container);
    
    // Restore scroll position after re-rendering
    const newList = container.querySelector('.bojo-list') as HTMLElement;
    if (newList && scrollTop > 0) {
      newList.scrollTop = scrollTop;
    }
  }

  /**
   * Render the header with controls
   */
  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'bojo-header' });

    // Title row with daily note controls
    const titleRow = header.createDiv({ cls: 'bojo-title-row' });
    titleRow.createEl('h4', { text: 'Bullet Journal Todos', cls: 'bojo-title' });

    // Daily notes filter (if enabled)
    if (isDailyNotesEnabled(this.app)) {
      this.renderDailyNoteControls(titleRow);
    }

    // Controls row
    const controls = header.createDiv({ cls: 'bojo-controls' });

    // Search input
    const searchContainer = controls.createDiv({ cls: 'bojo-search' });
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search todos...',
      cls: 'bojo-search-input',
    });
    searchInput.value = this.filter.searchText;
    searchInput.addEventListener('input', (e) => {
      this.filter.searchText = (e.target as HTMLInputElement).value;
      this.applyFilters();
      this.renderTodoList(container);
    });

    // Refresh button
    const refreshBtn = controls.createEl('button', {
      cls: 'bojo-btn bojo-btn-refresh',
      attr: { 'aria-label': 'Refresh' },
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => this.refresh());

    // Filter button
    const filterBtn = controls.createEl('button', {
      cls: 'bojo-btn bojo-btn-filter',
      attr: { 'aria-label': 'Filter' },
    });
    setIcon(filterBtn, 'filter');
    filterBtn.addEventListener('click', (e) => this.showFilterMenu(e));
  }

  /**
   * Render daily note filter controls
   */
  private renderDailyNoteControls(container: HTMLElement): void {
    const dailyControls = container.createDiv({ cls: 'bojo-daily-controls' });

    // "All" button
    const allBtn = dailyControls.createEl('button', {
      cls: `bojo-daily-btn ${this.dailyNoteDate === null ? 'bojo-daily-btn-active' : ''}`,
      text: 'All',
    });
    allBtn.addEventListener('click', () => {
      this.dailyNoteDate = null;
      this.applyFilters();
      this.render();
    });

    // "Today" button
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = this.dailyNoteDate?.getTime() === today.getTime();
    
    const todayBtn = dailyControls.createEl('button', {
      cls: `bojo-daily-btn ${isToday ? 'bojo-daily-btn-active' : ''}`,
      text: 'Today',
    });
    todayBtn.addEventListener('click', () => {
      const newDate = new Date();
      newDate.setHours(0, 0, 0, 0);
      this.dailyNoteDate = newDate;
      this.applyFilters();
      this.render();
    });

    // Date picker button
    const dateBtn = dailyControls.createEl('button', {
      cls: 'bojo-daily-btn bojo-daily-btn-picker',
      attr: { 'aria-label': 'Pick date' },
    });
    setIcon(dateBtn, 'calendar');
    dateBtn.addEventListener('click', (e) => this.showDateMenu(e));

    // Show current date if filtering by a specific date (not today)
    if (this.dailyNoteDate && !isToday) {
      const settings = getDailyNotesSettings(this.app);
      const format = settings?.format || 'YYYY-MM-DD';
      const dateLabel = dailyControls.createSpan({ 
        cls: 'bojo-daily-date-label',
        text: formatDate(this.dailyNoteDate, format),
      });
    }
  }

  /**
   * Show date picker menu
   */
  private showDateMenu(e: MouseEvent): void {
    const menu = new Menu();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    menu.addItem((item) =>
      item.setTitle('Yesterday').onClick(() => {
        this.dailyNoteDate = yesterday;
        this.applyFilters();
        this.render();
      })
    );

    // Last 7 days
    menu.addSeparator();
    for (let i = 2; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const settings = getDailyNotesSettings(this.app);
      const format = settings?.format || 'YYYY-MM-DD';
      const label = formatDate(date, format);
      
      menu.addItem((item) =>
        item.setTitle(label).onClick(() => {
          this.dailyNoteDate = date;
          this.applyFilters();
          this.render();
        })
      );
    }

    menu.addSeparator();

    // Clear filter
    menu.addItem((item) =>
      item.setTitle('Show All').onClick(() => {
        this.dailyNoteDate = null;
        this.applyFilters();
        this.render();
      })
    );

    menu.showAtMouseEvent(e);
  }

  /**
   * Render statistics
   */
  private renderStats(container: HTMLElement): void {
    const stats = container.createDiv({ cls: 'bojo-stats' });

    const total = this.items.length;
    const incomplete = this.items.filter((i) => i.signifier === BujoSignifier.TASK).length;
    const complete = this.items.filter((i) => i.signifier === BujoSignifier.TASK_COMPLETE).length;
    const events = this.items.filter((i) => this.isEventType(i.signifier)).length;
    const pendingEvents = this.items.filter((i) => i.signifier === BujoSignifier.EVENT).length;
    const overdue = this.items.filter(
      (i) => i.signifier === BujoSignifier.TASK && i.dueDate && i.dueDate < new Date()
    ).length;

    stats.innerHTML = `
      <span class="bojo-stat"><strong>${incomplete}</strong> open</span>
      <span class="bojo-stat"><strong>${complete}</strong> done</span>
      ${pendingEvents > 0 ? `<span class="bojo-stat bojo-stat-events"><strong>${pendingEvents}</strong> events</span>` : ''}
      ${overdue > 0 ? `<span class="bojo-stat bojo-stat-overdue"><strong>${overdue}</strong> overdue</span>` : ''}
      <span class="bojo-stat bojo-stat-total">${this.filteredItems.length} of ${total} shown</span>
    `;
  }

  /**
   * Render the todo list
   */
  private renderTodoList(container: HTMLElement): void {
    // Remove existing list if any
    const existingList = container.querySelector('.bojo-list');
    if (existingList) {
      existingList.remove();
    }

    const listContainer = container.createDiv({ cls: 'bojo-list' });

    if (this.filteredItems.length === 0) {
      listContainer.createDiv({
        cls: 'bojo-empty',
        text: 'No todos found. Configure source folders in settings.',
      });
      return;
    }

    // Group items if needed
    const groupBy = this.plugin.settings.groupBy;
    if (groupBy === GroupBy.NONE) {
      this.renderItems(listContainer, this.filteredItems);
    } else {
      const groups = this.groupItems(this.filteredItems, groupBy);
      for (const [groupName, items] of Object.entries(groups)) {
        this.renderGroup(listContainer, groupName, items);
      }
    }
  }

  /**
   * Group items by the specified criteria
   */
  private groupItems(items: BujoItem[], groupBy: GroupBy): Record<string, BujoItem[]> {
    const groups: Record<string, BujoItem[]> = {};

    for (const item of items) {
      let key: string;

      switch (groupBy) {
        case GroupBy.FILE:
          key = item.file.basename;
          break;
        case GroupBy.FOLDER:
          key = item.file.parent?.path || 'Root';
          break;
        case GroupBy.STATUS:
          key = this.getStatusLabel(item.signifier);
          break;
        case GroupBy.DUE_DATE:
          key = item.dueDate ? this.formatDateGroup(item.dueDate) : 'No Due Date';
          break;
        case GroupBy.PRIORITY:
          key = this.getPriorityLabel(item.priority);
          break;
        case GroupBy.TAG:
          if (item.tags.length === 0) {
            key = 'Untagged';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
          } else {
            for (const tag of item.tags) {
              if (!groups[tag]) groups[tag] = [];
              groups[tag].push(item);
            }
          }
          continue;
        default:
          key = 'All';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    return groups;
  }

  private getStatusLabel(signifier: BujoSignifier): string {
    switch (signifier) {
      case BujoSignifier.TASK:
        return 'Open';
      case BujoSignifier.TASK_COMPLETE:
        return 'Completed';
      case BujoSignifier.TASK_MIGRATED:
        return 'Migrated';
      case BujoSignifier.TASK_SCHEDULED:
        return 'Scheduled';
      case BujoSignifier.TASK_CANCELLED:
        return 'Cancelled';
      case BujoSignifier.EVENT:
        return 'Event';
      case BujoSignifier.EVENT_DONE:
        return 'Event Done';
      case BujoSignifier.EVENT_CANCELLED:
        return 'Event Cancelled';
      default:
        return 'Other';
    }
  }

  /**
   * Check if a signifier is an event type
   */
  private isEventType(signifier: BujoSignifier): boolean {
    return signifier === BujoSignifier.EVENT ||
           signifier === BujoSignifier.EVENT_DONE ||
           signifier === BujoSignifier.EVENT_CANCELLED;
  }

  private getPriorityLabel(priority: Priority): string {
    switch (priority) {
      case Priority.HIGH:
        return 'High Priority';
      case Priority.MEDIUM:
        return 'Medium Priority';
      case Priority.LOW:
        return 'Low Priority';
      default:
        return 'No Priority';
    }
  }

  private formatDateGroup(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly < today) return 'Overdue';
    if (dateOnly.getTime() === today.getTime()) return 'Today';
    if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
    if (dateOnly < nextWeek) return 'This Week';
    return 'Later';
  }

  /**
   * Render a group of items
   */
  private renderGroup(container: HTMLElement, name: string, items: BujoItem[]): void {
    const group = container.createDiv({ cls: 'bojo-group' });
    const header = group.createDiv({ cls: 'bojo-group-header' });
    header.createSpan({ text: name, cls: 'bojo-group-name' });
    header.createSpan({ text: `(${items.length})`, cls: 'bojo-group-count' });

    const itemsContainer = group.createDiv({ cls: 'bojo-group-items' });
    this.renderItems(itemsContainer, items);
  }

  /**
   * Render a list of items
   */
  private renderItems(container: HTMLElement, items: BujoItem[]): void {
    for (const item of items) {
      this.renderItem(container, item);
    }
  }

  /**
   * Render a single todo item
   */
  private renderItem(container: HTMLElement, item: BujoItem): void {
    const itemEl = container.createDiv({ cls: 'bojo-item' });
    const isEvent = this.isEventType(item.signifier);
    const isEventDone = item.signifier === BujoSignifier.EVENT_DONE;
    const isEventCancelled = item.signifier === BujoSignifier.EVENT_CANCELLED;
    const isMigrated = item.signifier === BujoSignifier.TASK_MIGRATED;
    const isScheduled = item.signifier === BujoSignifier.TASK_SCHEDULED;
    const isCancelled = item.signifier === BujoSignifier.TASK_CANCELLED;

    // Add status-specific class
    itemEl.addClass(`bojo-item-${item.signifier}`);

    // Priority indicator
    if (item.priority !== Priority.NONE) {
      itemEl.addClass(`bojo-priority-${item.priority}`);
    }

    // Render indicator based on item type
    if (isEvent) {
      // Event indicator (circles)
      const eventIndicator = itemEl.createSpan({ cls: 'bojo-event-indicator' });
      if (isEventDone) {
        eventIndicator.textContent = '●';
        eventIndicator.addClass('bojo-event-done');
      } else if (isEventCancelled) {
        eventIndicator.textContent = '○';
        eventIndicator.addClass('bojo-event-cancelled');
      } else {
        eventIndicator.textContent = '○';
      }
      eventIndicator.addEventListener('click', () => this.toggleEventDone(item));
      eventIndicator.style.cursor = 'pointer';
    } else if (isMigrated) {
      // Migrated task indicator (forward arrow)
      const indicator = itemEl.createSpan({ cls: 'bojo-status-indicator bojo-migrated-indicator' });
      setIcon(indicator, 'forward');
      indicator.addEventListener('click', () => this.updateItemStatus(item, BujoSignifier.TASK));
      indicator.style.cursor = 'pointer';
      indicator.setAttribute('aria-label', 'Click to restore task');
    } else if (isScheduled) {
      // Scheduled task indicator (calendar arrow)
      const indicator = itemEl.createSpan({ cls: 'bojo-status-indicator bojo-scheduled-indicator' });
      setIcon(indicator, 'calendar-clock');
      indicator.addEventListener('click', () => this.updateItemStatus(item, BujoSignifier.TASK));
      indicator.style.cursor = 'pointer';
      indicator.setAttribute('aria-label', 'Click to restore task');
    } else if (isCancelled) {
      // Cancelled task indicator (x)
      const indicator = itemEl.createSpan({ cls: 'bojo-status-indicator bojo-cancelled-indicator' });
      setIcon(indicator, 'x');
      indicator.addEventListener('click', () => this.updateItemStatus(item, BujoSignifier.TASK));
      indicator.style.cursor = 'pointer';
      indicator.setAttribute('aria-label', 'Click to restore task');
    } else {
      // Regular task checkbox
      const checkbox = itemEl.createEl('input', {
        type: 'checkbox',
        cls: 'bojo-checkbox',
      });
      checkbox.checked = item.signifier === BujoSignifier.TASK_COMPLETE;
      checkbox.addEventListener('change', () => this.toggleComplete(item));
    }

    // Content wrapper
    const contentWrapper = itemEl.createDiv({ cls: 'bojo-item-content' });

    // Main text row (with time for events)
    const textRow = contentWrapper.createDiv({ cls: 'bojo-item-text-row' });

    // Time display for events
    if (isEvent && item.startTime) {
      const timeEl = textRow.createSpan({ cls: 'bojo-item-time' });
      if (item.endTime) {
        timeEl.textContent = `${item.startTime} - ${item.endTime}`;
      } else {
        timeEl.textContent = item.startTime;
      }
    }

    // Main text
    const textEl = textRow.createSpan({ cls: 'bojo-item-text' });
    textEl.textContent = item.content;

    // Click to open file
    textEl.addEventListener('click', () => this.openFile(item));

    // Metadata row
    const metaEl = contentWrapper.createDiv({ cls: 'bojo-item-meta' });

    // File link
    const fileLink = metaEl.createSpan({ cls: 'bojo-item-file' });
    fileLink.textContent = item.file.basename;
    fileLink.addEventListener('click', () => this.openFile(item));

    // Location for events (not for cancelled events, they show as greyed out anyway)
    if (isEvent && item.location && !isEventCancelled) {
      const locationEl = metaEl.createSpan({ cls: 'bojo-item-location' });
      locationEl.textContent = `📍 ${item.location}`;
    }

    // Due date
    if (item.dueDate) {
      const dueDateEl = metaEl.createSpan({ cls: 'bojo-item-due' });
      const isOverdue = item.dueDate < new Date() && item.signifier === BujoSignifier.TASK;
      if (isOverdue) dueDateEl.addClass('bojo-overdue');
      dueDateEl.textContent = `📅 ${this.formatDate(item.dueDate)}`;
    }

    // Tags
    for (const tag of item.tags) {
      const tagEl = metaEl.createSpan({ cls: 'bojo-item-tag' });
      tagEl.textContent = `#${tag}`;
    }

    // Priority badge
    if (item.priority !== Priority.NONE) {
      const priorityEl = metaEl.createSpan({ cls: 'bojo-item-priority' });
      priorityEl.textContent = this.getPriorityEmoji(item.priority);
    }

    // Actions menu button
    const actionsBtn = itemEl.createEl('button', {
      cls: 'bojo-item-actions',
      attr: { 'aria-label': 'Actions' },
    });
    setIcon(actionsBtn, 'more-vertical');
    actionsBtn.addEventListener('click', (e) => this.showItemMenu(e, item));
  }

  private getPriorityEmoji(priority: Priority): string {
    switch (priority) {
      case Priority.HIGH:
        return '⏫';
      case Priority.MEDIUM:
        return '🔼';
      case Priority.LOW:
        return '🔽';
      default:
        return '';
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Show filter menu
   */
  private showFilterMenu(e: MouseEvent): void {
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setTitle('Show Events')
        .setChecked(this.plugin.settings.showEvents)
        .onClick(async () => {
          this.plugin.settings.showEvents = !this.plugin.settings.showEvents;
          await this.plugin.saveSettings();
          this.applyFilters();
          this.render();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('Show Completed')
        .setChecked(this.plugin.settings.showCompleted)
        .onClick(async () => {
          this.plugin.settings.showCompleted = !this.plugin.settings.showCompleted;
          await this.plugin.saveSettings();
          this.applyFilters();
          this.render();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('Show Cancelled')
        .setChecked(this.plugin.settings.showCancelled)
        .onClick(async () => {
          this.plugin.settings.showCancelled = !this.plugin.settings.showCancelled;
          await this.plugin.saveSettings();
          this.applyFilters();
          this.render();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('Show Migrated')
        .setChecked(this.plugin.settings.showMigrated)
        .onClick(async () => {
          this.plugin.settings.showMigrated = !this.plugin.settings.showMigrated;
          await this.plugin.saveSettings();
          this.applyFilters();
          this.render();
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item.setTitle('Clear Filters').onClick(() => {
        this.filter = this.getDefaultFilter();
        this.applyFilters();
        this.render();
      })
    );

    menu.showAtMouseEvent(e);
  }

  /**
   * Show item context menu
   */
  private showItemMenu(e: MouseEvent, item: BujoItem): void {
    e.stopPropagation();
    const menu = new Menu();
    const isEvent = this.isEventType(item.signifier);
    const isEventDone = item.signifier === BujoSignifier.EVENT_DONE;
    const isEventCancelled = item.signifier === BujoSignifier.EVENT_CANCELLED;
    const isPendingEvent = item.signifier === BujoSignifier.EVENT;

    // Event actions
    if (isEvent) {
      // Mark as done / Mark as pending
      if (isEventDone) {
        menu.addItem((menuItem) =>
          menuItem
            .setTitle('Mark as Pending')
            .setIcon('circle')
            .onClick(() => this.updateItemStatus(item, BujoSignifier.EVENT))
        );
      } else if (isEventCancelled) {
        menu.addItem((menuItem) =>
          menuItem
            .setTitle('Restore Event')
            .setIcon('undo')
            .onClick(() => this.updateItemStatus(item, BujoSignifier.EVENT))
        );
      } else {
        menu.addItem((menuItem) =>
          menuItem
            .setTitle('Mark as Done')
            .setIcon('check-circle')
            .onClick(() => this.updateItemStatus(item, BujoSignifier.EVENT_DONE))
        );
      }

      // Cancel event
      if (!isEventCancelled) {
        menu.addItem((menuItem) =>
          menuItem
            .setTitle('Cancel Event')
            .setIcon('x-circle')
            .onClick(() => this.updateItemStatus(item, BujoSignifier.EVENT_CANCELLED))
        );
      }

      menu.addSeparator();

      menu.addItem((menuItem) =>
        menuItem
          .setTitle('Convert to Task')
          .setIcon('check-square')
          .onClick(() => this.updateItemStatus(item, BujoSignifier.TASK))
      );
    } else {
      // Complete/Uncomplete for tasks
      if (item.signifier === BujoSignifier.TASK_COMPLETE) {
        menu.addItem((menuItem) =>
          menuItem
            .setTitle('Mark as Incomplete')
            .setIcon('circle')
            .onClick(() => this.updateItemStatus(item, BujoSignifier.TASK))
        );
      } else {
        menu.addItem((menuItem) =>
          menuItem
            .setTitle('Complete')
            .setIcon('check')
            .onClick(() => this.updateItemStatus(item, BujoSignifier.TASK_COMPLETE))
        );
      }

      menu.addItem((menuItem) =>
        menuItem
          .setTitle('Convert to Event')
          .setIcon('calendar-clock')
          .onClick(() => this.updateItemStatus(item, BujoSignifier.EVENT))
      );
    }

    menu.addSeparator();

    // Bullet Journal Actions (for tasks only)
    if (!isEvent) {
      menu.addItem((menuItem) =>
        menuItem
          .setTitle('Migrate (>)')
          .setIcon('arrow-right')
          .onClick(() => this.showMigrateDatePicker(item))
      );

      menu.addItem((menuItem) =>
        menuItem
          .setTitle('Schedule (<)')
          .setIcon('calendar')
          .onClick(() => this.updateItemStatus(item, BujoSignifier.TASK_SCHEDULED))
      );

      menu.addItem((menuItem) =>
        menuItem
          .setTitle('Cancel (-)')
          .setIcon('x')
          .onClick(() => this.updateItemStatus(item, BujoSignifier.TASK_CANCELLED))
      );

      menu.addSeparator();
    }

    // Priority
    menu.addItem((menuItem) =>
      menuItem
        .setTitle('High Priority')
        .setIcon('chevrons-up')
        .onClick(() => this.updateItemPriority(item, Priority.HIGH))
    );

    menu.addItem((menuItem) =>
      menuItem
        .setTitle('Medium Priority')
        .setIcon('chevron-up')
        .onClick(() => this.updateItemPriority(item, Priority.MEDIUM))
    );

    menu.addItem((menuItem) =>
      menuItem
        .setTitle('Low Priority')
        .setIcon('chevron-down')
        .onClick(() => this.updateItemPriority(item, Priority.LOW))
    );

    menu.addItem((menuItem) =>
      menuItem
        .setTitle('No Priority')
        .setIcon('minus')
        .onClick(() => this.updateItemPriority(item, Priority.NONE))
    );

    menu.addSeparator();

    // Open file
    menu.addItem((menuItem) =>
      menuItem
        .setTitle('Open File')
        .setIcon('file-text')
        .onClick(() => this.openFile(item))
    );

    menu.showAtMouseEvent(e);
  }

  /**
   * Toggle item completion
   */
  private async toggleComplete(item: BujoItem): Promise<void> {
    const newSignifier =
      item.signifier === BujoSignifier.TASK_COMPLETE
        ? BujoSignifier.TASK
        : BujoSignifier.TASK_COMPLETE;
    await this.updateItemStatus(item, newSignifier);
  }

  /**
   * Toggle event done status
   */
  private async toggleEventDone(item: BujoItem): Promise<void> {
    let newSignifier: BujoSignifier;
    if (item.signifier === BujoSignifier.EVENT_DONE) {
      newSignifier = BujoSignifier.EVENT;
    } else if (item.signifier === BujoSignifier.EVENT_CANCELLED) {
      newSignifier = BujoSignifier.EVENT; // Restore cancelled event
    } else {
      newSignifier = BujoSignifier.EVENT_DONE;
    }
    await this.updateItemStatus(item, newSignifier);
  }

  /**
   * Update item status/signifier
   */
  private async updateItemStatus(item: BujoItem, newSignifier: BujoSignifier): Promise<void> {
    const oldItem = { ...item };
    item.signifier = newSignifier;
    if (newSignifier === BujoSignifier.TASK_COMPLETE || newSignifier === BujoSignifier.EVENT_DONE) {
      item.completedDate = new Date();
    }
    await this.updateItemInFile(oldItem, item);
    await this.refresh();
    const label = this.getStatusLabel(newSignifier).toLowerCase();
    const itemType = this.isEventType(newSignifier) ? 'Event' : 'Task';
    new Notice(`${itemType} ${label}`);
  }

  /**
   * Update item priority
   */
  private async updateItemPriority(item: BujoItem, newPriority: Priority): Promise<void> {
    const oldItem = { ...item };
    item.priority = newPriority;
    await this.updateItemInFile(oldItem, item);
    await this.refresh();
    new Notice(`Priority updated to ${this.getPriorityLabel(newPriority).toLowerCase()}`);
  }

  /**
   * Update item in its source file
   */
  private async updateItemInFile(oldItem: BujoItem, newItem: BujoItem): Promise<void> {
    const file = newItem.file;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');

    const newLine = this.plugin.parser.itemToMarkdown(newItem);
    lines[newItem.line] = newLine;

    await this.app.vault.modify(file, lines.join('\n'));
  }

  /**
   * Open the source file at the item's line
   */
  private async openFile(item: BujoItem): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(item.file, {
      eState: { line: item.line },
    });
  }

  /**
   * Show date picker for migrating a task
   */
  private showMigrateDatePicker(item: BujoItem): void {
    const modal = new MigrateDatePickerModal(this.app, async (date: Date) => {
      await this.migrateTask(item, date);
    });
    modal.open();
  }

  /**
   * Migrate a task to another daily note
   * Creates a copy of the task in the target daily note and marks the original as migrated
   */
  private async migrateTask(item: BujoItem, targetDate: Date): Promise<void> {
    // Check if daily notes is enabled
    if (!isDailyNotesEnabled(this.app)) {
      new Notice('Daily Notes plugin is not enabled');
      return;
    }

    // Get or create the target daily note
    const targetFile = await getOrCreateDailyNote(this.app, targetDate);
    if (!targetFile) {
      new Notice('Could not create daily note for the selected date');
      return;
    }

    // Create the task line for the target file (as a fresh task)
    const migratedItem = { ...item };
    migratedItem.signifier = BujoSignifier.TASK; // Reset to pending task
    const taskLine = this.plugin.parser.itemToMarkdown(migratedItem);

    // Read the target file content
    const targetContent = await this.app.vault.read(targetFile);
    const lines = targetContent.split('\n');
    
    // Check if we have a configured heading to insert under
    const headingToFind = this.plugin.settings.migrateToHeading.trim();
    let newContent: string;
    
    if (headingToFind) {
      // Find the heading and insert after it
      const insertIndex = this.findHeadingInsertIndex(lines, headingToFind);
      if (insertIndex !== -1) {
        // Insert the task after the heading
        lines.splice(insertIndex, 0, taskLine);
        newContent = lines.join('\n');
      } else {
        // Heading not found, append at end
        newContent = targetContent.trimEnd() + '\n\n' + headingToFind + '\n' + taskLine + '\n';
      }
    } else {
      // No heading configured, append at end
      newContent = targetContent.trimEnd() + '\n' + taskLine + '\n';
    }
    
    await this.app.vault.modify(targetFile, newContent);

    // Mark the original task as migrated
    await this.updateItemStatus(item, BujoSignifier.TASK_MIGRATED);

    const settings = getDailyNotesSettings(this.app);
    const dateStr = settings ? formatDate(targetDate, settings.format) : targetDate.toLocaleDateString();
    new Notice(`Task migrated to ${dateStr}`);
  }

  /**
   * Find the index to insert content after a heading
   * Returns the line index where content should be inserted (after the heading and any existing content under it)
   * Returns -1 if heading is not found
   */
  private findHeadingInsertIndex(lines: string[], heading: string): number {
    const headingLevel = (heading.match(/^#+/) || [''])[0].length;
    const headingText = heading.replace(/^#+\s*/, '').trim().toLowerCase();
    
    let foundHeadingIndex = -1;
    
    // Find the heading
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineHeadingMatch = line.match(/^(#+)\s+(.*)$/);
      
      if (lineHeadingMatch) {
        const lineLevel = lineHeadingMatch[1].length;
        const lineText = lineHeadingMatch[2].trim().toLowerCase();
        
        if (lineLevel === headingLevel && lineText === headingText) {
          foundHeadingIndex = i;
          break;
        }
      }
    }
    
    if (foundHeadingIndex === -1) {
      return -1;
    }
    
    // Find where to insert (after heading, before next same-or-higher-level heading)
    // We want to insert at the end of the section, just before the next heading
    for (let i = foundHeadingIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const lineHeadingMatch = line.match(/^(#+)\s+/);
      
      if (lineHeadingMatch) {
        const lineLevel = lineHeadingMatch[1].length;
        // If we hit a heading of same or higher level, insert before it
        if (lineLevel <= headingLevel) {
          return i;
        }
      }
    }
    
    // No next heading found, insert at end
    return lines.length;
  }
}

/**
 * Modal for selecting a date to migrate a task to
 */
class MigrateDatePickerModal extends Modal {
  private onSubmit: (date: Date) => void;
  private selectedDate: Date;

  constructor(app: any, onSubmit: (date: Date) => void) {
    super(app);
    this.onSubmit = onSubmit;
    // Default to tomorrow
    this.selectedDate = new Date();
    this.selectedDate.setDate(this.selectedDate.getDate() + 1);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('bojo-migrate-modal');

    contentEl.createEl('h2', { text: 'Migrate Task To' });

    // Quick date buttons
    const quickDatesContainer = contentEl.createDiv({ cls: 'bojo-quick-dates' });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const quickDates = [
      { label: 'Tomorrow', date: tomorrow },
      { label: 'Next Week', date: nextWeek },
      { label: 'Next Month', date: nextMonth },
    ];

    for (const { label, date } of quickDates) {
      const btn = quickDatesContainer.createEl('button', { 
        text: label,
        cls: 'bojo-quick-date-btn'
      });
      btn.addEventListener('click', () => {
        this.selectedDate = date;
        this.close();
        this.onSubmit(this.selectedDate);
      });
    }

    // Custom date picker
    new Setting(contentEl)
      .setName('Or choose a specific date')
      .addText((text) => {
        text.inputEl.type = 'date';
        text.inputEl.valueAsDate = this.selectedDate;
        text.onChange((value) => {
          if (value) {
            this.selectedDate = new Date(value + 'T00:00:00');
          }
        });
      });

    // Submit button
    new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText('Migrate')
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit(this.selectedDate);
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText('Cancel')
          .onClick(() => {
            this.close();
          });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
