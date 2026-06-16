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

remove_project() {
  local found=0
  for f in ".opencode/plugins/hexz.js" ".opencode/plugins/hexz.ts"; do
    if [ -f "$f" ]; then
      found=1
      break
    fi
  done

  if [ "$found" -eq 0 ]; then
    echo -e "${YELLOW}  No project install found${RESET}"
    return 0
  fi

  if [ "$FORCE" = false ]; then
    read -rp "  Remove project files from .opencode/? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo -e "  ${YELLOW}Skipped${RESET}"
      return 0
    fi
  fi

  rm -f .opencode/plugins/hexz.js .opencode/plugins/hexz.ts
  rm -f .opencode/commands/active.md .opencode/commands/off.md
  rmdir .opencode/commands 2>/dev/null || true
  rmdir .opencode/plugins 2>/dev/null || true
  echo -e "${GREEN}✓${RESET} Removed project install"
  removed=1
}

remove_global() {
  local dir="$HOME/.config/opencode"
  local found=0

  for f in "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"; do
    if [ -f "$f" ]; then
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

  rm -f "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"
  rm -f "$dir/commands/active.md" "$dir/commands/off.md"
  rmdir "$dir/commands" 2>/dev/null || true
  rmdir "$dir/plugins" 2>/dev/null || true
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
