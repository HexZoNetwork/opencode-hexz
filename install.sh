#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -t 1 ]; then
  BOLD="\033[1m"
  DIM="\033[2m"
  GREEN="\033[0;32m"
  CYAN="\033[0;36m"
  YELLOW="\033[0;33m"
  RED="\033[0;31m"
  RESET="\033[0m"
  HAS_TTY=true
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" RESET=""
  HAS_TTY=false
fi

ok() { echo -e "  ${GREEN}✓${RESET} $1"; }
warn() { echo -e "  ${YELLOW}!${RESET} $1"; }
fail() { echo -e "  ${RED}✗${RESET} $1"; }

progress() {
  local cur=$1 total=$2 label="${3:-}"
  local pct=$((cur * 100 / total))
  local width=30
  local filled=$((cur * width / total))
  local empty=$((width - filled))
  local bar=""
  local i
  for ((i=0;i<filled;i++)); do bar+="█"; done
  for ((i=0;i<empty;i++)); do bar+="░"; done
  local c="$GREEN"
  [ "$pct" -lt 33 ] && c="$RED"
  [ "$pct" -ge 33 ] && [ "$pct" -lt 66 ] && c="$YELLOW"
  printf "  ${c}%s${RESET} ${BOLD}%3d%%${RESET}" "$bar" "$pct"
  [ -n "$label" ] && printf "  ${DIM}%s${RESET}" "$label"
  echo ""
}

section() {
  echo ""
  echo -e "  ${BOLD}${CYAN}── $1 ──${RESET}"
  echo ""
}

# ─── Banner ───
banner() {
  local runtime="$1"
  local title="HEXZ"
  local sub
  if [ "$runtime" = "mimo" ]; then
    sub="MiMo Code"
  elif [ "$runtime" = "codex" ]; then
    sub="OpenAI Codex"
  elif [ "$runtime" = "claude" ]; then
    sub="Claude Code"
  else
    sub="OpenCode"
  fi

  echo ""
  if [ "$HAS_TTY" = true ]; then
    # Typewrite logo
    local logo=(
      '  ██╗  ██╗███████╗██╗  ██╗███████╗'
      '  ██║  ██║██╔════╝╚██╗██╔╝╚══███╔╝'
      '  ███████║█████╗   ╚███╔╝   ███╔╝ '
      '  ██╔══██║██╔══╝   ██╔██╗  ███╔╝  '
      '  ██║  ██║███████╗██╔╝ ██╗███████╗'
      '  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝'
    )
    for line in "${logo[@]}"; do
      printf "  "
      for ((i=0;i<${#line};i++)); do
        printf "${CYAN}%s${RESET}" "${line:$i:1}"
        sleep 0.005
      done
      echo ""
    done
    echo -e "  ${DIM}── ${sub} ──${RESET}"
  else
    echo "  $title — $sub"
  fi
  echo ""
}

usage() {
  cat <<EOF
${BOLD}HEXZ — OpenCode, Codex, Claude Code & MiMo Code Upgrade Layer${RESET}

${BOLD}Usage:${RESET}
  ./install.sh [OPTIONS] [DIRECTORY]

${BOLD}Options:${RESET}
  -g, --global     Install to ~/.config/opencode/ only
  -p, --project    Install to ./.opencode/ only (default)
  -b, --both       Install globally and locally
  -mm, --mimo      Install for MiMo Code (.mimocode / ~/.config/mimocode)
  -cx, --codex     Install for OpenAI Codex (.codex-plugin/)
  -cc, --claude    Install for Claude Code (.claude-plugin/)
  -y, --yes        Accept all defaults, no prompts
  --install-bun    If bun is missing, install it with Bun's official install script
  -h, --help       Show this help
  -v, --version    Show plugin version

${BOLD}Examples:${RESET}
  ./install.sh
  ./install.sh -g
  ./install.sh --codex -g
  ./install.sh --claude -g
  ./install.sh /my/project -y
  ./install.sh -b
EOF
}

VERSION=$(grep '"version"' "$SCRIPT_DIR/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
MODE=""
AUTO_YES=false
INSTALL_BUN=false
DEST=""
RUNTIME="opencode"

while [ $# -gt 0 ]; do
  case "$1" in
    -g|--global)   MODE="global";  shift ;;
    -p|--project)  MODE="project"; shift ;;
    -b|--both)     MODE="both";    shift ;;
    -mm|--mimo)    RUNTIME="mimo"; shift ;;
    -cx|--codex)   RUNTIME="codex"; shift ;;
    -cc|--claude)  RUNTIME="claude"; shift ;;
    -y|--yes)      AUTO_YES=true;  shift ;;
    --install-bun) INSTALL_BUN=true; shift ;;
    -h|--help)     usage; exit 0 ;;
    -v|--version)  grep '"version"' "$SCRIPT_DIR/package.json" | head -1; exit 0 ;;
    *)             fail "Unknown flag: $1"; usage; exit 1 ;;
  esac
done

DEST="${DEST:-.}"

banner "$RUNTIME"

preflight_bun() {
  if command -v bun &>/dev/null; then
    ok "bun $(bun --version)"
    return 0
  fi
  if [ "$INSTALL_BUN" = false ]; then
    fail "bun not found."
    echo "  Install Bun first: https://bun.sh/docs/installation"
    echo "  Or rerun with --install-bun to use Bun's official remote install script."
    exit 1
  fi
  warn "bun not found. Installing with Bun's official remote script..."
  if command -v curl &>/dev/null; then
    curl -fsSL https://bun.sh/install | bash
  elif command -v wget &>/dev/null; then
    wget -qO- https://bun.sh/install | bash
  else
    fail "Cannot install bun: no curl or wget found."
    echo "  Install manually: https://bun.sh"
    exit 1
  fi
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun &>/dev/null; then
    fail "bun installation failed."
    echo "  Restart your shell or run: source ~/.bashrc"
    exit 1
  fi
  ok "bun $(bun --version) installed"
}

preflight_git() {
  if command -v git &>/dev/null; then
    ok "git $(git --version | awk '{print $3}')"
    return 0
  fi
  warn "git not found. Some features need git."
  echo "  Install: sudo apt install git"
}

preflight_puppeteer() {
  if command -v chromium-browser &>/dev/null || command -v chromium &>/dev/null || command -v google-chrome &>/dev/null; then
    ok "Chromium/Chrome detected for Puppeteer"
    return 0
  fi
  warn "Chromium not found. hexz_webss requires it."
  echo "  Install: sudo apt install chromium-browser"
  echo "  Or: npx puppeteer browsers install chrome"
}
preflight_python_audit() {
  if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo -e "  ${DIM}· python3 not found — skipping semgrep/pip-audit (install python3 for security scanning)${RESET}"
    return 0
  fi
  local pip="pip3"
  command -v pip3 &>/dev/null || pip="pip"
  if ! command -v "$pip" &>/dev/null; then
    echo -e "  ${DIM}· pip not found — skipping semgrep/pip-audit (install pip for security scanning)${RESET}"
    return 0
  fi
  if command -v semgrep &>/dev/null; then
    ok "semgrep $(semgrep --version 2>/dev/null || echo 'installed')"
  else
    echo -e "  ${DIM}  Installing semgrep via pip...${RESET}"
    "$pip" install semgrep --quiet 2>/dev/null && ok "semgrep installed" || warn "semgrep install failed — hexz_scan static analysis unavailable"
  fi
  if command -v pip-audit &>/dev/null; then
    ok "pip-audit installed"
  else
    echo -e "  ${DIM}  Installing pip-audit via pip...${RESET}"
    "$pip" install pip-audit --quiet 2>/dev/null && ok "pip-audit installed" || warn "pip-audit install failed — hexz_scan dependency scanning unavailable"
  fi
}

preflight_node() {
  if command -v node &>/dev/null; then
    ok "node $(node --version)"
  else
    echo -e "  ${DIM}· node not found (optional)${RESET}"
  fi
}
preflight_docker() {
  if command -v docker &>/dev/null; then
    local dv
    dv=$(docker --version 2>/dev/null | head -1)
    ok "docker ${dv:-detected}"
    echo -e "  ${DIM}  Pulling searxng/searxng image (background)...${RESET}"
    docker pull searxng/searxng &>/dev/null &
  else
    echo -e "  ${DIM}· docker not found, attempting auto-install...${RESET}"
    if command -v curl &>/dev/null; then
      curl -fsSL https://get.docker.com | sh &>/dev/null && ok "docker installed via get.docker.com" || warn "Docker auto-install failed — install manually: https://docs.docker.com/get-docker/"
    elif command -v wget &>/dev/null; then
      wget -qO- https://get.docker.com | sh &>/dev/null && ok "docker installed via get.docker.com" || warn "Docker auto-install failed — install manually: https://docs.docker.com/get-docker/"
    else
      warn "Docker auto-install skipped (no curl or wget). Install manually: https://docs.docker.com/get-docker/"
    fi
    if command -v docker &>/dev/null; then
      echo -e "  ${DIM}  Pulling searxng/searxng image (background)...${RESET}"
      docker pull searxng/searxng &>/dev/null &
    fi
  fi
}

section "Preflight"
preflight_bun
preflight_git
preflight_node
preflight_puppeteer
preflight_python_audit
preflight_docker

section "Building"

if [ ! -f "$SCRIPT_DIR/package.json" ]; then
  fail "package.json not found in $SCRIPT_DIR"
  exit 1
fi

step=0; total=4

# Step 1
echo -ne "  Installing dependencies..."
if ! bun install --cwd "$SCRIPT_DIR" --frozen-lockfile 2>/dev/null; then
  printf "\r\033[K"
  warn "Lockfile mismatch, reinstalling..."
  echo -ne "  Reinstalling dependencies..."
  bun install --cwd "$SCRIPT_DIR" || { printf "\r\033[K"; fail "bun install failed"; exit 1; }
fi
printf "\r\033[K"
step=$((step + 1))
ok "Dependencies installed"
progress $step $total

# Step 2
echo -ne "  Building dist/hexz.js..."
if ! bun run --cwd "$SCRIPT_DIR" build 2>&1; then
  printf "\r\033[K"
  fail "Build failed. Check: bun run typecheck"
  exit 1
fi
printf "\r\033[K"
step=$((step + 1))
ok "Build complete"
progress $step $total

# Step 3
if [ ! -f "$SCRIPT_DIR/dist/hexz.js" ]; then
  fail "dist/hexz.js not found after build"
  exit 1
fi
SIZE=$(wc -c < "$SCRIPT_DIR/dist/hexz.js" | tr -d ' ')
step=$((step + 1))
ok "dist/hexz.js verified ${DIM}($SIZE bytes)${RESET}"
progress $step $total

# Step 4
if [ "$RUNTIME" = "mimo" ] && [ ! -f "$SCRIPT_DIR/dist/hexz-mimo.js" ]; then
  fail "dist/hexz-mimo.js not found — MiMo adapter not built"
  exit 1
fi
if [ "$RUNTIME" = "codex" ] && [ ! -f "$SCRIPT_DIR/dist/hexz-codex.js" ]; then
  fail "dist/hexz-codex.js not found — Codex adapter not built"
  exit 1
fi
if [ "$RUNTIME" = "claude" ] && [ ! -f "$SCRIPT_DIR/dist/hexz-claude.js" ]; then
  fail "dist/hexz-claude.js not found — Claude adapter not built"
  exit 1
fi
step=$((step + 1))
ok "All checks passed"
progress $step $total

# ─── Install target ───
if [ -z "$MODE" ]; then
  if [ "$AUTO_YES" = true ]; then
    MODE="project"
  else
    section "Target"
    local dir_label=".opencode/"
    if [ "$RUNTIME" = "mimo" ]; then dir_label=".mimocode/"; fi
    if [ "$RUNTIME" = "codex" ]; then dir_label=".codex-plugin/"; fi
    if [ "$RUNTIME" = "claude" ]; then dir_label=".claude-plugin/"; fi
    local global_label="~/.config/opencode/"
    if [ "$RUNTIME" = "mimo" ]; then global_label="~/.config/mimocode/"; fi
    if [ "$RUNTIME" = "codex" ]; then global_label="~/.config/codex/"; fi
    if [ "$RUNTIME" = "claude" ]; then global_label="~/.config/claude/"; fi
    echo "  1) Project-level  →  ./${dir_label}"
    echo "  2) Global          →  ${global_label}"
    echo "  3) Both"
    echo ""
    read -rp "  Choose [1-3] (default: 1): " choice
    choice="${choice:-1}"
    case "$choice" in
      1) MODE="project" ;;
      2) MODE="global" ;;
      3) MODE="both" ;;
      *) fail "Invalid choice."; exit 1 ;;
    esac
  fi
fi

install_to() {
  local dest="$1" label="$2" runtime="${3:-opencode}"
  local plugdir="$dest/plugins"
  local hexzdir="$plugdir/hexz"

  mkdir -p "$hexzdir" "$dest/commands"

  cp "$SCRIPT_DIR/dist/hexz.js" "$hexzdir/index.js"
  cp "$SCRIPT_DIR/src/hexz.ts" "$hexzdir/index.ts"
  cp "$SCRIPT_DIR/src/shared.ts" "$hexzdir/shared.ts"
  [ -d "$SCRIPT_DIR/src/design" ] && cp -r "$SCRIPT_DIR/src/design" "$hexzdir/design"
  [ -d "$SCRIPT_DIR/src/cybersecurity" ] && cp -r "$SCRIPT_DIR/src/cybersecurity" "$hexzdir/cybersecurity"

  cat > "$hexzdir/package.json" << 'PKGEOF'
{
  "type": "module",
  "dependencies": {
    "capture-website": "^4.0.0",
    "tesseract.js": "^5.1.0"
  }
}
PKGEOF

  (cd "$hexzdir" && PUPPETEER_SKIP_DOWNLOAD=true npm install --no-save --legacy-peer-deps >/dev/null 2>&1) && ok "Installed optional deps" || warn "npm install failed — hexz_webss/hexz_image may be unavailable"

  if [ "$runtime" = "mimo" ]; then
    cat > "$plugdir/package.json" << 'PKGEOF'
{
  "name": "mimocode-hexz",
  "version": "1.5.2",
  "type": "module",
  "main": "index.ts"
}
PKGEOF
    cat > "$plugdir/index.ts" << 'TSEOF'
let initialized = false;
let hooks: any = null;
const init = async (input: any) => {
  if (initialized) return hooks || {};
  initialized = true;
  const mod = await import("./hexz/index.js");
  const fn = mod.default || mod.HexzPlugin || mod;
  if (typeof fn === "function") hooks = (await fn(input)) || {};
  else hooks = {};
  return hooks;
};
const HexzPlugin: any = (input: any) => init(input);
export default HexzPlugin;
export const server = HexzPlugin;
TSEOF
  else
    cat > "$plugdir/package.json" << 'PKGEOF'
{
  "name": "opencode-hexz",
  "version": "1.5.2",
  "type": "module",
  "main": "index.ts",
  "dependencies": {
    "@opencode-ai/plugin": "latest"
  }
}
PKGEOF
    cat > "$plugdir/index.ts" << 'TSEOF'
let initialized = false;
let hooks: any = null;
const init = async (input: any) => {
  if (initialized) return hooks || {};
  initialized = true;
  const mod = await import("./hexz/index.ts");
  const fn = mod.default || mod.HexzPlugin || mod;
  if (typeof fn === "function") hooks = (await fn(input)) || {};
  else hooks = {};
  return hooks;
};
const HexzPlugin: any = (input: any) => init(input);
export default HexzPlugin;
export const server = HexzPlugin;
TSEOF
  fi

  cat > "$dest/commands/active.md" << 'EOF'
---
description: Engage HEXZ upgrade layer
---
HEXZ_ACTIVATE
EOF

  cat > "$dest/commands/off.md" << 'EOF'
---
description: Revert to default behavior
---
HEXZ_DEACTIVATE
EOF

  cat > "$dest/commands/models.md" << 'EOF'
---
description: Model routing configuration
---
HEXZ_MODELS
EOF

  ok "$label"
  echo "    $hexzdir/index.ts"
  echo "    $hexzdir/index.js"
  echo "    $hexzdir/shared.ts"
  echo "    $hexzdir/design/"
  echo "    $hexzdir/cybersecurity/"
  echo "    $plugdir/package.json"
  echo "    $plugdir/index.ts"
  echo "    $dest/commands/{active,off,models}.md"
}

install_codex_to() {
  local dest="$1" label="$2"
  local skills_dir="$dest/skills"
  local hooks_dir="$dest/hooks"

  mkdir -p "$skills_dir" "$hooks_dir"

  cat > "$dest/plugin.json" << EOF
{
  "name": "hexz",
  "version": "$VERSION",
  "description": "HEXZ — Anti-slop, security scanning, design scaffolds, web search, image handling, plugin marketplace.",
  "skills": "./skills/"
}
EOF

  cat > "$hooks_dir/hooks.json" << 'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'which biome >/dev/null 2>&1 && biome format --write \"${FILE_PATH}\" 2>/dev/null || which prettier >/dev/null 2>&1 && prettier --write \"${FILE_PATH}\" 2>/dev/null || true'"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'echo \"${ARGS}\" | grep -qE \"rm (-rf| -fr)|dd if=|mkfs\" > /dev/null && echo \"[HEXZ] Destructive command detected. Create a simulation first with: hexz_sim(name=..., plan=...)\" || true'"
          }
        ]
      }
    ]
  }
}
EOF

  declare -A SKILL_DESCS
  SKILL_DESCS=( \
    ["hexz_search"]="Web search via DuckDuckGo with SearXNG/Chromium fallbacks" \
    ["hexz_scan"]="Security audit: injection, XSS, secrets, dependency vulns, auth, crypto" \
    ["hexz_design"]="Generate HTML/CSS design scaffolds from a brief with craft rules" \
    ["hexz_image"]="Analyze images via OCR: screenshots, error messages, diagrams" \
    ["hexz_webss"]="Capture website screenshots via Puppeteer" \
    ["hexz_mcp"]="MCP server management for DB, filesystem, and API access" \
    ["hexz_memory"]="Persistent agent memory across sessions" \
    ["hexz_pr"]="Git PR workflow with status, diff, and creation" \
    ["hexz_mkp"]="Plugin/skill marketplace from GitHub or npm" \
    ["hexz_status"]="Show HEXZ status, uptime, search count" \
    ["hexz_sim"]="Simulation sandbox for safe destructive actions" \
    ["hexz_codebase"]="Scan project and generate codebase.md" \
    ["hexz_cyber"]="Cybersecurity skills across 15 domains" \
    ["hexz_doctor"]="Health check for runtime, scanners, browser, git" \
    ["active"]="Engage HEXZ upgrade layer" \
    ["off"]="Revert to default behavior" \
  )

  for skill_name in "${!SKILL_DESCS[@]}"; do
    mkdir -p "$skills_dir/$skill_name"
    cat > "$skills_dir/$skill_name/SKILL.md" << SKILLEOF
---
name: $skill_name
description: ${SKILL_DESCS[$skill_name]}
---

${SKILL_DESCS[$skill_name]}

HEXZ v$VERSION — https://github.com/hexzonetwork/opencode-hexz
SKILLEOF
  done

  ok "$label"
  echo "    $dest/plugin.json (manifest)"
  echo "    $hooks_dir/hooks.json (hooks)"
  for s in "${!SKILL_DESCS[@]}"; do echo "    $skills_dir/$s/SKILL.md"; done
}

install_claude_to() {
  local dest="$1" label="$2"
  local skills_dir="$dest/skills"
  local hooks_dir="$dest/hooks"
  local agents_dir="$dest/agents"

  mkdir -p "$skills_dir" "$hooks_dir" "$agents_dir"

  cat > "$dest/plugin.json" << EOF
{
  "name": "hexz",
  "version": "$VERSION",
  "description": "HEXZ — Anti-slop, security scanning, design scaffolds, web search, image handling, plugin marketplace.",
  "skills": "./skills/"
}
EOF

  cat > "$hooks_dir/hooks.json" << 'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'which biome >/dev/null 2>&1 && biome format --write \"${FILE_PATH}\" 2>/dev/null || which prettier >/dev/null 2>&1 && prettier --write \"${FILE_PATH}\" 2>/dev/null || true'"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'echo \"${ARGS}\" | grep -qE \"rm (-rf| -fr)|dd if=|mkfs|\"\" > /dev/null && echo \"[HEXZ] Destructive command detected. Create a simulation first.\" || true'"
          }
        ]
      }
    ]
  }
}
EOF

  cat > "$agents_dir/hexz-agent.md" << 'EOF'
---
name: hexz-agent
description: General-purpose HEXZ agent for web search, security scanning, design, and codebase analysis
model: sonnet
effort: medium
maxTurns: 30
---

You are the HEXZ agent. You have access to all HEXZ skills:
- hexz_search: Web search via DuckDuckGo
- hexz_scan: Security audit and vulnerability scanning
- hexz_design: Generate HTML/CSS design scaffolds
- hexz_image: OCR-based image analysis
- hexz_webss: Website screenshots via Puppeteer
- hexz_mcp: MCP server management
- hexz_memory: Persistent memory across sessions
- hexz_pr: Git PR workflow
- hexz_mkp: Plugin and skill marketplace
- hexz_sim: Simulation sandbox for destructive actions
- hexz_codebase: Codebase scanning and analysis
- hexz_cyber: Cybersecurity skills and framework mappings
- hexz_doctor: Health check for tools and dependencies

Always search for current docs before writing code. Run security scans after building. Check for similar patterns in the codebase before making changes.
EOF

  declare -A SKILL_DESCS
  SKILL_DESCS=( \
    ["hexz_search"]="Web search via DuckDuckGo with SearXNG/Chromium fallbacks" \
    ["hexz_scan"]="Security audit: injection, XSS, secrets, dependency vulns, auth, crypto" \
    ["hexz_design"]="Generate HTML/CSS design scaffolds from a brief with craft rules" \
    ["hexz_image"]="Analyze images via OCR: screenshots, error messages, diagrams" \
    ["hexz_webss"]="Capture website screenshots via Puppeteer" \
    ["hexz_mcp"]="MCP server management for DB, filesystem, and API access" \
    ["hexz_memory"]="Persistent agent memory across sessions" \
    ["hexz_pr"]="Git PR workflow with status, diff, and creation" \
    ["hexz_mkp"]="Plugin/skill marketplace from GitHub or npm" \
    ["hexz_status"]="Show HEXZ status, uptime, search count" \
    ["hexz_sim"]="Simulation sandbox for safe destructive actions" \
    ["hexz_codebase"]="Scan project and generate codebase.md" \
    ["hexz_cyber"]="Cybersecurity skills across 15 domains" \
    ["hexz_doctor"]="Health check for runtime, scanners, browser, git" \
    ["active"]="Engage HEXZ upgrade layer" \
    ["off"]="Revert to default behavior" \
  )

  for skill_name in "${!SKILL_DESCS[@]}"; do
    mkdir -p "$skills_dir/$skill_name"
    cat > "$skills_dir/$skill_name/SKILL.md" << SKILLEOF
---
name: $skill_name
description: ${SKILL_DESCS[$skill_name]}
---

${SKILL_DESCS[$skill_name]}

HEXZ v$VERSION — https://github.com/hexzonetwork/opencode-hexz
SKILLEOF
  done

  ok "$label"
  echo "    $dest/plugin.json (manifest)"
  echo "    $hooks_dir/hooks.json (hooks)"
  echo "    $agents_dir/hexz-agent.md (agent)"
  for s in "${!SKILL_DESCS[@]}"; do echo "    $skills_dir/$s/SKILL.md"; done
}

install_mimo_to() {
  local dest="$1" label="$2"
  local toolsdir="$dest/tools"

  mkdir -p "$toolsdir" "$dest/commands"

  cp "$SCRIPT_DIR/dist/hexz-mimo.js" "$toolsdir/hexz.js"
  [ -d "$SCRIPT_DIR/src/cybersecurity" ] && cp -r "$SCRIPT_DIR/src/cybersecurity" "$dest/cybersecurity"

  cat > "$toolsdir/package.json" << 'PKGEOF'
{
  "type": "module",
  "dependencies": {
    "capture-website": "^4.0.0",
    "tesseract.js": "^5.1.0"
  }
}
PKGEOF

  (cd "$toolsdir" && PUPPETEER_SKIP_DOWNLOAD=true npm install --no-save --legacy-peer-deps >/dev/null 2>&1) && ok "Installed optional deps" || warn "npm install failed — hexz_webss/hexz_image will be unavailable"

  cat > "$dest/commands/active.md" << 'EOF'
---
description: Engage HEXZ in MiMo Code
---
HEXZ_ACTIVATE
EOF
  cat > "$dest/commands/off.md" << 'EOF'
---
description: Revert MiMo Code behavior
---
HEXZ_DEACTIVATE
EOF
  cat > "$dest/commands/models.md" << 'EOF'
---
description: Model routing configuration
---
HEXZ_MODELS
EOF

  ok "$label"
  echo "    $toolsdir/hexz.js"
  echo "    $toolsdir/package.json"
  echo "    $dest/cybersecurity/"
  echo "    $dest/commands/{active,off,models}.md"
}

section "Installing"

if [ "$RUNTIME" = "mimo" ]; then
  case "$MODE" in
    project) install_mimo_to "$(realpath "$DEST")/.mimocode" "Project-level (MiMo Code)" ;;
    global)  install_mimo_to "$HOME/.config/mimocode" "Global (MiMo Code)" ;;
    both)    install_mimo_to "$HOME/.config/mimocode" "Global (MiMo Code)"; echo ""; install_mimo_to "$(realpath "$DEST")/.mimocode" "Project-level (MiMo Code)" ;;
  esac
elif [ "$RUNTIME" = "codex" ]; then
  case "$MODE" in
    project) install_codex_to "$(realpath "$DEST")/.codex-plugin" "Project-level (Codex)" ;;
    global)  install_codex_to "$HOME/.config/codex" "Global (Codex)" ;;
    both)    install_codex_to "$HOME/.config/codex" "Global (Codex)"; echo ""; install_codex_to "$(realpath "$DEST")/.codex-plugin" "Project-level (Codex)" ;;
  esac
elif [ "$RUNTIME" = "claude" ]; then
  case "$MODE" in
    project) install_claude_to "$(realpath "$DEST")/.claude-plugin" "Project-level (Claude Code)" ;;
    global)  install_claude_to "$HOME/.config/claude" "Global (Claude Code)" ;;
    both)    install_claude_to "$HOME/.config/claude" "Global (Claude Code)"; echo ""; install_claude_to "$(realpath "$DEST")/.claude-plugin" "Project-level (Claude Code)" ;;
  esac
else
  case "$MODE" in
    project) install_to "$(realpath "$DEST")/.opencode" "Project-level" ;;
    global)  install_to "$HOME/.config/opencode" "Global" ;;
    both)    install_to "$HOME/.config/opencode" "Global"; echo ""; install_to "$(realpath "$DEST")/.opencode" "Project-level" ;;
  esac
fi

# ─── Config ───
find_opencode_config() {
  local dir="$1"
  for f in "$dir/opencode.json" "$dir/opencode.jsonc"; do
    [ -f "$f" ] && echo "$f" && return 0
  done
  return 1
}

add_plugin_to_config() {
  local config_file="$1" plugin_path="$2"
  if [ ! -f "$config_file" ]; then
    printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "plugin": ["%s"]\n}\n' "$plugin_path" > "$config_file"
    ok "Created $(basename "$config_file")"
    return 0
  fi
  local raw=$(<"$config_file")
  if echo "$raw" | grep -qF "$plugin_path"; then
    ok "$(basename "$config_file") already configured"
    return 0
  fi
  local tmp=$(mktemp)
  if echo "$raw" | grep -q '"plugin"'; then
    echo "$raw" | sed "s|\"plugin\": \[|\"plugin\": [\n    \"$plugin_path\",|" > "$tmp"
  else
    echo "$raw" | sed "s|}$|,\n  \"plugin\": [\"$plugin_path\"]\n}|" > "$tmp"
  fi
  mv "$tmp" "$config_file"
  ok "Added hexz to $(basename "$config_file")"
}

find_mimo_config() {
  local dir="$1"
  for f in "$dir/mimocode.json" "$dir/mimocode.jsonc"; do
    [ -f "$f" ] && echo "$f" && return 0
  done
  return 1
}

verify_opencode_config() {
  local dir="$1"
  local pp
  if [ "$(realpath "$dir")" = "$(realpath "$HOME/.config/opencode")" ]; then pp="~/.config/opencode/plugins"; else pp="./.opencode/plugins"; fi
  local cf
  if cf=$(find_opencode_config "$dir"); then
    add_plugin_to_config "$cf" "$pp"
  else
    printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "plugin": ["%s"]\n}\n' "$pp" > "$dir/opencode.json"
    ok "Created opencode.json"
  fi
}

verify_mimo_config() {
  local dir="$1"
  mkdir -p "$dir"
  if cf=$(find_mimo_config "$dir"); then
    ok "$(basename "$cf") already present"
  else
    printf '{\n  "$schema": "https://mimo.xiaomi.com/config.json"\n}\n' > "$dir/mimocode.json"
    ok "Created mimocode.json"
  fi
}

section "Config"
if [ "$RUNTIME" = "mimo" ]; then
  case "$MODE" in
    project) verify_mimo_config "$(realpath "$DEST")" ;;
    global)  verify_mimo_config "$HOME/.config/mimocode" ;;
    both)    verify_mimo_config "$(realpath "$DEST")"; verify_mimo_config "$HOME/.config/mimocode" ;;
  esac
elif [ "$RUNTIME" = "codex" ]; then
  :
elif [ "$RUNTIME" = "claude" ]; then
  :
else
  case "$MODE" in
    project) verify_opencode_config "$(realpath "$DEST")" ;;
    global)  verify_opencode_config "$HOME/.config/opencode" ;;
    both)    verify_opencode_config "$(realpath "$DEST")"; verify_opencode_config "$HOME/.config/opencode" ;;
  esac
fi

# ─── Done ───
echo ""
echo -e "  ${GREEN}${BOLD}HEXZ installed successfully!${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
if [ "$RUNTIME" = "mimo" ]; then
  echo "    1. Restart mimo / MiMo Code"
elif [ "$RUNTIME" = "codex" ]; then
  echo "    1. Restart Codex"
elif [ "$RUNTIME" = "claude" ]; then
  echo "    1. Restart Claude Code"
else
  echo "    1. Restart opencode"
fi
echo -e "    2. Type ${CYAN}/active${RESET} to engage HEXZ"
echo -e "    3. Type ${CYAN}/off${RESET} to revert"
echo ""
echo -e "  ${BOLD}Tools:${RESET}"
echo -e "    ${CYAN}hexz_search${RESET}  Web search        ${CYAN}hexz_memory${RESET}  Persistent memory"
echo -e "    ${CYAN}hexz_scan${RESET}    Security audit    ${CYAN}hexz_pr${RESET}      Git PR workflow"
echo -e "    ${CYAN}hexz_design${RESET}  Design scaffolds  ${CYAN}hexz_mkp${RESET}     Plugin marketplace"
echo -e "    ${CYAN}hexz_image${RESET}   Image OCR         ${CYAN}hexz_status${RESET}  Adapter status"
echo -e "    ${CYAN}hexz_webss${RESET}   Web screenshots   ${CYAN}hexz_doctor${RESET}  Runtime check"
echo -e "    ${CYAN}hexz_cyber${RESET}   769+ cyber skills ${CYAN}hexz_sim${RESET}     Sim sandbox"
echo -e "    ${CYAN}hexz_mcp${RESET}     MCP servers       ${CYAN}hexz_codebase${RESET} Codebase map"
echo -e "  ${DIM}  SearXNG auto-fallback active when DuckDuckGo rate-limits${RESET}"
echo ""
