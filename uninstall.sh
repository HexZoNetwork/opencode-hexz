#!/usr/bin/env bash
set -euo pipefail

if [ -t 1 ]; then
  BOLD="\033[1m"
  GREEN="\033[0;32m"
  CYAN="\033[0;36m"
  YELLOW="\033[0;33m"
  RED="\033[0;31m"
  RESET="\033[0m"
else
  BOLD="" GREEN="" CYAN="" YELLOW="" RED="" RESET=""
fi

usage() {
  cat <<EOF
${BOLD}HEXZ Uninstall${RESET}

${BOLD}Usage:${RESET}
  ./uninstall.sh [OPTIONS]

${BOLD}Options:${RESET}
  -f, --force    Remove without confirmation
  -g, --global   Remove global install only
  -p, --project  Remove project install only
  -h, --help     Show this help
EOF
}

FORCE=false
TARGET="all"

while [ $# -gt 0 ]; do
  case "$1" in
    -f|--force)    FORCE=true; shift ;;
    -g|--global)   TARGET="global"; shift ;;
    -p|--project)  TARGET="project"; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             echo "${RED}Unknown: $1${RESET}"; usage; exit 1 ;;
  esac
done

echo ""
echo -e "${CYAN}${BOLD}  HEXZ Uninstall${RESET}"
echo ""

removed=0

plugin_config_path() {
  local dir="$1"
  if [ "$(realpath "$dir" 2>/dev/null)" = "$(realpath "$HOME/.config/opencode" 2>/dev/null)" ]; then
    echo "~/.config/opencode/plugins"
  else
    echo "./.opencode/plugins"
  fi
}

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

remove_plugin_from_config() {
  local dir="$1"
  local config_file
  local plugin_path

  plugin_path=$(plugin_config_path "$dir")

  if ! config_file=$(find_opencode_config "$dir"); then
    return 0
  fi

  if ! command -v bun &>/dev/null; then
    echo -e "${YELLOW}⚠ bun not found, skipping config cleanup${RESET}"
    return 0
  fi

  local result
  result=$(bun -e "
    const fs = require('fs');
    const raw = fs.readFileSync('$config_file', 'utf8');
    let config;
    try { config = JSON.parse(raw); } catch {
      const clean = raw.replace(/\/\/.*$/gm, '').replace(/\\/\\*[\\s\\S]*?\\*\//g, '');
      try { config = JSON.parse(clean); } catch { process.exit(0); }
    }
    if (!config.plugin || !Array.isArray(config.plugin)) process.exit(0);
    const pluginPath = '$plugin_path';
    const matchPatterns = [/hexz/, /opencode-hexz/];
    const before = config.plugin.length;
    config.plugin = config.plugin.filter(p => {
      if (typeof p !== 'string') return true;
      if (p === pluginPath) return false;
      return !matchPatterns.some(re => re.test(p));
    });
    if (config.plugin.length === before) process.exit(0);
    if (config.plugin.length === 0) delete config.plugin;
    fs.writeFileSync('$config_file', JSON.stringify(config, null, 2) + '\\n');
    console.log('removed');
  " 2>/dev/null) || true

  if [ "$result" = "removed" ]; then
    echo -e "${GREEN}✓${RESET} Removed plugin from $(basename "$config_file")"
  fi
}

remove_project() {
  local dir=".opencode"
  local found=0

  for marker in "$dir/plugins/hexz/index.ts" "$dir/plugins/hexz/index.js" "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"; do
    if [ -f "$marker" ]; then
      found=1
      break
    fi
  done

  if [ "$found" -eq 0 ]; then
    echo -e "${YELLOW}  No project install found${RESET}"
    return 0
  fi

  if [ "$FORCE" = false ]; then
    read -rp "  Remove project files from $dir/? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo -e "  ${YELLOW}Skipped${RESET}"
      return 0
    fi
  fi

  rm -rf "$dir/plugins/hexz"
  rm -f "$dir/plugins/package.json" "$dir/plugins/index.ts"
  rm -f "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"  # legacy
  rm -f "$dir/commands/active.md" "$dir/commands/off.md"
  rmdir "$dir/commands" 2>/dev/null || true
  rmdir "$dir/plugins" 2>/dev/null || true
  remove_plugin_from_config "."
  echo -e "${GREEN}✓${RESET} Removed project install"
  removed=1
}

remove_global() {
  local dir="$HOME/.config/opencode"
  local found=0

  for marker in "$dir/plugins/hexz/index.ts" "$dir/plugins/hexz/index.js" "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"; do
    if [ -f "$marker" ]; then
      found=1
      break
    fi
  done

  if [ "$found" -eq 0 ]; then
    echo -e "${YELLOW}  No global install found${RESET}"
    return 0
  fi

  if [ "$FORCE" = false ]; then
    read -rp "  Remove global files from $dir/? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo -e "  ${YELLOW}Skipped${RESET}"
      return 0
    fi
  fi

  rm -rf "$dir/plugins/hexz"
  rm -f "$dir/plugins/package.json" "$dir/plugins/index.ts"
  rm -f "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"  # legacy
  rm -f "$dir/commands/active.md" "$dir/commands/off.md"
  rmdir "$dir/commands" 2>/dev/null || true
  rmdir "$dir/plugins" 2>/dev/null || true
  remove_plugin_from_config "$dir"
  echo -e "${GREEN}✓${RESET} Removed global install"
  removed=1
}

case "$TARGET" in
  all)
    remove_project
    remove_global
    ;;
  project)
    remove_project
    ;;
  global)
    remove_global
    ;;
esac

echo ""
if [ "$removed" -eq 1 ]; then
  echo -e "${GREEN}${BOLD}  HEXZ removed.${RESET} Restart opencode."
else
  echo -e "${YELLOW}  Nothing to remove.${RESET}"
fi
echo ""
