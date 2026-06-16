#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

usage() {
  cat <<EOF
${BOLD}HEXZ — OpenCode Upgrade Layer${RESET}

${BOLD}Usage:${RESET}
  ./install.sh [OPTIONS] [DIRECTORY]

${BOLD}Options:${RESET}
  -g, --global     Install to ~/.config/opencode/ only
  -p, --project    Install to ./.opencode/ only (default)
  -b, --both       Install globally and locally
  -y, --yes        Accept all defaults, no prompts
  -h, --help       Show this help
  -v, --version    Show plugin version

${BOLD}Examples:${RESET}
  ./install.sh
  ./install.sh -g
  ./install.sh /my/project -y
  ./install.sh -b
EOF
}

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
    *)             echo "${RED}Unknown flag: $1${RESET}"; usage; exit 1 ;;
  esac
done

DEST="${DEST:-.}"

echo ""
echo -e "${CYAN}${BOLD}  ╔═════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}  ║     HEXZ — OpenCode     ║${RESET}"
echo -e "${CYAN}${BOLD}  ╚═════════════════════════╝${RESET}"
echo ""

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

  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if ! command -v bun &>/dev/null; then
    echo -e "${RED}✗ bun installation failed.${RESET}"
    echo "  Restart your shell or run: source ~/.bashrc"
    exit 1
  fi

  echo -e "${GREEN}✓${RESET} bun $(bun --version) installed"
}

preflight_git() {
  if command -v git &>/dev/null; then
    echo -e "${GREEN}✓${RESET} git $(git --version | awk '{print $3}')"
    return 0
  fi

  echo -e "${YELLOW}⚠ git not found. Some features need git.${RESET}"
  echo "  Install: sudo apt install git"
}

preflight_node() {
  if command -v node &>/dev/null; then
    echo -e "${GREEN}✓${RESET} node $(node --version)"
  else
    echo -e "  node not found (optional)"
  fi
}

echo -e "${BOLD}Preflight checks:${RESET}"
preflight_bun
preflight_git
preflight_node
echo ""

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

if [ -z "$MODE" ]; then
  if [ "$AUTO_YES" = true ]; then
    MODE="project"
  else
    echo -e "${BOLD}Install target:${RESET}"
    echo "  1) Project-level  →  ./.opencode/"
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

install_to() {
  local dest="$1"
  local label="$2"

  mkdir -p "$dest/plugins" "$dest/commands"

  cp "$SCRIPT_DIR/dist/hexz.js" "$dest/plugins/hexz.js"

  cat > "$dest/commands/active.md" << 'EOF'
---
description: Engage HEXZ upgrade layer (anti-slop, security, design, search, marketplace)
---
Type your message naturally. HEXZ activates on keywords like "build", "fix", "add feature", "create", "implement".
EOF

  cat > "$dest/commands/off.md" << 'EOF'
---
description: Revert to default opencode behavior
---
HEXZ_DEACTIVATE
EOF

  echo -e "${GREEN}✓${RESET} ${label}"
  echo -e "    plugins/hexz.js     → ${dest}/plugins/hexz.js"
  echo -e "    commands/active.md  → ${dest}/commands/active.md"
  echo -e "    commands/off.md     → ${dest}/commands/off.md"
}

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

find_opencode_config() {
  local dir="$1"
  for f in "$dir/opencode.json" "$dir/opencode.jsonc"; do
    if [ -f "$f" ]; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

add_plugin_to_config() {
  local config_file="$1"
  local plugin_path="$2"

  if [ ! -f "$config_file" ]; then
    cat > "$config_file" << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "plugin": ["$plugin_path"]
}
EOF
    echo -e "${GREEN}✓${RESET} Created $(basename "$config_file")"
    return 0
  fi

  local raw
  raw=$(<"$config_file")

  if echo "$raw" | grep -q "hexz"; then
    echo -e "${GREEN}✓${RESET} $(basename "$config_file") already configured"
    return 0
  fi

  local tmpfile
  tmpfile=$(mktemp)

  if echo "$raw" | grep -q '"plugin"'; then
    # Has plugin array - insert before closing bracket of plugin array
    echo "$raw" | sed "s|\"plugin\": \[|\"plugin\": [\n    \"$plugin_path\",|" > "$tmpfile"
  else
    # No plugin key - add it before closing brace
    echo "$raw" | sed "s|}$|,\n  \"plugin\": [\"$plugin_path\"]\n}|" > "$tmpfile"
  fi

  mv "$tmpfile" "$config_file"
  echo -e "${GREEN}✓${RESET} Added hexz to $(basename "$config_file")"
}

verify_opencode_config() {
  local dir="$1"
  local plugin_path="$2"
  local config_file

  if config_file=$(find_opencode_config "$dir"); then
    add_plugin_to_config "$config_file" "$plugin_path"
  else
    cat > "$dir/opencode.json" << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "plugin": ["$plugin_path"]
}
EOF
    echo -e "${GREEN}✓${RESET} Created opencode.json"
  fi
}

echo ""
echo -e "${BOLD}Verifying config:${RESET}"
case "$MODE" in
  project)
    verify_opencode_config "$(realpath "$DEST")" "./.opencode/plugins/hexz.js"
    ;;
  global)
    verify_opencode_config "$HOME/.config/opencode" "~/.config/opencode/plugins/hexz.js"
    ;;
  both)
    verify_opencode_config "$(realpath "$DEST")" "./.opencode/plugins/hexz.js"
    verify_opencode_config "$HOME/.config/opencode" "~/.config/opencode/plugins/hexz.js"
    ;;
esac

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
echo -e "  https://github.com/hexzonetwork/opencode-hexz"
echo ""
