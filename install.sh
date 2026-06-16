#!/usr/bin/env bash
set -euo pipefail

# ─── Resolve plugin directory ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Colors ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD="\033[1m"
  GREEN="\033[0;32m"
  CYAN="\033[0;36m"
  YELLOW="\033[0;33m"
  RED="\033[0;31m"
  DIM="\033[2m"
  RESET="\033[0m"
else
  BOLD="" GREEN="" CYAN="" YELLOW="" RED="" DIM="" RESET=""
fi

# ─── Help ──────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}HEXZ — OpenCode Upgrade Layer${RESET}

${BOLD}Usage:${RESET}
  ./install.sh [OPTIONS] [DIRECTORY]

${BOLD}Options:${RESET}
  -g, --global     Install to ~/.config/opencode/ only
  -p, --project    Install to ./opencode/ only (default)
  -b, --both       Install globally and locally
  -y, --yes        Accept all defaults, no prompts
  -h, --help       Show this help
  -v, --version    Show plugin version

${BOLD}Examples:${RESET}
  ./install.sh                  # Interactive, project-level
  ./install.sh -g               # Global only
  ./install.sh /my/project -y   # Non-interactive to project
  ./install.sh -b               # Both locations
EOF
}

# ─── Parse args ───────────────────────────────────────────────────────────────
MODE=""
AUTO_YES=false
DEST=""

while [ $# -gt 0 ]; do
  case "$1" in
    -g|--global)   MODE="global";  shift ;;
    -p|--project)  MODE="project"; shift ;;
    -b|--both)     MODE="both";    shift ;;
    -y|--yes)      AUTO_YES=true;  shift ;;
    -h|--help)     usage; exit 0 ;;
    -v|--version)  grep '"version"' "$SCRIPT_DIR/package.json" | head -1; exit 0 ;;
    -*)            echo "${RED}Unknown flag: $1${RESET}"; usage; exit 1 ;;
    *)             DEST="$1"; shift ;;
  esac
done

DEST="${DEST:-.}"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}  ╔═════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}  ║     HEXZ — OpenCode     ║${RESET}"
echo -e "${CYAN}${BOLD}  ╚═════════════════════════╝${RESET}"
echo ""

# ─── Preflight: bun ───────────────────────────────────────────────────────────
preflight_bun() {
  if command -v bun &>/dev/null; then
    echo -e "${GREEN}✓${RESET} bun $(bun --version)"
    return 0
  fi

  echo -e "${YELLOW}⚠ bun not found. Installing...${RESET}"

  if command -v curl &>/dev/null; then
    curl -fsSL https://bun.sh/install | bash
  elif command -v wget &>/dev/null; then
    wget -qO- https://bun.sh/install | bash
  else
    echo -e "${RED}✗ Cannot install bun: no curl or wget found.${RESET}"
    echo "  Install manually: https://bun.sh"
    exit 1
  fi

  # Reload PATH for current session
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if ! command -v bun &>/dev/null; then
    echo -e "${RED}✗ bun installation failed.${RESET}"
    echo "  Restart your shell or run: source ~/.bashrc"
    exit 1
  fi

  echo -e "${GREEN}✓${RESET} bun $(bun --version) installed"
}

# ─── Preflight: git ───────────────────────────────────────────────────────────
preflight_git() {
  if command -v git &>/dev/null; then
    echo -e "${GREEN}✓${RESET} git $(git --version | awk '{print $3}')"
    return 0
  fi

  echo -e "${YELLOW}⚠ git not found. Some features need git.${RESET}"
  echo "  Install: sudo apt install git"
}

# ─── Preflight: node (optional) ───────────────────────────────────────────────
preflight_node() {
  if command -v node &>/dev/null; then
    echo -e "${GREEN}✓${RESET} node $(node --version)"
  else
    echo -e "${DIM}  node not found (optional)${RESET}"
  fi
}

# ─── Run preflight ────────────────────────────────────────────────────────────
echo -e "${BOLD}Preflight checks:${RESET}"
preflight_bun
preflight_git
preflight_node
echo ""

# ─── Build ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}Building plugin...${RESET}"

if [ ! -f "$SCRIPT_DIR/package.json" ]; then
  echo -e "${RED}✗ package.json not found in $SCRIPT_DIR${RESET}"
  exit 1
fi

if ! bun install --cwd "$SCRIPT_DIR" --frozen-lockfile 2>/dev/null; then
  echo -e "${YELLOW}  Lockfile mismatch, running bun install...${RESET}"
  bun install --cwd "$SCRIPT_DIR" || {
    echo -e "${RED}✗ bun install failed${RESET}"
    exit 1
  }
fi

if ! bun run --cwd "$SCRIPT_DIR" build 2>&1; then
  echo -e "${RED}✗ Build failed. Check: bun run typecheck${RESET}"
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/dist/hexz.js" ]; then
  echo -e "${RED}✗ dist/hexz.js not found after build${RESET}"
  exit 1
fi

SIZE=$(wc -c < "$SCRIPT_DIR/dist/hexz.js" | tr -d ' ')
echo -e "${GREEN}✓${RESET} Build complete ${DIM}($SIZE bytes)${RESET}"
echo ""

# ─── Choose install target ────────────────────────────────────────────────────
if [ -z "$MODE" ]; then
  if [ "$AUTO_YES" = true ]; then
    MODE="project"
  else
    echo -e "${BOLD}Install target:${RESET}"
    echo "  1) Project-level  →  ./opencode/"
    echo "  2) Global          →  ~/.config/opencode/"
    echo "  3) Both"
    echo ""
    read -rp "  Choose [1-3] (default: 1): " choice
    choice="${choice:-1}"
    case "$choice" in
      1) MODE="project" ;;
      2) MODE="global" ;;
      3) MODE="both" ;;
      *) echo -e "${RED}Invalid choice.${RESET}"; exit 1 ;;
    esac
  fi
fi

# ─── Install helper ────────────────────────────────────────────────────────────
install_to() {
  local dest="$1"
  local label="$2"

  mkdir -p "$dest/plugins" "$dest/commands"

  # Copy built plugin
  cp "$SCRIPT_DIR/dist/hexz.js" "$dest/plugins/hexz.js"

  # Command: activate
  cat > "$dest/commands/active.md" << 'EOF'
---
description: Engage HEXZ upgrade layer (anti-slop, security, design, search, marketplace)
---
[HEXZ_ACTIVATE] Engage HEXZ upgrade layer. All modules loaded.
EOF

  # Command: deactivate
  cat > "$dest/commands/off.md" << 'EOF'
---
description: Revert to default opencode behavior
---
[HEXZ_DEACTIVATE] Revert to default opencode behavior.
EOF

  echo -e "${GREEN}✓${RESET} ${label}"
  echo -e "    plugins/hexz.js     ${DIM}→ ${dest}/plugins/hexz.js${RESET}"
  echo -e "    commands/active.md  ${DIM}→ ${dest}/commands/active.md${RESET}"
  echo -e "    commands/off.md     ${DIM}→ ${dest}/commands/off.md${RESET}"
}

# ─── Install ──────────────────────────────────────────────────────────────────
echo -e "${BOLD}Installing:${RESET}"

case "$MODE" in
  project)
    install_to "$(realpath "$DEST")/.opencode" "Project-level"
    ;;
  global)
    install_to "$HOME/.config/opencode" "Global"
    ;;
  both)
    install_to "$HOME/.config/opencode" "Global"
    echo ""
    install_to "$(realpath "$DEST")/.opencode" "Project-level"
    ;;
esac

# ─── Verify opencode.json ────────────────────────────────────────────────────
verify_opencode_json() {
  local dir="$1"
  local json="$dir/opencode.json"

  if [ -f "$json" ]; then
    if grep -q '"opencode-hexz"' "$json" 2>/dev/null; then
      echo -e "${GREEN}✓${RESET} opencode.json already configured"
      return 0
    fi
    echo -e "${YELLOW}⚠ opencode.json exists but missing opencode-hexz plugin.${RESET}"
    echo "  Add: \"plugin\": [\"opencode-hexz\"]"
  else
    cat > "$json" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hexz"]
}
EOF
    echo -e "${GREEN}✓${RESET} Created opencode.json"
  fi
}

echo ""
echo -e "${BOLD}Verifying config:${RESET}"
case "$MODE" in
  project)
    verify_opencode_json "$(realpath "$DEST")"
    ;;
  global)
    echo -e "${DIM}  Global install: add plugin to your project's opencode.json${RESET}"
    ;;
  both)
    verify_opencode_json "$(realpath "$DEST")"
    ;;
esac

# ─── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  HEXZ installed successfully!${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo -e "    1. Restart opencode (if running)"
echo -e "    2. Type ${CYAN}/active${RESET} to engage HEXZ"
echo -e "    3. Type ${CYAN}/off${RESET} to revert"
echo ""
echo -e "  ${BOLD}Tools:${RESET}"
echo -e "    ${CYAN}hexz_search${RESET}    Search the web"
echo -e "    ${CYAN}hexz_scan${RESET}      Security audit"
echo -e "    ${CYAN}hexz_design${RESET}    Design scaffolds"
echo -e "    ${CYAN}hexz_image${RESET}     Image analysis"
echo -e "    ${CYAN}hexz_mkp${RESET}       Plugin marketplace"
echo ""
echo -e "  ${DIM}https://github.com/hexzonetwork/opencode-hexz${RESET}"
echo ""
