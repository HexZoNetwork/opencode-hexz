# HEXZ — OpenCode Upgrade Layer

A plugin for [OpenCode](https://opencode.ai) that adds anti-slop language rules, cybersecurity scanning, design scaffolding, web search, image handling, and a plugin marketplace.

## Features

- **Anti-Slop Engine** — Banned words, forced technical writing style, sentence variety rules
- **Security Scanner** — 7-module analysis (static, deps, data flow, architecture, blind spots, crypto, auth)
- **Design Scaffold** — Generate HTML/CSS mockups for web, mobile, dashboard, deck, email
- **Web Search** — DuckDuckGo integration for research before coding
- **Image Handler** — Analyze screenshots, error images, diagrams, mockups
- **Plugin Marketplace** — Install community plugins via GitHub or npm
- **Build Workflow** — Enforced research → plan → build → review → test cycle

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- [OpenCode](https://opencode.ai) installed

### Quick Install

```bash
# Clone the plugin
git clone https://github.com/opencode-community/opencode-hexz.git
cd opencode-hexz

# Install dependencies and build
bun install
bun run build

# Run the installer
./install.sh
```

The installer will prompt you to choose:
1. **Project-level** — Install to `.opencode/` in current directory
2. **Global** — Install to `~/.config/opencode/`
3. **Both** — Install everywhere

### Manual Install

```bash
# Copy the built plugin
mkdir -p ~/.config/opencode/plugins
cp dist/hexz.js ~/.config/opencode/plugins/hexz.js

# Add to opencode.json in your project root
echo '{"plugin": ["opencode-hexz"]}' > opencode.json
```

## Usage

### Activate HEXZ

In OpenCode, type:

```
/active
```

This engages the HEXZ upgrade layer with all modules loaded.

### Deactivate

```
/off
```

Reverts to default OpenCode behavior.

### Available Tools

| Tool | Description |
|------|-------------|
| `hexz_search` | Search the web via DuckDuckGo |
| `hexz_scan` | Security audit a file or directory |
| `hexz_design` | Generate design scaffolds |
| `hexz_image` | Analyze images (screenshots, errors, diagrams) |
| `hexz_mkp` | Install community plugins |

### Commands

```
/hexz_search "react hooks best practices"
/hexz_scan ./src
/hexz_design surface:web brief:"landing page"
/hexz_image path:screenshot.png
/hexz_mkp owner/repo
```

## Build Workflow

When HEXZ is active, every build follows this cycle:

1. **RESEARCH** — `hexz_search()` before writing code
2. **PLAN** — Architecture, data flow, routes, errors, edge cases
3. **BUILD** — Production code with error handling, validation, logging
4. **REVIEW** — Self-review for bugs, race conditions, secrets
5. **TEST** — Run the app, check crashes, confirm output

## Anti-Slop Rules

HEXZ enforces technical writing by banning filler words:

- Banned: pivotal, crucial, vital, robust, seamless, delve, leverage, utilize, ecosystem, paradigm, etc.
- Required: Contractions, varied sentence length (3-35 words), first-person when appropriate
- Forbidden: Compliments as openers, 3+ same-length sentences, lists with exactly 3 items

## Configuration

### opencode.json

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hexz"]
}
```

### TypeScript

The plugin is written in TypeScript. To modify:

```bash
# Edit source
vim src/hexz.ts

# Type check
bun run typecheck

# Build
bun run build
```

## Uninstall

```bash
./uninstall.sh
```

Or manually:

```bash
rm -f .opencode/plugins/hexz.js
rm -f ~/.config/opencode/plugins/hexz.js
```

## Development

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Build
bun run build

# Test locally
./install.sh .
```

## Security

The plugin includes input validation and sanitization:
- All user inputs are sanitized before use
- Git/npm commands validate package names
- Search queries are filtered for injection attempts

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Links

- [OpenCode](https://opencode.ai)
- [OpenCode Plugins](https://github.com/opencode-community)
- [Report Issues](https://github.com/opencode-community/opencode-hexz/issues)
