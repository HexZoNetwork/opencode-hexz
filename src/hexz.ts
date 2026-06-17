import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
export const VERSION = "1.5.0";
function fileExistsSync(p: string): boolean {
  try { return existsSync(p); } catch { return false; }
}
function readFile(p: string): string | null {
  try { return readFileSync(p, "utf-8"); } catch { return null; }
}
function writeFile(p: string, content: string): void {
  try { writeFileSync(p, content, "utf-8"); } catch {}
}
function* globSync(pattern: string, cwd: string): Generator<string> {
  const parts = pattern.split("/");
  const filePart = parts[parts.length - 1]!;
  const dirPart = parts.slice(0, -1).join("/");
  const baseDir = dirPart ? join(cwd, dirPart) : cwd;
  try {
    const entries = readdirSync(baseDir);
    for (const entry of entries) {
      const fullPath = join(baseDir, entry);
      let match = false;
      if (filePart === "*") match = true;
      else if (filePart === "**/*") match = statSync(fullPath).isDirectory();
      else if (filePart.startsWith("*.")) match = entry.endsWith(filePart.slice(1));
      else if (filePart.endsWith("/")) match = statSync(fullPath).isDirectory();
      else match = entry === filePart;
      if (match && statSync(fullPath).isFile()) yield fullPath;
    }
  } catch {}
}

const CRAFT_DEFAULT_SECTIONS = ["typography", "color", "anti-ai-slop"];
const DESIGN_DIR = join(import.meta.dir!, "design");
const CYBER_DIR = join(import.meta.dir!, "cybersecurity");
const SIMS_DIR = ".sims";

function scanCodebase(cwd: string): string {
  const files: string[] = [];
  function walk(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const full = join(dir, entry);
        if (entry.startsWith(".") || entry === "node_modules") continue;
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith(".ts") || entry.endsWith(".js") || entry.endsWith(".tsx") || entry.endsWith(".jsx") || entry.endsWith(".py") || entry.endsWith(".rs") || entry.endsWith(".go") || entry.endsWith(".java") || entry.endsWith(".css") || entry.endsWith(".html")) files.push(full);
      }
    } catch {}
  }
  walk(cwd);
  const lines: string[] = ["# Codebase Map\n"];
  lines.push(`Generated: ${new Date().toISOString()}\n`);
  lines.push(`Total source files: ${files.length}\n`);
  lines.push("---\n");
  for (const f of files.sort()) {
    const rel = f.replace(cwd, "").replace(/^[/\\]/, "");
    const content = readFile(f) ?? "";
    const lines_count = content.split("\n").length;
    const imports = (content.match(/^import .+ from .+$/gm) ?? []).slice(0, 5);
    const exports = (content.match(/^export (default |)const |^export (default |)function |^export (default |)class /gm) ?? []).slice(0, 3);
    lines.push(`## ${rel}`);
    lines.push(`- Lines: ${lines_count}`);
    if (imports.length) lines.push(`- Imports: ${imports.map(i => `\`${i.trim()}\``).join(", ")}`);
    if (exports.length) lines.push(`- Exports: ${exports.map(e => `\`${e.trim()}\``).join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}


function readCyberSkill(dir: string, domain: string): string {
  const skillDir = join(dir, "skills", domain);
  const skillFile = join(skillDir, "SKILL.md");
  let content = readFile(skillFile) ?? "";
  const examplesDir = join(skillDir, "examples");
  try {
    const entries = readdirSync(examplesDir);
    for (const entry of entries) {
      if (entry.endsWith(".md")) {
        const ex = readFile(join(examplesDir, entry));
        if (ex) content += `\n\n## Example: ${entry}\n${ex.slice(0, 1000)}`;
      }
    }
  } catch {}
  if (!content) {
    const mukulDir = join(dir, "skills-mukul");
    try {
      const entries = readdirSync(mukulDir);
      const match = entries.find(e => e.includes(domain.replace(/[^a-z0-9]/g, "-")));
      if (match) {
        const mukulSkill = readFile(join(mukulDir, match, "SKILL.md"));
        if (mukulSkill) content = mukulSkill.slice(0, 4000);
      }
    } catch {}
  }
  return content || `No skill file found for '${domain}'.`;
}
function listCyberSkills(dir: string): string[] {
  const skills: string[] = [];
  for (const sub of ["skills", "skills-mukul"]) {
    try {
      const entries = readdirSync(join(dir, sub));
      for (const e of entries) {
        if (fileExistsSync(join(dir, sub, e, "SKILL.md"))) {
          skills.push(`${sub === "skills-mukul" ? "[M] " : ""}${e}`);
        }
      }
    } catch {}
  }
  return skills;
}
function readCyberFrameworkMapping(dir: string, framework: string): string {
  const fw = framework.toLowerCase();
  const fwDir = join(dir, "mappings", fw === "mitre" ? "mitre-attack" : fw === "nist" ? "nist-csf" : fw === "owasp" ? "owasp" : fw);
  try {
    const entries = readdirSync(fwDir);
    let result = `[HEXZ Cyber] Framework: ${framework.toUpperCase()}\n\n`;
    for (const entry of entries) {
      if (entry.endsWith(".md")) {
        const content = readFile(join(fwDir, entry));
        if (content) result += `--- ${entry} ---\n${content.slice(0, 2000)}\n\n`;
      }
    }
    if (fw === "mitre") {
      const navFile = join(dir, "mappings", "attack-navigator-layer.json");
      const nav = readFile(navFile);
      if (nav) result += `\nATT&CK Navigator layer available (${Math.floor(nav.length / 1024)} KB JSON).\n`;
    }
    return result;
  } catch {
    return `[HEXZ Cyber] Framework '${framework}' not found. Available: mitre, nist, owasp`;
  }
}

function readCraftSection(dir: string, section: string): string {
  const path = join(dir, "craft", `${section}.md`);
  const content = readFile(path);
  if (content === null) return "";
  const lines = content.split("\n").filter(l => !l.startsWith("> ")).slice(0, 60);
  return lines.join("\n").trim();
}

function readDesignSystemDESIGN(dir: string, slug: string): string {
  const path = join(dir, "design-systems", slug, "DESIGN.md");
  const content = readFile(path);
  if (content === null) return "";
  const lines = content.split("\n").filter(l => !l.startsWith("> ")).slice(0, 120);
  return lines.join("\n").trim();
}

function readOpenDesignTemplate(dir: string, slug: string): string {
  const templateDir = join(dir, "design-templates", slug);
  const htmlFiles: string[] = [];
  const mdFiles: string[] = [];
  try {
    const entries = readdirSync(templateDir);
    for (const entry of entries) {
      if (entry.endsWith(".html")) htmlFiles.push(entry);
      else if (entry.endsWith(".md")) mdFiles.push(entry);
    }
  } catch { return ""; }
  for (const files of [htmlFiles, mdFiles]) {
    for (const f of files) {
      const content = readFile(join(templateDir, f));
      if (content !== null) return content.slice(0, 3000).trim();
    }
  }
  return "";
}

function readUserDESIGNMD(projectDir: string): string {
  const path = join(projectDir, "DESIGN.md");
  return readFile(path) ?? "";
}
interface MessagePart {
  type?: string;
  text?: string;
}
interface DDGTopic {
  Text?: string;
  FirstURL?: string;
}
interface DDGResponse {
  RelatedTopics?: DDGTopic[];
}
interface SearchCacheEntry {
  result: string;
  timestamp: number;
}
const state = {
  active: false,
  lastUserMessage: "",
  startTime: Date.now(),
  searches: 0,
  lastSearchTime: 0,
  msgCount: 0,
  diagnostics: [] as Array<{ file: string; line: number; message: string; severity: string }>,
};
const mcpConnections: Array<{ url: string; client: any }> = [];
const dbDir = join(homedir(), ".config", "opencode");
const dbPath = join(dbDir, "hexz-memory.json");
const memStore = new Map<string, string>();
try { mkdirSync(dbDir, { recursive: true }); } catch {}
try {
  const raw = readFileSync(dbPath, "utf-8");
  const data = JSON.parse(raw);
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") memStore.set(k, v);
  }
  const savedActive = memStore.get("active");
  if (savedActive === "true") state.active = true;
} catch {}
function saveMemory(): void {
  try { writeFileSync(dbPath, JSON.stringify(Object.fromEntries(memStore))); } catch {}
}
function getMemory(key: string): string | null {
  return memStore.get(key) ?? null;
}
function setMemory(key: string, value: string): void {
  memStore.set(key, value);
  saveMemory();
}
const ANSI = {
  hide: '\x1b[?25l', show: '\x1b[?25h',
  up: (n = 1) => `\x1b[${n}A`, down: (n = 1) => `\x1b[${n}B`,
  clearLine: '\x1b[2K', clearScreen: '\x1b[2J',
  moveTo: (row: number, col: number) => `\x1b[${row};${col}H`,
  cyan: '\x1b[36m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m',
  reset: '\x1b[0m', inverse: '\x1b[7m',
} as const;
function isTTY(): boolean { return Boolean(process.stdin.isTTY); }
async function readKey(): Promise<string> {
  return new Promise(resolve => {
    const cb = (data: Buffer) => {
      process.stdin.removeListener('data', cb);
      process.stdin.setRawMode(false);
      resolve(data.toString());
    };
    process.stdin.setRawMode(true);
    process.stdin.once('data', cb);
  });
}
function parseKey(s: string): string {
  if (s === '\x1b[A' || s === '\x1bOA') return 'up';
  if (s === '\x1b[B' || s === '\x1bOB') return 'down';
  if (s === '\r' || s === '\n') return 'enter';
  if (s === '\x1b' || s === '\x03') return 'escape';
  if (s === '\x10') return 'ctrl-p';
  if (s.length === 1 && s >= ' ') return s;
  return '';
}
interface ModelRoute { model: string; keywords: string; }
function getModelRoutes(): ModelRoute[] {
  try {
    const raw = getMemory("model_routes");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function setModelRoutes(routes: ModelRoute[]): void {
  setMemory("model_routes", JSON.stringify(routes));
}
function isRoutingEnabled(): boolean {
  return getMemory("model_routing_enabled") === "true";
}
function getModelForTask(task: string): string | null {
  if (!isRoutingEnabled()) return null;
  const routes = getModelRoutes();
  const lower = task.toLowerCase();
  for (const r of routes) {
    const keywords = r.keywords.split(",").map(k => k.trim().toLowerCase());
    if (keywords.some(k => lower.includes(k))) return r.model;
  }
  return null;
}
async function showModelRoutingTUI(): Promise<string> {
  if (!isTTY()) return "Interactive TUI requires a TTY. Use hexz_memory to configure routes directly.";
  const stdout = process.stdout;
  let rendered = 0;
  const wl = (line: string) => { stdout.write(`${ANSI.clearLine}${line}\n`); rendered++; };
  const clr = () => { if (rendered > 0) { stdout.write(ANSI.up(rendered)); rendered = 0; } };
  const rr = () => { process.stdin.setRawMode(true); };
  const enabled = (): boolean => getMemory("model_routing_enabled") === "true";
  const routeCount = (): number => { try { const r = getMemory("model_routes"); return r ? JSON.parse(r).length : 0; } catch { return 0; } };
  const renderMenu = (cursor: number, items: string[]): void => {
    clr();
    const e = enabled();
    const rc = routeCount();
    wl(`${ANSI.bold}${ANSI.cyan}HEXZ Model Routing${ANSI.reset}`);
    wl(`${e ? `${ANSI.green}●${ANSI.reset}` : `${ANSI.red}○${ANSI.reset}`} ${e ? `Routing ON (${rc} route${rc !== 1 ? 's' : ''})` : 'No Routing (single model pass-through)'}`);
    wl("");
    for (let i = 0; i < items.length; i++) {
      const prefix = i === cursor ? `${ANSI.inverse} >${ANSI.reset}${ANSI.inverse}` : "  ";
      const suffix = i === cursor ? `${ANSI.reset}` : "";
      wl(`${prefix} ${items[i]}${suffix}`);
    }
    wl("");
    wl(`${ANSI.dim}↑↓ navigate  ↵ select  esc back${ANSI.reset}`);
    rr();
  };
  const e = enabled();
  const routes = getModelRoutes();
  const items = [
    e ? "Disable Routing" : "Enable Routing",
    "Add Route (model + keywords)",
    ...(routes.length > 0 ? ["Remove Route", "Clear All Routes"] : []),
    "Back",
  ];
  let cursor = 0;
  renderMenu(cursor, items);
  while (true) {
    const raw = await readKey();
    const key = parseKey(raw);
    if (key === 'up') { cursor = (cursor - 1 + items.length) % items.length; renderMenu(cursor, items); }
    else if (key === 'down') { cursor = (cursor + 1) % items.length; renderMenu(cursor, items); }
    else if (key === 'escape') { clr(); return "[HEXZ Models] Closed."; }
    else if (key === 'enter') {
      const selected = items[cursor];
      clr();
      const curRoutes = getModelRoutes();
      if (selected === "Enable Routing") {
        setMemory("model_routing_enabled", "true");
        stdout.write(`${ANSI.green}✓${ANSI.reset} Routing enabled\n`);
        return "[HEXZ Models] Routing enabled. Add routes with 'Add Route'.";
      }
      if (selected === "Disable Routing") {
        setMemory("model_routing_enabled", "false");
        stdout.write(`${ANSI.yellow}○${ANSI.reset} Routing disabled\n`);
        return "[HEXZ Models] Routing disabled. Using single model pass-through.";
      }
      if (selected === "Add Route (model + keywords)") {
        stdout.write(`${ANSI.bold}Add Route${ANSI.reset}\n`);
        stdout.write("Model name (e.g. gpt-4o, claude-3-opus): ");
        rr();
        const modelRaw = await readKey();
        const model = modelRaw.trim();
        stdout.write(`\n${ANSI.dim}${model}${ANSI.reset}\n`);
        stdout.write("Task keywords (comma-separated, e.g. design,ui,mockup): ");
        rr();
        const kwRaw = await readKey();
        const keywords = kwRaw.trim();
        stdout.write(`\n${ANSI.dim}${keywords}${ANSI.reset}\n`);
        if (model && keywords) {
          const current = getModelRoutes();
          current.push({ model, keywords });
          setModelRoutes(current);
          stdout.write(`${ANSI.green}✓${ANSI.reset} Route added: ${model} → ${keywords}\n`);
        } else {
          stdout.write(`${ANSI.red}✗${ANSI.reset} Both model and keywords required.\n`);
        }
        return "[HEXZ Models] Route added.";
      }
      if (selected === "Remove Route") {
        const removeItems = curRoutes.map((r: ModelRoute, i: number) => `${i + 1}. ${r.model} → ${r.keywords}`);
        removeItems.push("Cancel");
        let rCursor = 0;
        const renderRemove = () => {
          clr();
          wl(`${ANSI.bold}${ANSI.cyan}Select route to remove:${ANSI.reset}`);
          wl("");
          for (let i = 0; i < removeItems.length; i++) {
            const p = i === rCursor ? `${ANSI.inverse} >${ANSI.reset}${ANSI.inverse}` : "  ";
            const s = i === rCursor ? `${ANSI.reset}` : "";
            wl(`${p} ${removeItems[i]}${s}`);
          }
          wl("");
          wl(`${ANSI.dim}↑↓ navigate  ↵ select  esc back${ANSI.reset}`);
          rr();
        };
        renderRemove();
        while (true) {
          const rRaw = await readKey();
          const rKey = parseKey(rRaw);
          if (rKey === 'up') { rCursor = (rCursor - 1 + removeItems.length) % removeItems.length; renderRemove(); }
          else if (rKey === 'down') { rCursor = (rCursor + 1) % removeItems.length; renderRemove(); }
          else if (rKey === 'escape') { clr(); break; }
          else if (rKey === 'enter') {
            clr();
            if (removeItems[rCursor] === "Cancel") break;
            const idx = rCursor;
            const fresh = getModelRoutes();
            if (idx >= 0 && idx < fresh.length) {
              const removed = fresh.splice(idx, 1);
              setModelRoutes(fresh);
              stdout.write(`${ANSI.green}✓${ANSI.reset} Removed route: ${removed[0]!.model}\n`);
            }
            return "[HEXZ Models] Route removed.";
          }
        }
        cursor = 0;
        renderMenu(cursor, items);
        continue;
      }
      if (selected === "Clear All Routes") {
        setModelRoutes([]);
        stdout.write(`${ANSI.yellow}⚠${ANSI.reset} All routes cleared.\n`);
        return "[HEXZ Models] All routes cleared.";
      }
      if (selected === "Back") break;
    }
  }
  clr();
  return "[HEXZ Models] Closed.";
}

const searchCache = new Map<string, SearchCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_MS = 3000;
const INSIGHTS = [
  "Are you handling the error case where the input might be null or undefined?",
  "Does this change break any existing tests? Run the test suite to verify.",
  "Consider if this needs a migration or backward-compat shim for existing data.",
  "Did you check if there are similar patterns elsewhere in the codebase you should follow?",
  "Think about the edge case: what happens when the file is empty or malformed?",
  "Did you verify the types are consistent across the entire call chain?",
  "Is there a simpler existing utility in the codebase that already does this?",
  "Does this introduce any new dependencies? Is there a lighter alternative?",
  "Consider the failure mode: what if the API/database call times out?",
  "Are you handling both sync and async error paths for this operation?",
  "Does the change respect the existing naming conventions in this file?",
  "Think about logging: will this change make debugging harder for the next engineer?",
  "Did you check if this function is called from somewhere unexpected? grep for callers.",
  "Consider extracting this into a smaller helper function for testability.",
  "Are there any race conditions between this change and concurrent operations?",
  "Does this change need documentation updated? README, API docs, or inline comments?",
  "Think about the security boundary: is user input properly validated and sanitized?",
  "Consider the diff size: can this be broken into smaller, reviewable commits?",
];

const CYBER_DOMAINS = [
  { id: "recon", label: "Reconnaissance & OSINT", dir: "01-recon-osint", keywords: ["recon", "osint", "enumeration", "dns", "fingerprint"] },
  { id: "vuln_scan", label: "Vulnerability Scanning & Assessment", dir: "02-vulnerability-scanner", keywords: ["vuln", "cve", "cvss", "audit"] },
  { id: "exploit_dev", label: "Exploit Development & Payload Engineering", dir: "03-exploit-development", keywords: ["exploit", "payload", "shellcode", "buffer overflow"] },
  { id: "reverse_eng", label: "Reverse Engineering & Binary Analysis", dir: "04-reverse-engineering", keywords: ["reverse", "binary", "assembly", "firmware"] },
  { id: "malware", label: "Malware Analysis & Sandboxing", dir: "05-malware-analysis", keywords: ["malware", "yara", "sandbox", "static", "dynamic"] },
  { id: "threat_hunt", label: "Threat Hunting & IOC Analysis", dir: "06-threat-hunting", keywords: ["threat", "hunt", "ioc", "sigma", "mitre"] },
  { id: "incident_resp", label: "Incident Response & Digital Forensics", dir: "07-incident-response", keywords: ["incident", "forensics", "memory", "timeline"] },
  { id: "network_sec", label: "Network Security & Traffic Analysis", dir: "08-network-security", keywords: ["network", "pcap", "snort", "suricata", "firewall"] },
  { id: "webapp_sec", label: "Web Application Security Testing", dir: "09-web-security", keywords: ["web", "owasp", "sqli", "xss", "api", "jwt"] },
  { id: "cloud_sec", label: "Cloud Security & Container Hardening", dir: "10-cloud-security", keywords: ["cloud", "aws", "azure", "gcp", "docker", "k8s"] },
  { id: "soc_ops", label: "CSOC Operations & Playbook Automation", dir: "11-csoc-automation", keywords: ["soc", "playbook", "triage", "escalation"] },
  { id: "log_analysis", label: "Log Analysis & SIEM Integration", dir: "12-log-analysis", keywords: ["log", "siem", "spl", "kql", "anomaly"] },
  { id: "crypto", label: "Cryptographic Analysis & Assessment", dir: "13-crypto-analysis", keywords: ["crypto", "tls", "cipher", "key", "encryption"] },
  { id: "red_team", label: "Red Team Operations", dir: "14-red-team-ops", keywords: ["red team", "c2", "ad", "kerberos", "social"] },
  { id: "blue_team", label: "Blue Team Defense & Hardening", dir: "15-blue-team-defense", keywords: ["blue team", "hardening", "detection", "patching"] },
];
function isSafeInput(input: string): boolean {
  return /^[a-zA-Z0-9@.\/_\- ]+$/.test(input) && input.length <= 500;
}
function getMessageText(parts: MessagePart[]): string {
  for (const p of parts) {
    if (typeof p.text === "string" && p.text.length > 0) return p.text;
  }
  return "";
}
async function webSearch(query: string): Promise<string> {
  const q = query.trim().slice(0, 300);
  if (!q) return "Empty query";
  const cached = searchCache.get(q);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }
  const now = Date.now();
  if (now - state.lastSearchTime < RATE_LIMIT_MS) {
    return "Rate limited — try again in a few seconds";
  }
  state.lastSearchTime = now;
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) return `API ${res.status}`;
    const d = (await res.json()) as DDGResponse;
    const items = (d.RelatedTopics ?? [])
      .filter(
        (t): t is DDGTopic & { Text: string } => typeof t.Text === "string" && t.Text.length > 10,
      )
      .slice(0, 5)
      .map((t) => `• ${t.Text}`);
    const result = items.length ? items.join("\n") : "No results.";
    searchCache.set(q, { result, timestamp: Date.now() });
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.name : "unknown";
    return msg === "AbortError" ? "Timeout" : "Search failed";
  }
}
function guessTopic(cmd: string): string {
  const l = cmd.toLowerCase();
  const y = new Date().getFullYear();
  const tech: Record<string, string> = {
    react: "React",
    vue: "Vue",
    svelte: "Svelte",
    next: "Next.js",
    nuxt: "Nuxt",
    express: "Express.js",
    django: "Django",
    flask: "Flask",
    fastapi: "FastAPI",
    spring: "Spring Boot",
    laravel: "Laravel",
    rails: "Ruby on Rails",
    rust: "Rust",
    python: "Python",
    typescript: "TypeScript",
    javascript: "JavaScript",
    java: "Java",
    ruby: "Ruby",
    php: "PHP",
    swift: "Swift",
    kotlin: "Kotlin",
    csharp: "C#",
    docker: "Docker",
    kubernetes: "Kubernetes",
    k8s: "Kubernetes",
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    redis: "Redis",
    mongodb: "MongoDB",
    graphql: "GraphQL",
    grpc: "gRPC",
    websocket: "WebSocket",
    jwt: "JWT",
    oauth: "OAuth2",
    auth: "authentication",
    testing: "testing",
    deploy: "deployment",
    cicd: "CI/CD",
    frontend: "frontend",
    backend: "backend",
    fullstack: "fullstack",
  };
  for (const [k, v] of Object.entries(tech)) {
    const regex = new RegExp(`\\b${k}\\b`, "i");
    if (regex.test(l)) return `${v} best practices ${y}`;
  }
  return state.lastUserMessage.slice(0, 80) || "web development";
}
const BUILD_PATTERNS = [
  "npm install",
  "npm create",
  "npx create",
  "yarn add",
  "yarn create",
  "bun install",
  "bun add",
  "bun create",
  "bun init",
  "pip install",
  "pip3 install",
  "poetry add",
  "cargo init",
  "cargo new",
  "cargo add",
  "go mod init",
  "git clone",
  "git init",
  "mkdir",
  "touch ",
  "npm run build",
];
function isBuild(cmd: string): boolean {
  const l = cmd.toLowerCase();
  return BUILD_PATTERNS.some((p) => l.includes(p));
}
const INSTALL_PATTERNS = [
  "npm install",
  "npm i ",
  "yarn add",
  "yarn install",
  "bun add",
  "bun install",
  "pip install",
  "pip3 install",
  "poetry add",
  "cargo install",
  "cargo add",
  "go get",
  "go mod",
];
function isInstall(cmd: string): boolean {
  const l = cmd.toLowerCase();
  return INSTALL_PATTERNS.some((p) => l.includes(p));
}
async function fileExists(path: string): Promise<boolean> {
  return fileExistsSync(path);
}
async function detectProjectType(dir: string): Promise<string[]> {
  const types: string[] = [];
  if (await fileExists(`${dir}/package.json`)) types.push("node");
  if ((await fileExists(`${dir}/requirements.txt`)) || (await fileExists(`${dir}/pyproject.toml`)))
    types.push("python");
  if (await fileExists(`${dir}/Cargo.toml`)) types.push("rust");
  if (await fileExists(`${dir}/go.mod`)) types.push("go");
  if (await fileExists(`${dir}/Gemfile`)) types.push("ruby");
  if (await fileExists(`${dir}/composer.json`)) types.push("php");
  if ((await fileExists(`${dir}/pom.xml`)) || (await fileExists(`${dir}/build.gradle`)))
    types.push("java");
  return types;
}
async function runSemgrepScan(target: string, $: any): Promise<string> {
  try {
    const result =
      await $`semgrep --config=p/owasp-top-ten --config=p/secrets --json --quiet ${target}`.text();
    const parsed = JSON.parse(result);
    const findings = parsed.results ?? [];
    if (findings.length === 0) return "No vulnerabilities found with semgrep.";
    const lines = [`Found ${findings.length} potential issues:\n`];
    for (const finding of findings.slice(0, 20)) {
      const severity = finding.extra?.severity ?? "unknown";
      const msg = finding.extra?.message ?? "No message";
      const path = finding.path ?? "unknown";
      const line = finding.start?.line ?? "?";
      lines.push(`[${severity}] ${path}:${line} — ${msg}`);
    }
    if (findings.length > 20) lines.push(`\n... and ${findings.length - 20} more.`);
    return lines.join("\n");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return `Semgrep failed: ${msg}`;
  }
}
async function runNpmAudit(dir: string, $: any): Promise<string> {
  try {
    const result = await $`npm audit --json`.cwd(dir).text();
    const parsed = JSON.parse(result);
    const vulns = parsed.vulnerabilities ?? {};
    const total = parsed.metadata?.vulnerabilities ?? {};
    const lines: string[] = [];
    if (total.high > 0 || total.critical > 0) {
      lines.push(`⚠️  ${total.critical} critical, ${total.high} high vulnerabilities`);
    } else if (total.moderate > 0) {
      lines.push(`⚠️  ${total.moderate} moderate vulnerabilities`);
    } else {
      lines.push("✅ No npm vulnerabilities found.");
    }
    for (const [name, info] of Object.entries(vulns).slice(0, 10)) {
      const severity = (info as any).severity ?? "unknown";
      const fixAvailable = (info as any).fixAvailable ? " (fix available)" : "";
      lines.push(`  - ${name}: ${severity}${fixAvailable}`);
    }
    return lines.join("\n");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return `npm audit failed: ${msg}`;
  }
}
async function runPipAudit(dir: string, $: any): Promise<string> {
  try {
    const result = await $`pip-audit --format=json`.cwd(dir).text();
    const parsed = JSON.parse(result);
    const vulns = parsed.dependencies ?? [];
    const lines: string[] = [];
    const vulnerable = vulns.filter((v: any) => v.vulns && v.vulns.length > 0);
    if (vulnerable.length === 0) {
      return "✅ No pip vulnerabilities found.";
    }
    lines.push(`Found ${vulnerable.length} packages with vulnerabilities:`);
    for (const pkg of vulnerable.slice(0, 10)) {
      lines.push(`  - ${pkg.name} ${pkg.version}: ${pkg.vulns.length} vulnerabilities`);
    }
    return lines.join("\n");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return `pip-audit failed: ${msg}`;
  }
}
async function runDependencyScan(command: string, $: any): Promise<string> {
  const lines: string[] = [];
  if (
    command.includes("npm install") ||
    command.includes("npm i ") ||
    command.includes("yarn add") ||
    command.includes("bun add")
  ) {
    lines.push("Running npm audit...");
    const result = await runNpmAudit(".", $);
    lines.push(result);
  }
  if (
    command.includes("pip install") ||
    command.includes("pip3 install") ||
    command.includes("poetry add")
  ) {
    lines.push("Running pip-audit...");
    const result = await runPipAudit(".", $);
    lines.push(result);
  }
  if (command.includes("cargo install") || command.includes("cargo add")) {
    lines.push("Cargo audit not implemented yet.");
  }
  if (command.includes("go get") || command.includes("go mod")) {
    lines.push("Go vulnerability check not implemented yet.");
  }
  return lines.length > 0 ? lines.join("\n") : "No dependency install detected.";
}
async function scanForSecrets(target: string): Promise<string> {
  const secretPatterns = [
    { name: "API Key", regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]+)['"]/gi },
    { name: "Secret Key", regex: /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"]([^'"]+)['"]/gi },
    { name: "Password", regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi },
    {
      name: "Token",
      regex: /(?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]([^'"]+)['"]/gi,
    },
    { name: "AWS Key", regex: /(?:AKIA[0-9A-Z]{16})/g },
    { name: "Private Key", regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
    { name: "GitHub Token", regex: /ghp_[a-zA-Z0-9]{36}/g },
    { name: "Slack Token", regex: /xox[baprs]-[a-zA-Z0-9-]+/g },
  ];
  const findings: string[] = [];
  try {
    const content = readFile(target);
    if (content !== null) {
      for (const pattern of secretPatterns) {
        const matches = content.match(pattern.regex);
        if (matches) {
          findings.push(`Found ${pattern.name} pattern in ${target}`);
        }
      }
    }
  } catch {
  
  }
  return findings.length > 0 ? findings.join("\n") : "No secret patterns detected.";
}
function generateDesignScaffoldHTML(designSpec: string): string {
  const colorScheme = { bg: "#fafafa", fg: "#111111", accent: "#2F6FEB", muted: "#6B6B6B", border: "#E5E5E5", surface: "#FFFFFF" };
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HEXZ Design Scaffold</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${colorScheme.bg}; color: ${colorScheme.fg}; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 3rem; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; font-weight: 600; line-height: 1.3; margin-bottom: 1rem; color: ${colorScheme.muted}; }
    p { font-size: 1rem; line-height: 1.6; max-width: 65ch; margin-bottom: 1rem; }
    .btn { display: inline-flex; align-items: center; padding: 0.625rem 1rem; background: ${colorScheme.accent}; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 510; font-size: 0.9375rem; line-height: 1.5; letter-spacing: 0.02em; }
    .btn:hover { opacity: 0.9; }
    header { padding: 2rem; border-bottom: 1px solid ${colorScheme.border}; }
    header nav a { margin-right: 1rem; color: ${colorScheme.accent}; text-decoration: none; }
    header nav a:hover { text-decoration: underline; }
    section { padding: 5rem 2rem; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    .card { background: ${colorScheme.surface}; border: 1px solid ${colorScheme.border}; border-radius: 12px; padding: 1.25rem; }
    .card h3 { font-size: 1.25rem; font-weight: 590; margin-bottom: 0.5rem; }
    .card p { font-size: 0.9375rem; color: ${colorScheme.muted}; }
    .hero { text-align: center; padding: 6rem 2rem; }
    .hero p { margin: 1rem auto 2rem; }
    .badge { display: inline-block; background: ${colorScheme.accent}; color: #fff; font-size: 0.8125rem; font-weight: 510; padding: 0.25rem 0.75rem; border-radius: 4px; letter-spacing: 0.02em; margin-bottom: 1rem; }
  </style>
</head>
<body>${designSpec}</body>
</html>`;
}

function redactSecrets(text: string): string {
  const redactionPatterns = [
    {
      name: "API Key",
      regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]+)['"]/gi,
      replacement: "$1=REDACTED",
    },
    {
      name: "Secret Key",
      regex: /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"]([^'"]+)['"]/gi,
      replacement: "$1=REDACTED",
    },
    {
      name: "Password",
      regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi,
      replacement: "$1=REDACTED",
    },
    {
      name: "Token",
      regex: /(?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]([^'"]+)['"]/gi,
      replacement: "$1=REDACTED",
    },
    { name: "AWS Key", regex: /AKIA[0-9A-Z]{16}/g, replacement: "AKIA_REDACTED" },
    {
      name: "Private Key",
      regex:
        /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
      replacement: "-----BEGIN PRIVATE KEY-----\nREDACTED\n-----END PRIVATE KEY-----",
    },
    { name: "GitHub Token", regex: /ghp_[a-zA-Z0-9]{36}/g, replacement: "ghp_REDACTED" },
    { name: "Slack Token", regex: /xox[baprs]-[a-zA-Z0-9-]+/g, replacement: "xox_REDACTED" },
    {
      name: "Connection String",
      regex: /(?:mongodb|mysql|postgres|redis):\/\/[^'"@\s]+:[^'"@\s]+@[^'"@\s]+/gi,
      replacement: "REDACTED_CONNECTION_STRING",
    },
  ];
  let redacted = text;
  for (const pattern of redactionPatterns) {
    redacted = redacted.replace(pattern.regex, pattern.replacement);
  }
  return redacted;
}
const SYSTEM_PROMPT = `
[HEXZ SENIOR ENGINEER]
Ship working code, not essays.
- Answer in 1-3 sentences first, then code. Never "Sure!"/"Great question!"/"Certainly!".
- Use contractions. No filler: "delve","leverage","robust","seamless","landscape","utilize".
- No AI-template structure. No default Tailwind indigo, purple→blue gradients, emoji icons, lorem ipsum.
- Before responding, scan for slop patterns and eliminate them. Target: 90% reduction.

TOOLS — call these when relevant:
hexz_search — Web search. Call BEFORE writing code. Get current API docs, breaking changes.
hexz_scan   — Security audit. Run AFTER building. Injections, XSS, secrets, deps, CVSS.
hexz_design — UI scaffold. Call when user asks for a design/mockup.
hexz_image  — Image analysis. Call when user shares an image.
hexz_mkp    — Plugin/skill marketplace.
hexz_status — Check if HEXZ is active.
hexz_sim    — Simulation sandbox. Call BEFORE destructive actions (Write/Edit/Bash-rm/mv/cp).
hexz_codebase — Scan project, generate codebase.md with file connections.
hexz_cyber  — Cybersecurity. 15 domains (recon, exploit, malware, forensics, etc).
hexz_webss — Web screenshot via Puppeteer (capture-website). Capture site visuals.
hexz_mcp   — MCP server management. Connect to external servers for DB/FS/API.
hexz_memory — Persistent memory across sessions. Store project context & preferences.
hexz_pr    — Git PR workflow. Status, diff, create pull requests with gh CLI.

WORKFLOW:
- Read tools (Read/Glob/Grep): IMAGINE impact first.
- Destructive tools (Write/Edit/Bash-rm/mv/cp/>): SIMULATE first.
  a. Think: what breaks?
  b. hexz_sim(name, plan, files) → .sims/simscode-<name>/
  c. Verify sim for edge cases
  d. Execute only if clean. Re-simulate if issues.
- Build: hexz_search → plan → build → hexz_scan → respond
- Code review: read → find bugs → fix → hexz_scan if security-relevant
`.trim();
const RECALL_REMINDER = `
══ RECALL ══
You are in HEXZ mode. Key rules you must follow RIGHT NOW:
1. Answer first (1-3 sentences), THEN code.
2. Use hexz_search BEFORE writing code (every time).
3. Destructive changes (Write/Edit/Bash-rm): use hexz_sim() to simulate first.
4. Run hexz_scan after building.
5. No filler words. No emoji icons. No lorem ipsum.
6. If user shares an image, use hexz_image().
7. If user asks for a design, use hexz_design().
8. If security-related, use hexz_cyber().
══ END RECALL ══
`.trim();
const CONTEXT_PRESERVE = `
[HEXZ] Active senior-engineer mode. Workflow: search → plan → sim → build → scan.
Tools: hexz_search|scan|design|image|webss|mcp|memory|pr|mkp|status|sim|codebase|cyber.
Destructive actions require hexz_sim() first. No filler, no slop, no AI-template structure.
`.trim();
export const HexzPlugin: Plugin = async (input: any, _options?: any) => {
  const { client, $ } = input || {} as any;
  const projectDir = input?.directory ?? ".";
  async function sendNotification(title: string, message: string): Promise<void> {
    try {
      const platform = process.platform;
      if (platform === "linux") {
        await $`notify-send ${title} ${message}`.quiet();
      } else if (platform === "darwin") {
        await $`osascript -e 'display notification "${message}" with title "${title}"'`.quiet();
      } else if (platform === "win32") {
        await $`powershell -Command "New-BurntToastNotification -Text '${title}', '${message}'"`.quiet();
      }
    } catch {
    
    }
  }
  async function installPlugin(
    target: string,
    pluginsDir: string,
    projectDir: string,
  ): Promise<string> {
  
    if (target.includes("/") && !target.startsWith("http")) {
      const parts = target.split("/");
      if (parts.length !== 2) return "Use owner/repo format";
      const owner = parts[0]!.replace(/[^a-zA-Z0-9._-]/g, "");
      const repo = parts[1]!.replace(/[^a-zA-Z0-9._-]/g, "");
      if (!owner || !repo) return "Invalid owner or repo name";
      const exists = fileExistsSync(`${pluginsDir}/${repo}/package.json`);
      if (exists) return `Plugin '${repo}' already installed. Use 'mkp remove:${repo}' first.`;
      try {
        await $`git clone https://github.com/${owner}/${repo}.git ${pluginsDir}/${repo} --depth 1`;
        return `Installed plugin ${owner}/${repo}. Restart opencode to activate.`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        return `Failed to clone ${owner}/${repo}: ${msg}`;
      }
    }
  
    if (target.startsWith("http://") || target.startsWith("https://")) {
      const name =
        target
          .split("/")
          .pop()
          ?.replace(/\.git$/, "") ?? "plugin";
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "");
      if (!safeName) return "Could not determine plugin name from URL";
      try {
        await $`git clone ${target} ${pluginsDir}/${safeName} --depth 1`;
        return `Installed plugin from URL as '${safeName}'. Restart opencode to activate.`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        return `Failed to clone: ${msg}`;
      }
    }
  
    if (/^[a-zA-Z0-9@._-]+$/.test(target)) {
      try {
        await $`bun add ${target} --cwd ${projectDir}`;
        return `Installed ${target}. Add to opencode.json plugin list, then restart.`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        return `Failed to install ${target}: ${msg}`;
      }
    }
    return "Invalid target. Use 'owner/repo', 'https://url', or 'npm-package'.";
  }
  async function installSkill(target: string, commandsDir: string): Promise<string> {
  
    if (target.includes("--content")) {
      const match = target.match(/^(\S+)\s+--content\s+"(.+)"$/);
      if (!match) return 'Usage: skill:name --content "description and prompt"';
      const name = match[1]!.replace(/[^a-zA-Z0-9._-]/g, "");
      const content = match[2]!;
      if (!name) return "Invalid skill name";
      const skillContent = `---\ndescription: ${name}\n---\n${content}`;
      writeFile(`${commandsDir}/${name}.md`, skillContent);
      return `Created skill '${name}'. Use /${name} to run it.`;
    }
  
    if (target.includes("/")) {
      const parts = target.split("/");
      if (parts.length !== 2) return "Use owner/repo format";
      const owner = parts[0]!.replace(/[^a-zA-Z0-9._-]/g, "");
      const repo = parts[1]!.replace(/[^a-zA-Z0-9._-]/g, "");
      if (!owner || !repo) return "Invalid owner or repo name";
      const tmpDir = `/tmp/hexz-skill-${Date.now()}`;
      try {
        await $`git clone https://github.com/${owner}/${repo}.git ${tmpDir} --depth 1`;
        const skillsInstalled: string[] = [];
      
        const searchDirs = ["", "skills", "commands", ".opencode/commands"];
        for (const sub of searchDirs) {
          const dir = sub ? `${tmpDir}/${sub}` : tmpDir;
          try {
          for (const mdFile of globSync("**/*.md", dir)) {
              const text = readFile(mdFile);
              if (text === null || !text.includes("---")) continue;
              const filename = mdFile.split("/").pop()!;
              writeFile(`${commandsDir}/${filename}`, text);
              skillsInstalled.push(filename.replace(/\.md$/, ""));
            }
          } catch {
          
          }
        }
        await $`rm -rf ${tmpDir}`;
        if (skillsInstalled.length === 0) {
          return `Cloned ${owner}/${repo} but found no skill files (.md with frontmatter). Check the repo structure.`;
        }
        return `Installed ${skillsInstalled.length} skill(s): ${skillsInstalled.join(", ")}. Restart opencode.`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        await $`rm -rf ${tmpDir}`.catch(() => {});
        return `Failed: ${msg}`;
      }
    }
    return 'Use skill:owner/repo or skill:name --content "..."';
  }
  async function listInstalled(pluginsDir: string, commandsDir: string): Promise<string> {
    const lines: string[] = ["[HEXZ Market] Installed:\n"];
  
    lines.push("Plugins:");
    let pluginCount = 0;
    try {
      const entries = readdirSync(pluginsDir);
      for (const entry of entries) {
        const fullPath = join(pluginsDir, entry);
        if (statSync(fullPath).isDirectory() && fileExistsSync(join(fullPath, "package.json"))) {
          lines.push(`  - ${entry}`);
          pluginCount++;
        }
      }
      if (pluginCount === 0) lines.push("  (none)");
    } catch {
      lines.push("  (none)");
    }
  
    lines.push("\nSkills:");
    let skillCount = 0;
    try {
      const entries = readdirSync(commandsDir);
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          const name = entry.replace(/\.md$/, "");
          lines.push(`  - ${name}`);
          skillCount++;
        }
      }
      if (skillCount === 0) lines.push("  (none)");
    } catch {
      lines.push("  (none)");
    }
    return lines.join("\n");
  }
  async function removeItem(
    name: string,
    pluginsDir: string,
    commandsDir: string,
  ): Promise<string> {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!safeName) return "Invalid name";
  
    const pluginPath = `${pluginsDir}/${safeName}`;
    try {
      await $`rm -rf ${pluginPath}`;
      return `Removed plugin '${safeName}'. Restart opencode.`;
    } catch {
    
    }
  
    const skillPath = `${commandsDir}/${safeName}.md`;
    if (fileExistsSync(skillPath)) {
      await $`rm -f ${skillPath}`;
      return `Removed skill '${safeName}'. Restart opencode.`;
    }
    return `Nothing found matching '${safeName}'. Use 'mkp list' to see installed items.`;
  }
  client.app.log?.({
    body: { service: "hexz", level: "info", message: `Loaded v${VERSION}`, extra: {} },
  });
  return {
    "chat.message": async (_input, output) => {
      const text = getMessageText(output.parts);
      state.lastUserMessage = text;
      state.msgCount++;
      if (text.includes("HEXZ_ACTIVATE") || text.trim() === "/active" || /engage\s+hexz/i.test(text)) {
        state.active = true;
        setMemory("active", "true");
        output.parts = [];
        return;
      }
      if (text.includes("HEXZ_DEACTIVATE") || text.trim() === "/off" || /revert\s+to\s+default/i.test(text)) {
        state.active = false;
        setMemory("active", "false");
        output.parts = [];
        return;
      }
      if (text.includes("HEXZ_MODELS") || text.trim() === "/models" || text.includes("\x10")) {
        output.parts = [];
        const result = await showModelRoutingTUI();
        output.parts.push({ text: result } as any);
        return;
      }

    },
    "experimental.chat.system.transform": async (_input, output) => {
      if (!state.active) return;
      output.system.push(SYSTEM_PROMPT);
      if (state.msgCount > 0 && state.msgCount % 3 === 0) {
        const pick = INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)]!;
        output.system.push(`[HEXZ Self-Review]: ${pick}`);
      }
      if (state.msgCount > 0 && state.msgCount % 4 === 0) {
        output.system.push(RECALL_REMINDER);
      }
    },
    "command.execute.before": async (input, output) => {
      if (input.command === "active") {
        state.active = true;
        setMemory("active", "true");
        output.parts = [];
        return;
      }
      if (input.command === "off") {
        state.active = false;
        setMemory("active", "false");
        output.parts = [];
        return;
      }
      if (input.command === "models") {
        output.parts = [];
        const result = await showModelRoutingTUI();
        output.parts.push({ text: result } as any);
        return;
      }
    },
    "chat.params": async (input: any, output: any) => {
      if (!state.active) return;
      output.temperature = 0.3;
      const msg: string = input.message?.content ?? "";
      const routed = getModelForTask(msg);
      if (routed) {
        output.model = routed;
      }
    },
    "permission.ask": async (input, output) => {
      if (!state.active) return;
      const safe = ["read", "glob", "grep", "ls"];
      if (input.type && safe.some((s) => input.title.toLowerCase().includes(s))) {
        output.status = "allow";
      }
    },
    "shell.env": async (_input, output) => {
      if (!state.active) return;
      output.env["HEXZ"] = "1";
      output.env["NODE_ENV"] = output.env["NODE_ENV"] ?? "development";
    },
    "tool.execute.before": async (input, output) => {
      if (!state.active) return;
      if (input.tool !== "Bash" && input.tool !== "Write" && input.tool !== "Edit") return;
      const args = JSON.stringify(output.args ?? "");
    
      if (isInstall(args)) {
        let result = "[HEXZ] Dependency Security Scan\n\n";
        try {
          result += await runDependencyScan(args, $);
        } catch {
          result += "Dependency scan unavailable";
        }
        result += "\n\n[HEXZ] Review the above before proceeding with installation.";
        throw new Error(result);
      }
    
      if (isBuild(args)) {
        state.searches++;
        const topic = guessTopic(args);
        let result = `[HEXZ] Researching: "${topic}"\n\n`;
        try {
          result += (await webSearch(topic)).slice(0, 1200);
        } catch {
          result += "Search unavailable";
        }
        result += "\n\n[HEXZ] Use the above to inform your build. Then proceed.";
        throw new Error(result);
      }
    
      const destructivePatterns = ["rm ", "mv ", "cp ", ">", ">>", "|", "dd ", "chmod ", "chown ", "mkfs", "format"];
      const isDestructive = destructivePatterns.some(p => args.includes(p));
      if (isDestructive || input.tool === "Write" || input.tool === "Edit") {
        let insight = "";
        if (Math.random() < 0.8) {
          const pick = INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)]!;
          insight = `\n\nInsight <==\n${pick}\n=======>\n`;
        }
        const simDir = join(projectDir, SIMS_DIR);
        const hasSim = fileExistsSync(simDir) && readdirSync(simDir).length > 0;
        if (!hasSim) {
          throw new Error(
            "[HEXZ] SAFETY: No simulation found for this destructive action.\n" +
            `Create a simulation first: use hexz_sim(name="describe-change") to sandbox at ${SIMS_DIR}/simscode-<name>/\n` +
            "1. Think about what files are affected and what could break\n" +
            "2. Run hexz_sim() to create the sim sandbox\n" +
            "3. Review the simulation for errors and edge cases\n" +
            "4. If the sim is clean, retry this action" +
            insight
          );
        }
      }
    },
    "tool.execute.after": async (_input, output) => {
      if (!state.active) return;
      let cleaned = output.output.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "").replace(/\r\n/g, "\n");
    
      cleaned = redactSecrets(cleaned);
      if (cleaned.length > 4000) {
        cleaned = `${cleaned.slice(0, 4000)}\n\n[HEXZ] Truncated — showing first 4000 chars.`;
      }
    
      output.output = cleaned;
    },
    "tool.definition": async (input, output) => {
      const desc: Record<string, string> = {
        hexz_search:
          "Web search via DuckDuckGo. Returns latest docs, API changes, breaking changes, best practices. Call BEFORE writing any code — always get current info first.",
        hexz_scan:
          "Security audit: injection, XSS, secrets, dependency vulns, data flow, auth, crypto. CVSS v3.1 scores. Run after building to catch vulnerabilities.",
        hexz_design:
          "Generate HTML/CSS design scaffolds from a brief. Applies craft rules, design systems, or project DESIGN.md. Call to create UI mockups.",
        hexz_image:
          "Analyze images: UI screenshots, error messages, diagrams, mockups. Describe what you see and execute (replicate UI, fix errors, code from diagrams).",
        hexz_mkp:
          "Install plugins & skills from GitHub or npm. Commands: list, remove:name, owner/repo, npm-pkg, skill:owner/repo, skill:name --content \"...\"",
        hexz_status:
          "Show HEXZ status: active/inactive, uptime, search count, cache entries.",
        hexz_sim:
          "Simulation sandbox for destructive actions. Creates .sims/simscode-<name>/ with a diff of proposed changes. Call BEFORE Write/Edit/Bash-rm/mv/cp. Pass the plan and files to simulate.",
        hexz_codebase:
          "Scan the project and generate/update codebase.md. Shows every source file, its imports, exports, line count, and connections. Read this before making changes to understand the full picture.",
        hexz_cyber:
          "Cybersecurity skills & framework mappings. 15 core domains: recon, vuln scan, exploit dev, reverse engineering, malware analysis, threat hunting, incident response, network/web/cloud security, forensics, SOC, crypto, red/blue team. Mapped to MITRE ATT&CK, NIST CSF 2.0, OWASP Top 10. Call for any security-related task.",
        hexz_webss:
          "Capture screenshots of websites via Puppeteer. Use for visual debugging, design reference, or archiving. Requires capture-website + Puppeteer.",
        hexz_mcp:
          "MCP (Model Context Protocol) server management. Connect/discover/call tools on external MCP servers for DB, filesystem, and API access.",
        hexz_memory:
          "Persistent agent memory across sessions. Get/set/list/clear stored project context, preferences, and summaries.",
        hexz_pr:
          "Git PR workflow. Check status, diff, and create pull requests with AI descriptions. Requires git + gh CLI.",
      };
      if (!desc[input.toolID]) return;
      output.description = state.active ? desc[input.toolID] : "[HEXZ OFF] Activate with /active first.";
    },
    "session.idle": async (_input: any, _output: any) => {
      if (!state.active) return;
      const up = Math.floor((Date.now() - state.startTime) / 1000);
      const minutes = Math.floor(up / 60);
      const seconds = up % 60;
      const diagCount = state.diagnostics.filter(d => d.severity === "error").length;
      const message = `HEXZ active for ${minutes}m${seconds}s. ${state.searches} searches. ${diagCount} errors.`;
      await sendNotification("HEXZ Status", message);
    
      const prevSearches = parseInt(getMemory("total_searches") ?? "0", 10);
      setMemory("total_searches", String(prevSearches + state.searches));
      setMemory("last_session_summary", `${minutes}m session, ${state.searches} searches, ${diagCount} LSP errors`);
    },
    "lsp.client.diagnostics": async (input: any, _output: any) => {
      if (!state.active) return;
    
      state.diagnostics = input.diagnostics ?? [];
    
      const errors = state.diagnostics.filter((d) => d.severity === "error");
      if (errors.length > 0) {
        const summary = errors
          .slice(0, 3)
          .map((e) => `${e.file}:${e.line} — ${e.message}`)
          .join("; ");
        const msg =
          errors.length === 1 ? `1 error: ${summary}` : `${errors.length} errors: ${summary}`;
        await sendNotification("LSP Errors", msg);
      }
    },
    "file.edited": async (input: any, _output: any) => {
      if (!state.active) return;
      const fp = input.path;
      if (!fp) return;
    
      try {
        await $`biome format --write ${fp}`.quiet();
      } catch {
        try {
          await $`prettier --write ${fp}`.quiet();
        } catch {}
      }
    
      const srcPatterns = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java"];
      const ext = srcPatterns.find(e => fp.endsWith(e));
      if (!ext) return;
    
      const base = fp.slice(0, -ext.length);
      const testExts = [".test.ts", ".test.tsx", ".test.js", ".test.jsx", "_test.py", "_test.rs", "_test.go", "Test.java"];
      const testExists = testExts.some(te => fileExistsSync(base + te));
      if (!testExists) {
        state.lastUserMessage = `[HEXZ] File edited: ${fp}. Consider adding tests. No test file found at ${base}*.`;
      }
    },
    "session.created": async (input: any, _output: any) => {
      const sessions = parseInt(getMemory("sessions") ?? "0", 10);
      setMemory("sessions", String(sessions + 1));
      const dir = input.directory ?? ".";
      const projectTypes = await detectProjectType(dir);
      if (projectTypes.length > 0) {
        setMemory("project_context", projectTypes.join(", "));
        if (!state.active) {
          state.active = true;
          setMemory("active", "true");
        }
      }
      const prevSum = getMemory("last_session_summary");
      if (prevSum && state.active) {
        state.lastUserMessage = `[HEXZ] Previous session: ${prevSum.slice(0, 200)}`;
      }
    },
    "experimental.session.compacting": async (_input, output) => {
      if (!state.active) return;
      output.context = output.context ?? [];
      output.context.push(CONTEXT_PRESERVE);
    },
    tool: {
      hexz_search: tool({
        description:
          "Web search via DuckDuckGo. Use before building code. Finds latest docs, API changes, breaking changes, best practices.",
        args: { query: tool.schema.string() },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          if (!isSafeInput(args.query))
            return "Invalid query — only alphanumeric, spaces, hyphens, dots, slashes, underscores allowed.";
          state.searches++;
          return await webSearch(args.query);
        },
      }),
      hexz_scan: tool({
        description:
          "Security audit: injection, XSS, secrets, deps, data flow, auth, crypto. CVSS v3.1 per finding.",
        args: {
          target: tool.schema.string(),
          mode: tool.schema.string().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          if (!isSafeInput(args.target)) return "Invalid target path.";
          const m = args.mode ?? "full";
          const lines: string[] = [`[HEXZ Scan] ${args.target} (${m})\n`];
        
          const projectTypes = await detectProjectType(args.target);
        
          if (m === "full" || m === "quick") {
          
            try {
              const semgrepResult = await runSemgrepScan(args.target, $);
              lines.push("STATIC ANALYSIS:");
              lines.push(semgrepResult);
            } catch {
              lines.push("STATIC ANALYSIS: semgrep not available, skipping.");
            }
          }
          if (m === "full" || m === "deps") {
          
            lines.push("\nDEPENDENCY SCANNING:");
            if (projectTypes.includes("node")) {
              const npmResult = await runNpmAudit(args.target, $);
              lines.push(`npm: ${npmResult}`);
            }
            if (projectTypes.includes("python")) {
              const pipResult = await runPipAudit(args.target, $);
              lines.push(`pip: ${pipResult}`);
            }
            if (!projectTypes.length) {
              lines.push("No recognized project type for dependency scanning.");
            }
          }
        
          if (m === "full") {
            lines.push("\nSECRET SCANNING:");
            const secretResult = await scanForSecrets(args.target);
            lines.push(secretResult);
          }
        
          lines.push("\nFormat: [Severity] File:Line | Description | Fix suggestion");
          lines.push("Run with mode:quick for faster scan, mode:deps for dependencies only.");
          return lines.join("\n");
        },
      }),
      hexz_design: tool({
        description:
          "Generate design scaffold following open-design craft rules. Optionally apply a design system, template, or project DESIGN.md. Default craft rules: typography, color, anti-ai-slop.",
        args: {
          brief: tool.schema.string(),
          surface: tool.schema.string().optional(),
          design_system: tool.schema.string().optional(),
          template: tool.schema.string().optional(),
          craft_sections: tool.schema.string().optional(),
          save: tool.schema.string().optional(),
        },
        async execute(args, ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const sections = (args.craft_sections ?? CRAFT_DEFAULT_SECTIONS.join(","))
            .split(",").map(s => s.trim()).filter(Boolean);
          const lines: string[] = [];
          lines.push(`[HEXZ Design] v${VERSION}`);
          lines.push(`Brief: ${args.brief}`);
          lines.push(`Surface: ${args.surface ?? "web"}`);
          lines.push("");
          const craftParts: string[] = [];
          for (const section of sections) {
            const content = readCraftSection(DESIGN_DIR, section);
            if (content) craftParts.push(`## ${section}\n${content}`);
          }
          if (craftParts.length > 0) {
            lines.push("══ Craft Rules ══");
            for (const part of craftParts) lines.push(part);
            lines.push("");
          }
          if (args.design_system) {
            const ds = readDesignSystemDESIGN(DESIGN_DIR, args.design_system);
            if (ds) {
              lines.push(`══ Design System: ${args.design_system} ══`);
              lines.push(ds);
              lines.push("");
            } else {
              lines.push(`[Design system '${args.design_system}' not found.]`);
              lines.push("");
            }
          }
          if (args.template) {
            const tpl = readOpenDesignTemplate(DESIGN_DIR, args.template);
            if (tpl) {
              lines.push(`══ Template: ${args.template} ══`);
              lines.push(tpl);
              lines.push("");
            } else {
              lines.push(`[Template '${args.template}' not found.]`);
              lines.push("");
            }
          }
          const userDesign = readUserDESIGNMD(ctx.directory);
          if (userDesign) {
            lines.push("══ Project DESIGN.md ══");
            lines.push(userDesign.slice(0, 2000));
            lines.push("");
          }
          lines.push("══ Generated Scaffold ══");
          const scaffoldBody = `<header>
  <div class="container">
    <nav>
      <span class="badge">HEXZ</span>
      <h1>${args.brief}</h1>
    </nav>
  </div>
</header>
<main>
  <section class="hero">
    <div class="container">
      <h1>${args.brief}</h1>
      <p>Your project description goes here. Replace this with your actual content.</p>
      <button class="btn">Get Started</button>
    </div>
  </section>
  <section>
    <div class="container">
      <h2>Features</h2>
      <div class="grid">
        <div class="card"><h3>Feature</h3><p>Replace with real content</p></div>
        <div class="card"><h3>Feature</h3><p>Replace with real content</p></div>
        <div class="card"><h3>Feature</h3><p>Replace with real content</p></div>
      </div>
    </div>
  </section>
</main>`;
          const html = generateDesignScaffoldHTML(scaffoldBody);
          if (args.save) {
            const outPath = join(ctx.directory, args.save);
            writeFile(outPath, html);
            lines.push(`\nSaved to ${args.save}`);
          } else {
            lines.push(html);
          }
          return lines.join("\n");
        },
      }),
      hexz_image: tool({
        description:
          "Analyze images: screenshots, error messages, diagrams, mockups. Uses OCR to extract text from images. Describe what you see and execute (replicate UI, fix errors, code from diagrams).",
        args: {
          image_path: tool.schema.string(),
          intent: tool.schema.string().optional(),
        },
        async execute(args: any, _ctx: any) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          if (!isSafeInput(args.image_path)) return "Invalid image path.";
          const imagePath = args.image_path.startsWith("/") ? args.image_path : join(projectDir, args.image_path);
          if (!fileExistsSync(imagePath)) return `[HEXZ Image] File not found: ${imagePath}`;
          const intent = args.intent ?? "auto";
          try {
            const mod = await import("tesseract.js");
            const result = await (mod as any).recognize(imagePath, "eng");
            const text = result.data.text.trim();
            let response = `[HEXZ Image] ${args.image_path}\nIntent: ${intent}\n`;
            if (text) {
              response += `\nExtracted text (${text.split("\n").length} lines):\n${text.slice(0, 2000)}`;
            } else {
              response += "\nNo text detected in image.";
            }
            response += `\n\nConfidence: ${Math.round(result.data.confidence)}%`;
            return response;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "unknown error";
            return `[HEXZ Image] OCR failed: ${msg}. You can still manually describe what you see.`;
          }
        },
      }),
      hexz_webss: tool({
        description:
          "Capture website screenshots via Puppeteer. Use for visual debugging, design reference, or archiving. Requires capture-website + Puppeteer installed.",
        args: {
          url: tool.schema.string(),
          output: tool.schema.string().optional(),
          width: tool.schema.number().optional(),
          height: tool.schema.number().optional(),
          fullPage: tool.schema.boolean().optional(),
          type: tool.schema.string().optional(),
          quality: tool.schema.number().optional(),
          emulateDevice: tool.schema.string().optional(),
          css: tool.schema.string().optional(),
          inputType: tool.schema.string().optional(),
        },
        async execute(args: any, _ctx: any) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          try {
            const mod = await import("capture-website");
            const cw = (mod as any).default || mod;
            const opts: Record<string, unknown> = {};
            if (args.width) opts["width"] = args.width;
            if (args.height) opts["height"] = args.height;
            if (args.fullPage) opts["fullPage"] = true;
            if (args.type) opts["type"] = args.type;
            if (args.quality) opts["quality"] = args.quality;
            if (args.emulateDevice) opts["emulateDevice"] = args.emulateDevice;
            if (args.css) opts["css"] = args.css;
            if (args.inputType) opts["inputType"] = args.inputType;
            if (args.output) {
              const outPath = join(projectDir, args.output);
              await cw.file(args.url, outPath, opts);
              return `[HEXZ WebSS] Screenshot saved to ${args.output}`;
            }
            const b64: string = await cw.base64(args.url, opts);
            return `[HEXZ WebSS] Screenshot captured (base64, ${Math.floor(b64.length / 1024)} KB). Pass output=path to save to file.`;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "unknown error";
            return `[HEXZ WebSS] Failed: ${msg}. Ensure capture-website and Puppeteer are installed (npm install capture-website puppeteer).`;
          }
        },
      }),
      hexz_mcp: tool({
        description:
          "MCP (Model Context Protocol) server management. Connect to external MCP servers for DB, filesystem, and API access.",
        args: {
          action: tool.schema.string(),
          server: tool.schema.string().optional(),
          tool_name: tool.schema.string().optional(),
          args_json: tool.schema.string().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const a = args.action;
          if (a === "connect") {
            if (!args.server) return "Usage: hexz_mcp action=connect server=<url>";
            const existing = mcpConnections.find(c => c.url === args.server);
            if (existing) return `[HEXZ MCP] Already connected to ${args.server}`;
            mcpConnections.push({ url: args.server, client: null });
            return `[HEXZ MCP] Connecting to ${args.server}... use hexz_mcp action=list to verify.`;
          }
          if (a === "disconnect") {
            if (!args.server) return "Usage: hexz_mcp action=disconnect server=<url>";
            const idx = mcpConnections.findIndex(c => c.url === args.server);
            if (idx === -1) return `[HEXZ MCP] Not connected to ${args.server}`;
            mcpConnections.splice(idx, 1);
            return `[HEXZ MCP] Disconnected from ${args.server}`;
          }
          if (a === "list") {
            if (mcpConnections.length === 0) return "[HEXZ MCP] No active connections. Use hexz_mcp action=connect server=<url>";
            return `[HEXZ MCP] Connected servers:\n${mcpConnections.map(c => `  - ${c.url}`).join("\n")}`;
          }
          return "Usage: hexz_mcp action=(connect|disconnect|list) [server=<url>] [tool_name=<name>] [args_json=<json>]";
        },
      }),
      hexz_memory: tool({
        description:
          "Persistent agent memory. Read, write, or clear stored data across sessions. Keys: project context, user preferences, session summaries.",
        args: {
          action: tool.schema.string(),
          key: tool.schema.string().optional(),
          value: tool.schema.string().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const a = args.action;
          if (a === "get") {
            if (!args.key) return "Usage: hexz_memory action=get key=<name>";
            const val = getMemory(args.key);
            return val !== null ? `[HEXZ Memory] ${args.key} = ${val}` : `[HEXZ Memory] Key '${args.key}' not found.`;
          }
          if (a === "set") {
            if (!args.key || args.value === undefined) return "Usage: hexz_memory action=set key=<name> value=<text>";
            setMemory(args.key, args.value);
            return `[HEXZ Memory] Set ${args.key} = ${args.value.slice(0, 100)}${args.value.length > 100 ? "..." : ""}`;
          }
          if (a === "list") {
            const keys = ["active", "total_searches", "sessions", "project_context", "last_error", "last_session_summary"];
            const entries: string[] = [];
            for (const k of keys) {
              const v = getMemory(k);
              if (v !== null) entries.push(`  ${k}: ${v.slice(0, 80)}`);
            }
            return entries.length ? `[HEXZ Memory] Stored keys:\n${entries.join("\n")}` : "[HEXZ Memory] No stored data.";
          }
          if (a === "clear") {
            for (const k of ["project_context", "last_error", "last_session_summary"]) setMemory(k, "");
            return "[HEXZ Memory] Cleared session keys.";
          }
          return "Usage: hexz_memory action=(get|set|list|clear) [key=<name>] [value=<text>]";
        },
      }),
      hexz_pr: tool({
        description:
          "Git PR workflow. Create pull requests with AI descriptions, review diffs, manage branches.",
        args: {
          action: tool.schema.string(),
          title: tool.schema.string().optional(),
          base: tool.schema.string().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const a = args.action;
          if (a === "status") {
            try {
              const branch = (await $`git branch --show-current`.text()).trim();
              const status = (await $`git status --short`.text()).trim();
              const ahead = (await $`git log --oneline @{u}.. 2>/dev/null || true`.text()).trim();
              return `[HEXZ PR] Branch: ${branch}\n${status || "Clean working tree"}\n${ahead ? `Ahead by:\n${ahead}` : "Up to date with remote"}`;
            } catch {
              return "[HEXZ PR] Not a git repository or git not available.";
            }
          }
          if (a === "diff") {
            try {
              const diff = (await $`git diff HEAD --stat`.text()).trim();
              const staged = (await $`git diff --cached --stat`.text()).trim();
              return `[HEXZ PR] Changes:\n${diff || "(unstaged)"}\n${staged ? `\nStaged:\n${staged}` : ""}`;
            } catch {
              return "[HEXZ PR] Not a git repository.";
            }
          }
          if (a === "create") {
            try {
              const branch = (await $`git branch --show-current`.text()).trim();
              const base = args.base ?? "main";
              const title = args.title ?? `Update ${branch}`;
              const body = `Automated PR from HEXZ v${VERSION}\n\nBranch: ${branch}\nBase: ${base}`;
              await $`git push -u origin ${branch}`;
              const prUrl = (await $`gh pr create --base ${base} --title ${title} --body ${body}`.text()).trim();
              return `[HEXZ PR] Created: ${prUrl}`;
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "unknown error";
              return `[HEXZ PR] Failed: ${msg}. Ensure gh CLI is installed and authenticated.`;
            }
          }
          return "Usage: hexz_pr action=(status|diff|create) [title=<text>] [base=<branch>]";
        },
      }),
      hexz_mkp: tool({
        description:
          "Install plugins & skills. Commands: 'list', 'remove:name', 'owner/repo', 'npm-pkg', 'skill:owner/repo', 'skill:name --content \"...\"'",
        args: { target: tool.schema.string() },
        async execute(args, ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const t = args.target.trim();
          if (!t)
            return "Usage: mkp <target>. Examples: mkp list, mkp owner/repo, mkp skill:my-skill";
          const safeDir = ctx.directory.replace(/[^a-zA-Z0-9._/ -]/g, "");
          const pluginsDir = `${safeDir}/.opencode/plugins`;
          const commandsDir = `${safeDir}/.opencode/commands`;
        
          if (t === "list") {
            return listInstalled(pluginsDir, commandsDir);
          }
        
          if (t.startsWith("remove:")) {
            return removeItem(t.slice(7).trim(), pluginsDir, commandsDir);
          }
        
          if (t.startsWith("skill:")) {
            return installSkill(t.slice(6).trim(), commandsDir);
          }
        
          return installPlugin(t, pluginsDir, safeDir);
        },
      }),
      hexz_status: tool({
        description: "Show HEXZ status: active/inactive, uptime, search count.",
        args: {},
        async execute() {
          const up = Math.floor((Date.now() - state.startTime) / 1000);
          return `HEXZ: ${state.active ? "ON" : "OFF"} | v${VERSION} | ${Math.floor(up / 60)}m${up % 60}s | ${state.searches} searches | cache: ${searchCache.size} entries`;
        },
      }),
      hexz_sim: tool({
        description: "Simulation sandbox for destructive actions. Creates a sim at .sims/simscode-<name>/ with a diff of proposed changes. Call BEFORE Write/Edit/Bash-rm/mv/cp.",
        args: {
          name: tool.schema.string(),
          plan: tool.schema.string(),
          files: tool.schema.string().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const simName = args.name.replace(/[^a-zA-Z0-9._-]/g, "");
          if (!simName) return "Invalid simulation name.";
          const simDir = join(projectDir, SIMS_DIR, `simscode-${simName}`);
          try { mkdirSync(simDir, { recursive: true }); } catch { return `Failed to create ${simDir}`; }
          const ts = new Date().toISOString();
          const simContent = [
            `# Simulation: ${simName}`,
            `Created: ${ts}`,
            "",
            "## Plan",
            args.plan,
            "",
            "## Files Affected",
            args.files ?? "(not specified)",
            "",
            "## Status: PENDING REVIEW",
            "Review the plan and files above. Check for:",
            "- Edge cases and error states",
            "- Breaking changes to other files",
            "- Missing imports or dependencies",
            "- Type mismatches",
            "- Security implications",
            "",
            "## Result",
            "- [ ] Simulation reviewed",
            "- [ ] Edge cases handled",
            "- [ ] No breaking changes",
            "- [ ] Ready to execute",
          ].join("\n");
          writeFile(join(simDir, "simulation.md"), simContent);
          return `[HEXZ Sim] Created simulation at .sims/simscode-${simName}/\nPlan: ${args.plan}\nReview the sim before executing. When ready, the destructive action will be allowed.`;
        },
      }),
      hexz_codebase: tool({
        description: "Scan the project and generate/update codebase.md. Shows every source file, its imports, exports, and connections.",
        args: {},
        async execute() {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const content = scanCodebase(projectDir);
          const dest = join(projectDir, "codebase.md");
          writeFile(dest, content);
          return `[HEXZ Codebase] Generated codebase.md (${content.split("\n").length} lines). Read it to understand file connections before making changes.`;
        },
      }),
      hexz_cyber: tool({
        description: "Cybersecurity skills & framework mappings. 769+ skills across 15 core domains + 754 specialized skills from mukul. MITRE ATT&CK, NIST CSF, OWASP mappings. Call for any security-related task.",
        args: {
          domain: tool.schema.string().optional(),
          query: tool.schema.string().optional(),
          framework: tool.schema.string().optional(),
          list: tool.schema.boolean().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          if (args.list) {
            const skills = listCyberSkills(CYBER_DIR);
            return `[HEXZ Cyber] Available skills (${skills.length} total):\n${skills.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nFrameworks: mitre, nist, owasp`;
          }
          const lines: string[] = ["[HEXZ Cyber]"];
          if (args.framework) {
            return readCyberFrameworkMapping(CYBER_DIR, args.framework);
          }
          if (args.domain) {
            const domainArg: string = args.domain;
            const q = domainArg.toLowerCase().replace(/[^a-z0-9]/g, "-");
            const match = CYBER_DOMAINS.find(d => d.id.includes(q) || d.label.toLowerCase().includes(domainArg.toLowerCase()) || d.keywords.some(k => k.includes(q)));
            if (match) {
              lines.push(`Domain: ${match.label}`);
              lines.push(`Keywords: ${match.keywords.join(", ")}`);
              const skillContent = readCyberSkill(CYBER_DIR, match.dir);
              lines.push(`\n══ Skill Content ══\n${skillContent.slice(0, 3000)}`);
              return lines.join("\n");
            }
            const mukulContent = readCyberSkill(CYBER_DIR, q);
            if (mukulContent && !mukulContent.startsWith("No skill file")) {
              lines.push(`Skill: ${args.domain}`);
              lines.push(`\n══ Skill Content ══\n${mukulContent.slice(0, 3000)}`);
              return lines.join("\n");
            }
            lines.push(`Domain '${args.domain}' not found. Available domains from Masriyan:`);
            for (const d of CYBER_DOMAINS) lines.push(`  ${d.id} — ${d.label}`);
            lines.push("\nUse list=true to see all 769+ skills.");
            lines.push("Frameworks: mitre, nist, owasp");
            return lines.join("\n");
          }
          if (args.query) {
            const q = args.query.toLowerCase();
            lines.push(`Searching cybersecurity for: ${args.query}`);
            const matched = CYBER_DOMAINS.filter(d => d.label.toLowerCase().includes(q) || d.keywords.some(k => k.includes(q)));
            if (matched.length) {
              for (const m of matched) lines.push(`  ${m.id} — ${m.label}`);
            }
            const skills = listCyberSkills(CYBER_DIR);
            const skillMatches = skills.filter(s => s.toLowerCase().includes(q));
            if (skillMatches.length) {
              lines.push(`\nSkill matches (${skillMatches.length}):`);
              for (const s of skillMatches.slice(0, 20)) lines.push(`  - ${s}`);
              if (skillMatches.length > 20) lines.push(`  ... and ${skillMatches.length - 20} more`);
            }
            if (!matched.length && !skillMatches.length) {
              lines.push("No matches found.");
            }
            lines.push("\nUse domain=<name> to view a skill. Frameworks: mitre, nist, owasp");
            return lines.join("\n");
          }
          lines.push("Use domain=, query=, framework=, or list=true");
          lines.push("\nMasriyan domains (15):");
          for (const d of CYBER_DOMAINS) lines.push(`  ${d.id} — ${d.label}`);
          const totalSkills = listCyberSkills(CYBER_DIR).length;
          lines.push(`\nTotal skills available: ${totalSkills}`);
          lines.push("\nFrameworks: mitre, nist, owasp");
          return lines.join("\n");
        },
      }),
    },
  };
};
export default HexzPlugin;
export const server = HexzPlugin;
export const plugin = HexzPlugin;
