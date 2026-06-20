#!/usr/bin/env bash
set -euo pipefail

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

section() {
  echo ""
  echo -e "  ${BOLD}${RED}── $1 ──${RESET}"
  echo ""
}

banner() {
  local runtime="$1"
  local sub
  if [ "$runtime" = "mimo" ]; then sub="MiMo Code"; else sub="OpenCode"; fi

  echo ""
  if [ "$HAS_TTY" = true ]; then
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
        printf "${RED}%s${RESET}" "${line:$i:1}"
        sleep 0.005
      done
      echo ""
    done
    echo -e "  ${DIM}── Uninstall ${sub} ──${RESET}"
  else
    echo "  HEXZ Uninstall — $sub"
  fi
  echo ""
}

usage() {
  cat <<EOF
${BOLD}HEXZ Uninstall${RESET}

${BOLD}Usage:${RESET}
  ./uninstall.sh [OPTIONS]

${BOLD}Options:${RESET}
  -f, --force    Remove without confirmation
  -g, --global   Remove global install only
  -p, --project  Remove project install only
  -mm, --mimo    Remove MiMo Code install instead of OpenCode install
  -h, --help     Show this help
EOF
}

FORCE=false
TARGET="all"
RUNTIME="opencode"

while [ $# -gt 0 ]; do
  case "$1" in
    -f|--force)    FORCE=true; shift ;;
    -g|--global)   TARGET="global"; shift ;;
    -p|--project)  TARGET="project"; shift ;;
    -mm|--mimo)    RUNTIME="mimo"; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             fail "Unknown: $1"; usage; exit 1 ;;
  esac
done

banner "$RUNTIME"

removed=0

remove_plugin_from_config() {
  local dir="$1"
  local pp
  if [ "$(realpath "$dir" 2>/dev/null)" = "$(realpath "$HOME/.config/opencode" 2>/dev/null)" ]; then pp="~/.config/opencode/plugins"; else pp="./.opencode/plugins"; fi

  local cf
  for f in "$dir/opencode.json" "$dir/opencode.jsonc"; do
    [ -f "$f" ] && cf="$f" && break
  done
  [ -z "${cf:-}" ] && return 0

  if ! command -v bun &>/dev/null; then
    warn "bun not found, skipping config cleanup"
    return 0
  fi

  local result
  result=$(CONFIG_FILE="$cf" PLUGIN_PATH="$pp" bun -e '
    const fs=require("fs"),c=process.env.CONFIG_FILE,p=process.env.PLUGIN_PATH;
    if(!c||p)return 0;
    const r=fs.readFileSync(c,"utf8");
    let j;try{j=JSON.parse(r)}catch{x=r.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"");try{j=JSON.parse(x)}catch{process.exit(0)}}
    if(!j.plugin||!Array.isArray(j.plugin))process.exit(0);
    const b=j.plugin.length;
    j.plugin=j.plugin.filter(s=>typeof s!=="string"||s!==p&&!/hexz|opencode-hexz/.test(s));
    if(j.plugin.length===b)process.exit(0);
    if(!j.plugin.length)delete j.plugin;
    fs.writeFileSync(c,JSON.stringify(j,null,2)+"\n");
    console.log("removed");
  ' 2>/dev/null) || true

  [ "$result" = "removed" ] && ok "Removed plugin from $(basename "$cf")"
}

remove_plugin_from_mimo_config() {
  local dir="$1"
  local pp
  if [ "$(realpath "$dir" 2>/dev/null)" = "$(realpath "$HOME/.config/mimocode" 2>/dev/null)" ]; then pp="$HOME/.config/mimocode/plugins"; else pp="./.mimocode/plugins"; fi

  local cf
  for f in "$dir/mimocode.json" "$dir/mimocode.jsonc"; do
    [ -f "$f" ] && cf="$f" && break
  done
  [ -z "${cf:-}" ] && return 0

  if ! command -v bun &>/dev/null; then
    warn "bun not found, skipping config cleanup"
    return 0
  fi

  local result
  result=$(CONFIG_FILE="$cf" PLUGIN_PATH="$pp" bun -e '
    const fs=require("fs"),c=process.env.CONFIG_FILE,p=process.env.PLUGIN_PATH;
    if(!c||p)return 0;
    const r=fs.readFileSync(c,"utf8");
    let j;try{j=JSON.parse(r)}catch{x=r.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"");try{j=JSON.parse(x)}catch{process.exit(0)}}
    if(!j.plugin||!Array.isArray(j.plugin))process.exit(0);
    const b=j.plugin.length;
    j.plugin=j.plugin.filter(s=>typeof s!=="string"||s!==p&&!/hexz|opencode-hexz|mimocode-hexz/.test(s));
    if(j.plugin.length===b)process.exit(0);
    if(!j.plugin.length)delete j.plugin;
    fs.writeFileSync(c,JSON.stringify(j,null,2)+"\n");
    console.log("removed");
  ' 2>/dev/null) || true

  [ "$result" = "removed" ] && ok "Removed plugin from $(basename "$cf")"
}

remove_project() {
  local dir=".opencode"
  local found=0
  for m in "$dir/plugins/hexz/index.ts" "$dir/plugins/hexz/index.js" "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"; do
    [ -f "$m" ] && found=1 && break
  done
  [ "$found" -eq 0 ] && warn "No project install found" && return 0

  if [ "$FORCE" = false ]; then
    read -rp "  Remove project files from $dir/? [y/N]: " c
    [[ ! "$c" =~ ^[Yy]$ ]] && echo -e "  ${YELLOW}Skipped${RESET}" && return 0
  fi

  rm -rf "$dir/plugins/hexz" "$dir/plugins/package.json" "$dir/plugins/index.ts"
  rm -f "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts" "$dir/commands/active.md" "$dir/commands/off.md"
  rmdir "$dir/commands" 2>/dev/null; rmdir "$dir" 2>/dev/null
  remove_plugin_from_config "."
  ok "Removed project install"
  removed=1
}

remove_global() {
  local dir="$HOME/.config/opencode"
  local found=0
  for m in "$dir/plugins/hexz/index.ts" "$dir/plugins/hexz/index.js" "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts"; do
    [ -f "$m" ] && found=1 && break
  done
  [ "$found" -eq 0 ] && warn "No global install found" && return 0

  if [ "$FORCE" = false ]; then
    read -rp "  Remove global files from $dir/? [y/N]: " c
    [[ ! "$c" =~ ^[Yy]$ ]] && echo -e "  ${YELLOW}Skipped${RESET}" && return 0
  fi

  rm -rf "$dir/plugins/hexz" "$dir/plugins/package.json" "$dir/plugins/index.ts"
  rm -f "$dir/plugins/hexz.js" "$dir/plugins/hexz.ts" "$dir/commands/active.md" "$dir/commands/off.md"
  rmdir "$dir/commands" 2>/dev/null; rmdir "$dir/plugins" 2>/dev/null
  remove_plugin_from_config "$dir"
  ok "Removed global install"
  removed=1
}

remove_mimo_project() {
  local dir=".mimocode"
  local found=0
  for m in "$dir/tools/hexz.ts" "$dir/tools/hexz.js" "$dir/plugins/hexz/index.ts" "$dir/plugins/hexz/index.js" "$dir/plugins/index.ts"; do
    [ -f "$m" ] && found=1 && break
  done
  [ "$found" -eq 0 ] && warn "No MiMo project install found" && return 0

  if [ "$FORCE" = false ]; then
    read -rp "  Remove MiMo project files from $dir/? [y/N]: " c
    [[ ! "$c" =~ ^[Yy]$ ]] && echo -e "  ${YELLOW}Skipped${RESET}" && return 0
  fi

  rm -f "$dir/tools/hexz.js" "$dir/tools/hexz.ts" "$dir/tools/package.json"
  rm -rf "$dir/tools/node_modules" "$dir/plugins/hexz" "$dir/plugins/package.json" "$dir/plugins/index.ts" "$dir/cybersecurity"
  rmdir "$dir/tools" 2>/dev/null; rmdir "$dir/commands" 2>/dev/null; rmdir "$dir/plugins" 2>/dev/null; rmdir "$dir" 2>/dev/null
  remove_plugin_from_mimo_config "."
  ok "Removed MiMo project install"
  removed=1
}

remove_mimo_global() {
  local dir="$HOME/.config/mimocode"
  local found=0
  for m in "$dir/tools/hexz.ts" "$dir/tools/hexz.js" "$dir/plugins/hexz/index.ts" "$dir/plugins/hexz/index.js" "$dir/plugins/index.ts"; do
    [ -f "$m" ] && found=1 && break
  done
  [ "$found" -eq 0 ] && warn "No MiMo global install found" && return 0

  if [ "$FORCE" = false ]; then
    read -rp "  Remove MiMo global files from $dir/? [y/N]: " c
    [[ ! "$c" =~ ^[Yy]$ ]] && echo -e "  ${YELLOW}Skipped${RESET}" && return 0
  fi

  rm -f "$dir/tools/hexz.js" "$dir/tools/hexz.ts" "$dir/tools/package.json"
  rm -rf "$dir/tools/node_modules" "$dir/plugins/hexz" "$dir/plugins/package.json" "$dir/plugins/index.ts" "$dir/cybersecurity"
  rmdir "$dir/tools" 2>/dev/null; rmdir "$dir/commands" 2>/dev/null; rmdir "$dir/plugins" 2>/dev/null
  remove_plugin_from_mimo_config "$dir"
  ok "Removed MiMo global install"
  removed=1
}

section "Removing"

if [ "$RUNTIME" = "mimo" ]; then
  case "$TARGET" in
    all)     remove_mimo_project; remove_mimo_global ;;
    project) remove_mimo_project ;;
    global)  remove_mimo_global ;;
  esac
else
  case "$TARGET" in
    all)     remove_project; remove_global ;;
    project) remove_project ;;
    global)  remove_global ;;
  esac
fi

echo ""
if [ "$removed" -eq 1 ]; then
  echo -e "  ${GREEN}${BOLD}HEXZ removed!${RESET}"
  if [ "$RUNTIME" = "mimo" ]; then
    echo "  Restart mimo / MiMo Code."
  else
    echo "  Restart opencode."
  fi
else
  echo -e "  ${YELLOW}Nothing to remove.${RESET}"
fi
echo ""
