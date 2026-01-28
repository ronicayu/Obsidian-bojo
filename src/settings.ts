import { App, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { BojoSettings, SortOrder, GroupBy, DEFAULT_SETTINGS } from './types';
import BojoPlugin from './main';

/**
 * Settings tab for the Bullet Journal Todo plugin
 */
export class BojoSettingTab extends PluginSettingTab {
  plugin: BojoPlugin;

  constructor(app: App, plugin: BojoPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h1', { text: 'Bullet Journal Todo Settings' });

    // Source Configuration Section
    containerEl.createEl('h2', { text: 'Source Configuration' });

    // Source Folders
    new Setting(containerEl)
      .setName('Source Folders')
      .setDesc('Folders to scan for todos (one per line). Leave empty to scan all files.')
      .addTextArea((text) => {
        text
          .setPlaceholder('daily/\nprojects/\ntodos/')
          .setValue(this.plugin.settings.sourceFolders.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.sourceFolders = value
              .split('\n')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 30;
      });

    // Source Files
    new Setting(containerEl)
      .setName('Source Files')
      .setDesc('Specific files to scan for todos (one per line, full path)')
      .addTextArea((text) => {
        text
          .setPlaceholder('inbox.md\nprojects/main-todo.md')
          .setValue(this.plugin.settings.sourceFiles.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.sourceFiles = value
              .split('\n')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 30;
      });

    // Include Subfolders
    new Setting(containerEl)
      .setName('Include Subfolders')
      .setDesc('When enabled, todos from subfolders of source folders will also be included')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeSubfolders).onChange(async (value) => {
          this.plugin.settings.includeSubfolders = value;
          await this.plugin.saveSettings();
        })
      );

    // Display Configuration Section
    containerEl.createEl('h2', { text: 'Display Configuration' });

    // Sort Order
    new Setting(containerEl)
      .setName('Sort Order')
      .setDesc('Default sort order for the todo list')
      .addDropdown((dropdown) =>
        dropdown
          .addOption(SortOrder.DUE_DATE, 'Due Date')
          .addOption(SortOrder.PRIORITY, 'Priority')
          .addOption(SortOrder.CREATED_DATE, 'Created Date')
          .addOption(SortOrder.FILE_NAME, 'File Name')
          .addOption(SortOrder.STATUS, 'Status')
          .setValue(this.plugin.settings.sortOrder)
          .onChange(async (value: SortOrder) => {
            this.plugin.settings.sortOrder = value;
            await this.plugin.saveSettings();
          })
      );

    // Group By
    new Setting(containerEl)
      .setName('Group By')
      .setDesc('How to group todos in the list')
      .addDropdown((dropdown) =>
        dropdown
          .addOption(GroupBy.NONE, 'No Grouping')
          .addOption(GroupBy.FILE, 'File')
          .addOption(GroupBy.FOLDER, 'Folder')
          .addOption(GroupBy.STATUS, 'Status')
          .addOption(GroupBy.DUE_DATE, 'Due Date')
          .addOption(GroupBy.PRIORITY, 'Priority')
          .addOption(GroupBy.TAG, 'Tag')
          .setValue(this.plugin.settings.groupBy)
          .onChange(async (value: GroupBy) => {
            this.plugin.settings.groupBy = value;
            await this.plugin.saveSettings();
          })
      );

    // Show Completed
    new Setting(containerEl)
      .setName('Show Completed Tasks')
      .setDesc('Display completed tasks in the todo list')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showCompleted).onChange(async (value) => {
          this.plugin.settings.showCompleted = value;
          await this.plugin.saveSettings();
        })
      );

    // Show Cancelled
    new Setting(containerEl)
      .setName('Show Cancelled Tasks')
      .setDesc('Display cancelled tasks in the todo list')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showCancelled).onChange(async (value) => {
          this.plugin.settings.showCancelled = value;
          await this.plugin.saveSettings();
        })
      );

    // Show Events
    new Setting(containerEl)
      .setName('Show Events')
      .setDesc('Display events (meetings, appointments) in the todo list')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showEvents).onChange(async (value) => {
          this.plugin.settings.showEvents = value;
          await this.plugin.saveSettings();
        })
      );

    // Date Format
    new Setting(containerEl)
      .setName('Date Format')
      .setDesc('Format for displaying dates (YYYY-MM-DD)')
      .addText((text) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value || 'YYYY-MM-DD';
            await this.plugin.saveSettings();
          })
      );

    // Auto Refresh
    new Setting(containerEl)
      .setName('Auto Refresh Interval')
      .setDesc('Automatically refresh the todo list (in seconds, 0 to disable)')
      .addText((text) =>
        text
          .setPlaceholder('0')
          .setValue(String(this.plugin.settings.autoRefreshInterval))
          .onChange(async (value) => {
            const interval = parseInt(value) || 0;
            this.plugin.settings.autoRefreshInterval = Math.max(0, interval);
            await this.plugin.saveSettings();
          })
      );

    // Task Markers Section
    containerEl.createEl('h2', { text: 'Task Markers' });
    containerEl.createEl('p', {
      text: 'Customize the checkbox markers used for different task states.',
      cls: 'setting-item-description',
    });

    // Task (incomplete)
    new Setting(containerEl)
      .setName('Incomplete Task')
      .setDesc('Marker for incomplete tasks')
      .addText((text) =>
        text
          .setPlaceholder('[ ]')
          .setValue(this.plugin.settings.taskMarkers.task)
          .onChange(async (value) => {
            this.plugin.settings.taskMarkers.task = value || '[ ]';
            await this.plugin.saveSettings();
          })
      );

    // Complete
    new Setting(containerEl)
      .setName('Completed Task')
      .setDesc('Marker for completed tasks')
      .addText((text) =>
        text
          .setPlaceholder('[x]')
          .setValue(this.plugin.settings.taskMarkers.complete)
          .onChange(async (value) => {
            this.plugin.settings.taskMarkers.complete = value || '[x]';
            await this.plugin.saveSettings();
          })
      );

    // Migrated
    new Setting(containerEl)
      .setName('Migrated Task')
      .setDesc('Marker for migrated tasks (moved to future log)')
      .addText((text) =>
        text
          .setPlaceholder('[>]')
          .setValue(this.plugin.settings.taskMarkers.migrated)
          .onChange(async (value) => {
            this.plugin.settings.taskMarkers.migrated = value || '[>]';
            await this.plugin.saveSettings();
          })
      );

    // Scheduled
    new Setting(containerEl)
      .setName('Scheduled Task')
      .setDesc('Marker for scheduled tasks (moved to calendar)')
      .addText((text) =>
        text
          .setPlaceholder('[<]')
          .setValue(this.plugin.settings.taskMarkers.scheduled)
          .onChange(async (value) => {
            this.plugin.settings.taskMarkers.scheduled = value || '[<]';
            await this.plugin.saveSettings();
          })
      );

    // Cancelled
    new Setting(containerEl)
      .setName('Cancelled Task')
      .setDesc('Marker for cancelled tasks')
      .addText((text) =>
        text
          .setPlaceholder('[-]')
          .setValue(this.plugin.settings.taskMarkers.cancelled)
          .onChange(async (value) => {
            this.plugin.settings.taskMarkers.cancelled = value || '[-]';
            await this.plugin.saveSettings();
          })
      );

    // Event
    new Setting(containerEl)
      .setName('Event')
      .setDesc('Marker for events (meetings, appointments)')
      .addText((text) =>
        text
          .setPlaceholder('[o]')
          .setValue(this.plugin.settings.taskMarkers.event)
          .onChange(async (value) => {
            this.plugin.settings.taskMarkers.event = value || '[o]';
            await this.plugin.saveSettings();
          })
      );

    // Help Section
    containerEl.createEl('h2', { text: 'Bullet Journal Quick Reference' });
    const helpDiv = containerEl.createDiv({ cls: 'bojo-help' });
    helpDiv.innerHTML = `
      <p><strong>Task Markers:</strong></p>
      <ul>
        <li><code>- [ ]</code> Incomplete task</li>
        <li><code>- [x]</code> Completed task</li>
        <li><code>- [>]</code> Migrated task (moved forward)</li>
        <li><code>- [<]</code> Scheduled task (moved to calendar)</li>
        <li><code>- [-]</code> Cancelled task</li>
        <li><code>- [o]</code> Event (meeting, appointment)</li>
      </ul>
      <p><strong>Metadata:</strong></p>
      <ul>
        <li><code>📅 YYYY-MM-DD</code> or <code>due:YYYY-MM-DD</code> - Due date</li>
        <li><code>⏳ YYYY-MM-DD</code> or <code>scheduled:YYYY-MM-DD</code> - Scheduled date</li>
        <li><code>➕ YYYY-MM-DD</code> or <code>created:YYYY-MM-DD</code> - Created date</li>
        <li><code>⏫</code> or <code>priority:high</code> - High priority</li>
        <li><code>🔼</code> or <code>priority:medium</code> - Medium priority</li>
        <li><code>🔽</code> or <code>priority:low</code> - Low priority</li>
        <li><code>🔁 every day</code> or <code>recur:daily</code> - Recurrence</li>
        <li><code>#tag</code> - Tags</li>
      </ul>
      <p><strong>Event Metadata:</strong></p>
      <ul>
        <li><code>🕐 14:30</code> or <code>@14:30</code> - Start time</li>
        <li><code>14:30-15:30</code> - Time range</li>
        <li><code>📍 Conference Room</code> or <code>location:Conference Room</code> - Location</li>
      </ul>
    `;
  }
}
