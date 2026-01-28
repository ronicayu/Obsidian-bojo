# Bullet Journal Todo Plugin for Obsidian

A plugin that helps you organize your todo list using the Bullet Journal methodology. It consolidates tasks from files or folders you specify and allows you to perform typical bullet journal actions.

## Features

### Task Collection
- **Consolidate todos** from specified folders or individual files
- **Filter and search** through all your tasks
- **Group tasks** by file, folder, status, due date, priority, or tags

### Bullet Journal Actions
- **Complete** (`[x]`) - Mark a task as done
- **Migrate** (`[>]`) - Move a task forward to a future log
- **Schedule** (`[<]`) - Move a task to your calendar
- **Cancel** (`[-]`) - Mark a task as cancelled/irrelevant
- **Event** (`[o]`) - Mark as an event (meeting, appointment)

### Events (Meetings)
Track events like meetings and appointments with:
- **Time**: `🕐 14:30` or `@14:30` or time ranges like `14:30-15:30`
- **Location**: `📍 Conference Room` or `location:Conference Room`
- Events are displayed with their time prominently shown
- Filter events on/off in the view

### Task Metadata
Support for rich task metadata:
- **Due dates**: `📅 2024-01-15` or `due:2024-01-15`
- **Scheduled dates**: `⏳ 2024-01-15` or `scheduled:2024-01-15`
- **Created dates**: `➕ 2024-01-15` or `created:2024-01-15`
- **Priority**: `⏫` (high), `🔼` (medium), `🔽` (low)
- **Recurrence**: `🔁 every day` or `recur:daily`
- **Tags**: `#project` `#work`

## Usage

### Task Syntax

```markdown
- [ ] Incomplete task
- [x] Completed task
- [>] Migrated task
- [<] Scheduled task
- [-] Cancelled task
- [o] Event (meeting, appointment)

- [ ] Task with due date 📅 2024-01-15
- [ ] High priority task ⏫
- [ ] Task with tags #project #urgent
- [ ] Combined: Important meeting ⏫ 📅 2024-01-20 #work
```

### Event Syntax

```markdown
- [o] Team standup 09:00-09:30 📍 Zoom
- [o] Client meeting 🕐 14:00 📍 Conference Room A #client
- [o] Lunch with John @12:30 📍 Cafe
- [o] Project review 15:00-16:30 📅 2024-01-20
```

### Commands

Access these commands via the command palette (Ctrl/Cmd + P):

- **Open Bullet Journal Todo View** - Opens the consolidated todo panel
- **Toggle Task Complete** - Toggle completion on the current line
- **Migrate Task (>)** - Mark task as migrated
- **Schedule Task (<)** - Mark task as scheduled
- **Cancel Task (-)** - Mark task as cancelled
- **Add Task Due Today** - Insert a new task with today's due date
- **Add High Priority Task** - Insert a new high priority task
- **Convert to Event (o)** - Convert current line to an event
- **Insert Event** - Insert a new event
- **Insert Event with Time** - Insert a new event with current time
- **Refresh Bullet Journal Todo View** - Manually refresh the view
- **Add Current Folder to Todo Sources** - Quick add folder to sources
- **Add Current File to Todo Sources** - Quick add file to sources

### Configuration

1. Open Settings → Bullet Journal Todo
2. Add folders or files to scan for tasks
3. Configure display options (sort order, grouping, etc.)
4. Customize task markers if needed

## Installation

### From Obsidian Community Plugins
1. Open Settings → Community Plugins
2. Search for "Bullet Journal Todo"
3. Click Install, then Enable

### Manual Installation
1. Download the latest release
2. Extract to your vault's `.obsidian/plugins/obsidian-bojo/` folder
3. Enable the plugin in Settings → Community Plugins

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build
```

## Bullet Journal Quick Reference

The Bullet Journal method uses rapid logging with specific signifiers:

| Symbol | Meaning |
|--------|---------|
| `- [ ]` | Task (incomplete) |
| `- [x]` | Task complete |
| `- [>]` | Task migrated (moved forward) |
| `- [<]` | Task scheduled (in calendar) |
| `- [-]` | Task cancelled |
| `- [o]` | Event (meeting, appointment) |

### Migration
When reviewing tasks, if a task wasn't completed:
- **Migrate (>)**: Move it to next month/week's log
- **Schedule (<)**: Move it to a specific date in your calendar

### Priority Signifiers
- `⏫` High priority
- `🔼` Medium priority
- `🔽` Low priority

## License

MIT
