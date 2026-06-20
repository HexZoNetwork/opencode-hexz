<div align="center">

# HEXZ
### OpenCode Upgrade Layer

[![License](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-v1.5.0-blueviolet?style=flat-square)](https://github.com/hexzonetwork/opencode-hexz/releases)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20macOS%20%7C%20windows-orange?style=flat-square)](#)
[![Bun](https://img.shields.io/badge/runtime-bun-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)

A plugin for [OpenCode](https://opencode.ai) — anti-slop enforcement, 769+ cybersecurity skills, design scaffolding, web search, OCR, screenshots, MCP, persistent memory, and PR automation.

</div>

---

> [!WARNING]
> Recommended for **Linux**. Windows support via `install.bat` is experimental — contributions welcome.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Model Routing](#model-routing)
- [Cybersecurity Suite](#cybersecurity-suite)
- [Build Workflow](#build-workflow)
- [Anti-Slop Rules](#anti-slop-rules)
- [Configuration](#configuration)
- [Development](#development)
- [Uninstall](#uninstall)
- [Security](#security)

---

## Features

| | |
|---|---|
| **Anti-Slop Engine** | Banned filler words (delve, leverage, robust, etc.), forced technical writing, varied sentence structure |
| **Cybersecurity Suite** | 769+ skills across 15 domains with MITRE ATT&CK, NIST CSF 2.0, and OWASP Top 10 mappings |
| **Design Scaffold** | HTML/CSS mockups across 150+ design systems and 109+ templates |
| **Web Search** | DuckDuckGo integration — called before writing code |
| **Image OCR** | Text extraction from screenshots, errors, diagrams via tesseract.js |
| **Web Screenshots** | Full-page capture via Puppeteer, device emulation, custom CSS |
| **MCP Server Support** | Connect to Model Context Protocol servers for DB, filesystem, API access |
| **Plugin Marketplace** | Install community plugins from GitHub or npm |
| **Git PR Workflow** | Status, diff, and AI-generated pull request descriptions |
| **Persistent Memory** | Project context, preferences, and session summaries survive restarts |
| **Model Routing** | Per-task model routing (e.g. design → gpt-4o, scan → claude-3-opus) |
| **Build Workflow** | Enforced research → plan → simulate → build → scan → review cycle |

---

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- [OpenCode](https://opencode.ai) or [MiMo Code](https://mimo.xiaomi.com/mimocode/start) installed

### Quick Install

```bash
git clone https://github.com/hexzonetwork/opencode-hexz.git
cd opencode-hexz
bun install
bun run build
./install.sh
```

The installer prompts for an install target:

1. **Project-level** — `.opencode/` in current directory
2. **Global** — `~/.config/opencode/`
3. **Both**

For MiMo Code, add `--mimo` or `-mm`:

```bash
./install.sh --mimo        # project-level: .mimocode/tools/ + mimocode.json
./install.sh --mimo -g     # global: ~/.config/mimocode/
./install.sh -mm -b        # both
```

MiMo Code uses a native adapter, not the OpenCode hook plugin. It installs `hexz_status`, `hexz_doctor`, `hexz_scan`, `hexz_search`, `hexz_memory`, and `hexz_design` from `.mimocode/tools/hexz.ts` or `~/.config/mimocode/tools/hexz.ts`.

> [!IMPORTANT]
> The installer automatically downloads Chromium for Puppeteer (required by `hexz_webss`). This may take a moment.

### Manual Install

```bash
mkdir -p ~/.config/opencode/plugins
cp dist/hexz.js ~/.config/opencode/plugins/hexz.js
echo '{"plugin": ["opencode-hexz"]}' > opencode.json
```

---

## Usage

### Activate / Deactivate

```
/active     Engage HEXZ upgrade layer
/off        Revert to default OpenCode behavior
```

### Tools

| Tool | Description |
|---|---|
| `hexz_search` | Web search via DuckDuckGo — call before writing code |
| `hexz_scan` | Security audit: injection, XSS, secrets, dependency vulns, CVSS v3.1 |
| `hexz_design` | Generate HTML/CSS mockups from a brief |
| `hexz_image` | OCR text extraction from screenshots, errors, diagrams |
| `hexz_webss` | Website screenshots via Puppeteer |
| `hexz_cyber` | Cybersecurity skills (769+) + framework mappings |
| `hexz_mcp` | MCP server management — connect/discover/call |
| `hexz_memory` | Persistent agent memory — get/set/list/clear |
| `hexz_pr` | Git PR workflow — status, diff, create with AI descriptions |
| `hexz_mkp` | Plugin marketplace — install from GitHub or npm |
| `hexz_status` | Show active/inactive, uptime, search count |
| `hexz_doctor` | Check runtime, scanner, browser, git, and safety readiness |
| `hexz_sim` | Simulation sandbox — call before destructive actions |
| `hexz_codebase` | Scan project, generate `codebase.md` with file connections |

### Commands

```
/hexz_search "react hooks best practices"
/hexz_scan ./src
/hexz_design surface:web brief:"landing page"
/hexz_image path:screenshot.png
/hexz_webss url=https://example.com output=screenshot.png fullPage=true
/hexz_cyber domain=recon
/hexz_cyber framework=mitre
/hexz_mcp action=connect server=http://localhost:3000
/hexz_memory action=set key=project_context value="React app"
/hexz_pr action=create title="feat: add dark mode"
/hexz_mkp owner/repo
/hexz_doctor
/models     Model routing TUI
```

---

## Model Routing

Per-task model routing via the interactive Question calls

**Default: no routing** (single model passthrough).

```bash
/route     # Opens the route menu
```

| Keywords | Model |
|---|---|
| `design, ui, mockup` | gpt-4o |
| `scan, security, audit` | claude-4-8-opus |
| `cyber, exploit, malware` | claude-4-6-sonnet |

```
hexz_memory action=get key=model_routes
hexz_memory action=set key=model_routes value='[{"model":"gpt-4o","keywords":"design,ui"}]'
```

---

## Cybersecurity Suite

769+ skills from two curated collections.

**Cyber Skills Domains** (15 domains) — `src/cybersecurity/skills/`

| Domain | Topics |
|---|---|
| Recon & OSINT | Subdomain enum, DNS analysis, tech fingerprinting |
| Vulnerability Scanning | CVSS calculator, config auditing, dependency auditing |
| Exploit Development | Payload generation, buffer overflow analysis |
| Reverse Engineering | Binary analysis, firmware RE |
| Malware Analysis | YARA rules, sandboxing, static/dynamic analysis |
| Threat Hunting | IOC analysis, Sigma rules, MITRE mapping |
| Incident Response | Memory forensics, timeline reconstruction |
| Network Security | PCAP analysis, Snort/Suricata rules, firewall auditing |
| Web Security | OWASP Top 10, API testing, JWT analysis |
| Cloud Security | AWS/Azure/GCP audits, container hardening, K8s |
| CSOC Automation | Playbook automation, triage, escalation |
| Log Analysis | SIEM, Splunk KQL, anomaly detection |
| Crypto Analysis | TLS audit, cipher analysis, key assessment |
| Red Team Ops | C2 infrastructure, AD abuse, social engineering |
| Blue Team Defense | Hardening, detection engineering, patching |

**Cyber Skills** (754 specialized skills) — `src/cybersecurity/skills-mukul/`

Forensics (disk, memory, browser, mobile), cloud security (AWS, Azure, GCP, K8s, Docker), malware analysis (Android, ELF, Go, PowerShell), network analysis (DNS, C2, PCAP), AD abuse, IoT/SCADA, phishing analysis, and more.

**Framework Mappings** — `src/cybersecurity/mappings/`

- **MITRE ATT&CK** — Navigator layer (v4.5, Enterprise v14), 218 techniques across 14/14 tactics
- **NIST CSF 2.0** — Full alignment: Govern, Identify, Protect, Detect, Respond, Recover
- **OWASP Top 10** — A01–A10 with detailed mappings

```bash
hexz_cyber domain=recon          # Load Recon & OSINT skill
hexz_cyber domain=malware        # Load Malware Analysis skill
hexz_cyber framework=mitre       # Show MITRE ATT&CK coverage
hexz_cyber framework=nist        # Show NIST CSF 2.0 alignment
hexz_cyber query=forensics       # Search all skills for forensics
hexz_cyber list=true             # List all 769+ available skills
```

---

## Build Workflow

When HEXZ is active, every build follows this cycle:

| Step | Action |
|---|---|
| 1. Research | `hexz_search()` before writing code |
| 2. Plan | Architecture, data flow, routes, errors, edge cases |
| 3. Simulate | `hexz_sim()` before destructive actions (Write/Edit/rm/mv/cp) |
| 4. Build | Production code with error handling, validation, logging |
| 5. Scan | `hexz_scan()` for security vulnerabilities |
| 6. Review | Self-review for bugs, race conditions, secrets |

> [!IMPORTANT]
> Destructive actions (Write, Edit, rm, mv, cp) are **blocked** unless a simulation is created first via `hexz_sim()`.

---

## Anti-Slop Rules

HEXZ enforces technical writing by eliminating AI-tell patterns.

- **Banned** — pivotal, crucial, vital, robust, seamless, delve, leverage, utilize, ecosystem, paradigm, etc.
- **Required** — Contractions, varied sentence length (3–35 words), first-person when appropriate
- **Forbidden** — Compliments as openers, 3+ same-length sentences, lists with exactly 3 items

---

## Configuration

### opencode.json

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hexz"]
}
```

### Data Storage

HEXZ persists data to `~/.config/opencode/hexz-memory.json`:

- Active state, search count, session count
- Model routing config (routes + enabled/disabled)
- Project context and session summaries

---

## Development

```bash
git clone https://github.com/hexzonetwork/opencode-hexz.git
cd opencode-hexz
bun install

bun run typecheck    # TypeScript check
bun run build        # Build dist/hexz.js
bun test             # Run tests
bun run lint         # Biome lint

./install.sh .       # Test locally
```

---

## Uninstall

```bash
./uninstall.sh
./uninstall.sh --mimo
# Or manually:
rm -rf .opencode/plugins/hexz
rm -rf ~/.config/opencode/plugins/hexz
rm -f .mimocode/tools/hexz.ts
rm -f ~/.config/mimocode/tools/hexz.ts
```

---

## Security

- All user inputs are sanitized before use
- Git/npm commands validate package names
- Search queries are filtered for injection attempts
- Secrets are redacted from tool output (API keys, tokens, passwords, private keys)

---

<div align="center">

**[MIT License](LICENSE)** · [OpenCode](https://opencode.ai) · [Report Issues](https://github.com/hexzonetwork/opencode-hexz/issues) · [Contribute](CONTRIBUTING.md)

</div>
