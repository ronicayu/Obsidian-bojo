# Bullet Journal Todo Plugin for Obsidian

A plugin that helps you organize your todo list using the Bullet Journal methodology. It consolidates tasks from files or folders you specify and allows you to perform typical bullet journal actions.

## Features

### Task Collection

- **Consolidate todos** from specified folders or individual files
- **Filter and search** through all your tasks

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

### Task Metadata

Support for rich task metadata:

- **Due dates**: `📅 2024-01-15` or `due:2024-01-15`
- **Scheduled dates**: `⏳ 2024-01-15` or `scheduled:2024-01-15`
- **Created dates**: `➕ 2024-01-15` or `created:2024-01-15`
- **Priority**: `⏫` (high), `🔼` (medium), `🔽` (low)
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

**Requirements:** The core plugin **Daily notes** must be enabled (Settings → Core plugins → Daily notes).

This plugin is not on Obsidian’s community list yet. Install it manually from GitHub:

1. Go to the [Releases](https://github.com/ronicayu/Obsidian-bojo/releases) page and download the latest `obsidian-bojo-*.zip`.
2. Extract the zip so that `main.js`, `manifest.json`, and `styles.css` are inside a folder named `obsidian-bojo`.
3. Copy the `obsidian-bojo` folder into your vault at `.obsidian/plugins/`.
4. In Obsidian, open **Settings** → **Community Plugins** and enable **Bullet Journal Todo**.

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build
```

### Pushing code

- **Remote:** `origin` → `https://github.com/ronicayu/Obsidian-bojo.git`
- **Push current branch:** `git push` (or `git push -u origin <branch>` first time for a new branch)
- **Push main:** `git checkout main && git push -u origin main` (then set **main** as default branch in GitHub repo Settings if needed)

If push fails with authentication errors, use a [GitHub personal access token](https://github.com/settings/tokens) (HTTPS) or set up [SSH keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) and switch the remote to `git@github.com:ronicayu/Obsidian-bojo.git`.

## Releasing

Releases are built automatically when you push a version tag. Others can download the plugin from the **Releases** page of this repo on GitHub.

1. Bump version in `package.json` and `manifest.json` (e.g. to `1.0.1`).
2. Commit, then create and push a tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. GitHub Actions will build the plugin and create a release with a downloadable `obsidian-bojo-1.0.1.zip`. You can add release notes in the GitHub Releases UI.

## Bullet Journal Quick Reference

The Bullet Journal method uses rapid logging with specific signifiers:

| Symbol  | Meaning                       |
| ------- | ----------------------------- |
| `- [ ]` | Task (incomplete)             |
| `- [x]` | Task complete                 |
| `- [>]` | Task migrated (moved forward) |
| `- [<]` | Task scheduled (in calendar)  |
| `- [-]` | Task cancelled                |
| `- [o]` | Event (meeting, appointment)  |

### Migration

When reviewing tasks, if a task wasn't completed:

- **Migrate (>)**: Move it to a specific date
- **Schedule (<)**: Move it to a specific date

### Priority Signifiers

- `⏫` High priority
- `🔼` Medium priority
- `🔽` Low priority

## License

MIT
