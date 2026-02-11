# Terry CLI

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@terragon-labs/cli)

[npm]: https://img.shields.io/npm/v/@terragon-labs/cli.svg?style=flat-square

The official CLI for Terragon Labs - your AI-powered coding assistant.

## Installation

```bash
# Using npm
npm install -g @terragon-labs/cli

# Using pnpm
pnpm add -g @terragon-labs/cli

# Using yarn
yarn global add @terragon-labs/cli
```

## Commands

### `terry auth`

Authenticate with your Terragon account. This will:

1. Open your browser for authentication
2. Generate a secure token
3. Store credentials safely in `~/.terry/config.json` (configurable via `TERRY_SETTINGS_DIR`)
4. Confirm successful connection

```bash
terry auth
```

#### Configuration directory

By default, credentials are stored in `~/.terry/config.json`. You can override the settings directory by setting the `TERRY_SETTINGS_DIR` environment variable:

```bash
# Example: use a custom settings directory
export TERRY_SETTINGS_DIR=~/.config/terry
terry auth
```

### `terry create`

Create a new task in Terragon with a message:

```bash
# Create a task in the current repository and branch
terry create "Fix the login bug"

# Specify a different repository
terry create "Add new feature" --repo owner/repo

# Use a specific base branch
terry create "Update documentation" --branch develop

# Use existing branch without creating a new one
terry create "Quick fix" --no-new-branch

# Start in plan mode (no file writes until approval)
terry create "Refactor the auth module" --mode plan

# Choose a specific model
terry create "Investigate flaky tests" --model sonnet
terry create "Run large codegen" --model gpt-5-high
> GPT-5.1 Codex Max variants require a ChatGPT subscription connected in Settings.
```

#### Options

- `-r, --repo <repo>`: GitHub repository (default: current repository)
- `-b, --branch <branch>`: Base branch name (default: current branch, falls back to main)
- `--no-new-branch`: Don't create a new branch (default: creates new branch)
- `-m, --mode <mode>`: Task mode: `plan` or `execute` (default: `execute`)
- `-M, --model <model>`: AI model to use: `opus`, `sonnet`, `haiku`, `amp`, `gpt-5-low`, `gpt-5-medium`, `gpt-5`, `gpt-5-high`, `gpt-5.2-low`, `gpt-5.2-medium`, `gpt-5.2`, `gpt-5.2-high`, `gpt-5.1-low`, `gpt-5.1-medium`, `gpt-5.1`, `gpt-5.1-high`, `gpt-5.1-codex-max-low`, `gpt-5.1-codex-max-medium`, `gpt-5.1-codex-max`, `gpt-5.1-codex-max-high`, `gpt-5.1-codex-max-xhigh`, `gpt-5-codex-low`, `gpt-5-codex-medium`, `gpt-5-codex-high`, `gpt-5.1-codex-low`, `gpt-5.1-codex-medium`, `gpt-5.1-codex-high`, `gemini-3-pro`, `gemini-2.5-pro`, `grok-code`, `qwen3-coder`, `kimi-k2`, `glm-4.6`, `opencode/gemini-2.5-pro` (optional)

### `terry pull`

Pull tasks from Terragon to your local machine:

```bash
# Interactive mode - select from recent tasks
terry pull

# Pull a specific task by ID
terry pull <taskId>

# Pull and automatically launch Claude Code
terry pull <taskId> --resume
```

**Getting the task ID**: You can find the task ID at the end of the URL when viewing a task in Terragon. For example, in `https://terragonlabs.com/tasks/abc123-def456`, the task ID is `abc123-def456`.

#### Options

- `-r, --resume`: Automatically launch Claude Code after pulling

### `terry list`

List all tasks in a non-interactive format:

```bash
# List all tasks (automatically filters by current repo when inside a Git repository)
terry list
```

#### Example Output

```
Task ID         abc123def456
Name            Fix login bug
Branch          terragon/fix-login
Repository      myorg/myrepo
PR Number       #123

Task ID         def789ghi012
Name            Add dark mode
Branch          terragon/dark-mode
Repository      myorg/myrepo
PR Number       N/A

Total: 2 tasks
```

### `terry insights`

View your usage statistics and insights from the Terragon platform:

```bash
# View last 7 days of usage statistics
terry insights

# View last 30 days
terry insights --days 30

# Specify a timezone for date calculations
terry insights --timezone America/New_York
```

#### Options

- `-d, --days <days>`: Number of days to show (1-30, default: 7)
- `-t, --timezone <timezone>`: Timezone for date calculations (default: your system timezone)

#### What's Included

- **Activity Summary**: Total threads created and PRs merged
- **Token Usage**: Input, output, cached, and cache creation tokens
- **Cost Breakdown**: Costs by provider (Anthropic, OpenAI, Google, OpenRouter)
- **Credit Balance**: Current balance and spend in the period
- **Daily Stats**: Day-by-day breakdown of threads and PRs

### `terry local-insights`

Analyze local session data and generate a comprehensive HTML insights report, similar to Claude Code's `/insights` command:

```bash
# Analyze sessions from the last 30 days
terry local-insights

# Analyze sessions from the last 7 days
terry local-insights --days 7

# Save report to a custom location
terry local-insights --output ~/my-report.html
```

#### Options

- `-d, --days <days>`: Number of days to analyze (default: 30)
- `-o, --output <path>`: Custom output path for HTML report (default: `~/.terry/usage-data/local-report.html`)

#### What's Included

This command analyzes session transcripts stored in `~/.claude/projects/` (created when you run `terry pull`) and generates a detailed HTML report with:

- **Goal Classification**: What tasks were you trying to accomplish?
- **Outcome Tracking**: Success, partial success, failure, or unknown
- **Satisfaction Analysis**: User satisfaction levels across sessions
- **Friction Detection**: Common friction points and blockers
- **Session Summaries**: AI-generated summaries of each session

#### Requirements

Set the `ANTHROPIC_API_KEY` environment variable to enable AI-powered analysis:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
terry local-insights
```

Without an API key, the command will still generate a report but with limited analysis.

#### Caching

Facet data is cached in `~/.terry/usage-data/facets/` to avoid re-analyzing the same sessions on subsequent runs, saving API costs and time.

### `terry mcp`

Run an MCP (Model Context Protocol) server for the git repository:

```bash
# Run MCP server for current directory
terry mcp
```

#### Claude Code Integration

You can add the Terry MCP server to your local Claude Code instance to enable direct interaction with Terragon tasks from within Claude:

```bash
claude mcp add terry -- terry mcp
```

This integration provides Claude Code with the following capabilities:

- **`terry_list`**: List all your Terragon tasks directly from Claude
- **`terry_create`**: Create new tasks without leaving Claude Code
- **`terry_pull`**: Pull task session data to continue work

The MCP server acts as a bridge between Claude Code and Terragon, allowing you to manage tasks using natural language commands within your AI coding sessions.

## Support

- **Documentation**: [https://beta.gatewayz.ai/inbox/docs](https://beta.gatewayz.ai/inbox/docs)
- **Website**: [https://beta.gatewayz.ai](https://beta.gatewayz.ai)
