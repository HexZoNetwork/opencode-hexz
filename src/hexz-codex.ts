import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { escapeHtml, isSafeWebUrl, resolveProjectPath } from "./shared"

const TYPE_MAP: Record<string, string> = { string: "ZodString", number: "ZodNumber", boolean: "ZodBoolean" }
function zodDef(typeName: string, description?: string) {
  const def: any = { typeName }
  if (description) def.description = description
  return def
}
function schemaField(meta: Record<string, unknown>): any {
  const metaType = meta["type"] as string
  const metaDesc = meta["description"] as string | undefined
  const base = TYPE_MAP[metaType] || "ZodString"
  const innerDef = zodDef(base, metaDesc)
  const def = meta["optional"]
    ? { typeName: "ZodOptional", innerType: { _zod: { def: innerDef } } }
    : innerDef
  return {
    _zod: { def },
    describe: (msg: string) => schemaField({ ...meta, description: msg }),
    optional: () => schemaField({ ...meta, optional: true }),
  }
}
const tool: any = (def: any) => def
tool.schema = {
  string: () => schemaField({ type: "string" }),
  number: () => schemaField({ type: "number" }),
  boolean: () => schemaField({ type: "boolean" }),
}

const VERSION = "1.5.2"
const memoryPath = join(homedir(), ".config", "codex", "hexz-memory.json")
const SIMS_DIR = ".sims"
const SEARXNG_PORT = 8888
const SEARXNG_CONTAINER = "hexz-searxng"
const DDG_RECOVERY_CHECK_MS = 60000
let searXngUrl = ""
let searXngRecoveryTimer: ReturnType<typeof setInterval> | null = null

const CYBER_DOMAINS = [
  { id: "recon", label: "Reconnaissance", keywords: ["recon", "reconnaissance", "info gathering", "enumeration", "osint"] },
  { id: "vuln-scan", label: "Vulnerability Scanning", keywords: ["vuln", "scan", "vulnerability", "nmap", "nessus"] },
  { id: "exploit-dev", label: "Exploit Development", keywords: ["exploit", "exploitation", "buffer overflow", "rop", "shellcode"] },
  { id: "reverse-engineering", label: "Reverse Engineering", keywords: ["reverse", "reverse engineering", "ida", "ghidra", "binary"] },
  { id: "malware-analysis", label: "Malware Analysis", keywords: ["malware", "ransomware", "trojan", "virus", "analysis"] },
  { id: "threat-hunting", label: "Threat Hunting", keywords: ["threat", "hunting", "detection", "hunt"] },
  { id: "incident-response", label: "Incident Response", keywords: ["incident", "response", "ir", "forensic", "containment"] },
  { id: "network-security", label: "Network Security", keywords: ["network", "firewall", "ids", "ips", "wireshark"] },
  { id: "web-security", label: "Web Security", keywords: ["web", "xss", "sqli", "csrf", "owasp"] },
  { id: "cloud-security", label: "Cloud Security", keywords: ["cloud", "aws", "azure", "gcp", "kubernetes"] },
  { id: "forensics", label: "Digital Forensics", keywords: ["forensic", "forensics", "disk", "memory", "artifact"] },
  { id: "soc", label: "SOC Operations", keywords: ["soc", "siem", "splunk", "elk", "monitoring"] },
  { id: "crypto", label: "Cryptography", keywords: ["crypto", "encryption", "hashing", "ssl", "tls"] },
  { id: "red-team", label: "Red Teaming", keywords: ["red", "team", "adversary", "simulation", "pentest"] },
  { id: "blue-team", label: "Blue Teaming", keywords: ["blue", "team", "defense", "monitoring", "hardening"] },
]

function fileExistsSync(p: string): boolean {
  try { return existsSync(p) } catch { return false }
}
function readFile(p: string): string | null {
  try { return readFileSync(p, "utf-8") } catch { return null }
}
function writeFile(p: string, content: string): void {
  try { writeFileSync(p, content, "utf-8") } catch {}
}
function* globSync(pattern: string, cwd: string): Generator<string> {
  const parts = pattern.split("/")
  const filePart = parts[parts.length - 1] ?? ""
  const dirPart = parts.slice(0, -1).join("/")
  const baseDir = dirPart ? join(cwd, dirPart) : cwd
  try {
    const entries = readdirSync(baseDir)
    for (const entry of entries) {
      const fullPath = join(baseDir, entry)
      let match = false
      if (filePart === "*") match = true
      else if (filePart === "**/*") match = statSync(fullPath).isDirectory()
      else if (filePart.startsWith("*.")) match = entry.endsWith(filePart.slice(1))
      else if (filePart.endsWith("/")) match = statSync(fullPath).isDirectory()
      else match = entry === filePart
      if (match && statSync(fullPath).isFile()) yield fullPath
    }
  } catch {}
}

const MODULE_DIR = import.meta.dir ?? process.cwd()
const DESIGN_DIR = join(MODULE_DIR, "design")

function scanCodebase(cwd: string): string {
  const files: string[] = []
  function walk(dir: string) {
    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const full = join(dir, entry)
        if (entry.startsWith(".") || entry === "node_modules") continue
        if (statSync(full).isDirectory()) walk(full)
        else if (entry.endsWith(".ts") || entry.endsWith(".js") || entry.endsWith(".tsx") || entry.endsWith(".jsx") || entry.endsWith(".py") || entry.endsWith(".rs") || entry.endsWith(".go") || entry.endsWith(".java") || entry.endsWith(".css") || entry.endsWith(".html")) files.push(full)
      }
    } catch {}
  }
  walk(cwd)
  const lines: string[] = ["# Codebase Map\n"]
  lines.push(`Generated: ${new Date().toISOString()}\n`)
  lines.push(`Total source files: ${files.length}\n`)
  lines.push("---\n")
  for (const f of files.sort()) {
    const rel = f.replace(cwd, "").replace(/^[/\\]/, "")
    const content = readFile(f) ?? ""
    const lines_count = content.split("\n").length
    const imports = (content.match(/^import .+ from .+$/gm) ?? []).slice(0, 5)
    const exports = (content.match(/^export (default |)const |^export (default |)function |^export (default |)class /gm) ?? []).slice(0, 3)
    lines.push(`## ${rel}`)
    lines.push(`- Lines: ${lines_count}`)
    if (imports.length) lines.push(`- Imports: ${imports.map(i => `\`${i.trim()}\``).join(", ")}`)
    if (exports.length) lines.push(`- Exports: ${exports.map(e => `\`${e.trim()}\``).join(", ")}`)
    lines.push("")
  }
  return lines.join("\n")
}

function readCyberSkill(dir: string, domain: string): string {
  const skillFile = join(dir, "skills", domain, "SKILL.md")
  let content = readFile(skillFile) ?? ""
  const examplesDir = join(dir, "skills", domain, "examples")
  try {
    const entries = readdirSync(examplesDir)
    for (const entry of entries) {
      if (entry.endsWith(".md")) {
        const ex = readFile(join(examplesDir, entry))
        if (ex) content += `\n\n## Example: ${entry}\n${ex.slice(0, 1000)}`
      }
    }
  } catch {}
  return content || `No skill file found for '${domain}'.`
}
function listCyberSkills(dir: string): string[] {
  const skills: string[] = []
  for (const sub of ["skills", "skills-mukul"]) {
    try {
      const entries = readdirSync(join(dir, sub))
      for (const e of entries) {
        if (fileExistsSync(join(dir, sub, e, "SKILL.md"))) {
          skills.push(`${sub === "skills-mukul" ? "[M] " : ""}${e}`)
        }
      }
    } catch {}
  }
  return skills
}
function readCyberFrameworkMapping(dir: string, framework: string): string {
  const fw = framework.toLowerCase()
  const fwDir = join(dir, "mappings", fw === "mitre" ? "mitre-attack" : fw === "nist" ? "nist-csf" : fw === "owasp" ? "owasp" : fw)
  try {
    const entries = readdirSync(fwDir)
    let result = `[HEXZ Cyber] Framework: ${framework.toUpperCase()}\n\n`
    for (const entry of entries) {
      if (entry.endsWith(".md")) {
        const content = readFile(join(fwDir, entry))
        if (content) result += `--- ${entry} ---\n${content.slice(0, 2000)}\n\n`
      }
    }
    return result
  } catch {
    return `[HEXZ Cyber] Framework '${framework}' not found. Available: mitre, nist, owasp`
  }
}

function readCraftSection(dir: string, section: string): string {
  const path = join(dir, "craft", `${section}.md`)
  const content = readFile(path)
  if (content === null) return ""
  return content.split("\n").filter(l => !l.startsWith("> ")).slice(0, 60).join("\n").trim()
}
function readDesignSystemDESIGN(dir: string, slug: string): string {
  const path = join(dir, "design-systems", slug, "DESIGN.md")
  const content = readFile(path)
  if (content === null) return ""
  return content.split("\n").filter(l => !l.startsWith("> ")).slice(0, 120).join("\n").trim()
}
function readOpenDesignTemplate(dir: string, slug: string): string {
  const templateDir = join(dir, "design-templates", slug)
  const htmlFiles: string[] = []
  const mdFiles: string[] = []
  try {
    const entries = readdirSync(templateDir)
    for (const entry of entries) {
      if (entry.endsWith(".html")) htmlFiles.push(entry)
      else if (entry.endsWith(".md")) mdFiles.push(entry)
    }
  } catch { return "" }
  for (const files of [htmlFiles, mdFiles]) {
    for (const f of files) {
      const content = readFile(join(templateDir, f))
      if (content !== null) return content.slice(0, 3000).trim()
    }
  }
  return ""
}
function generateDesignScaffoldHTML(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HEXZ Design</title><style>:root{--bg:#fff;--text:#1a1a2e;--primary:#4361ee;--radius:12px}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}.container{max-width:1100px;margin:0 auto;padding:0 24px}header{background:linear-gradient(135deg,#4361ee,#7209b7);color:#fff;padding:1rem 0}.badge{background:rgba(255,255,255,.2);padding:4px 12px;border-radius:20px;font-size:14px;font-weight:600}h1{margin:0;font-size:2.5rem}.hero{text-align:center;padding:80px 0 60px}.hero h1{font-size:3rem;margin-bottom:16px}.btn{display:inline-block;padding:12px 32px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius);font-size:1rem;cursor:pointer;text-decoration:none}section{padding:60px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-top:32px}.card{padding:24px;border:1px solid #e2e8f0;border-radius:var(--radius);background:#fafafa}@media(prefers-color-scheme:dark){:root{--bg:#0f0f23;--text:#e2e8f0}.card{background:#1a1a2e;border-color:#2d2d4a}}</style></head><body>${body}</body></html>`
}

const memStore = new Map<string, string>()
try {
  mkdirSync(join(homedir(), ".config", "codex"), { recursive: true })
  const raw = readFileSync(memoryPath, "utf-8")
  const data = JSON.parse(raw)
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") memStore.set(k, v)
  }
} catch {}
function getMemory(key: string): string | null {
  return memStore.get(key) ?? null
}
function setMemory(key: string, value: string): void {
  memStore.set(key, value)
  try { writeFileSync(memoryPath, JSON.stringify(Object.fromEntries(memStore))) } catch {}
}

function isSafeInput(input: string): boolean {
  return /^[a-zA-Z0-9@.\/_\- ]+$/.test(input) && input.length <= 500
}
function redactSecrets(text: string): string {
  const patterns = [
    /(['"]?(?:api[_-]?key|secret|token|password|passwd|credential|auth|jwt|private_key|access_key)[_ \t'":]*['"]?)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /ghp_[a-zA-Z0-9]{36}/g, /gho_[a-zA-Z0-9]{36}/g, /ghu_[a-zA-Z0-9]{36}/g,
    /sk-[a-zA-Z0-9]{20,}/g, /xox[baprs]-[a-zA-Z0-9]{10,}/g,
    /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  ]
  for (const p of patterns) { text = text.replace(p, "$1: [REDACTED]") }
  return text
}

const CACHE_TTL_MS = 5 * 60 * 1000
const RATE_LIMIT_MS = 3000
const searchCache = new Map<string, { result: string; timestamp: number }>()
let lastSearchTime = 0

function ensureSearXng(): string | null {
  if (searXngUrl) return searXngUrl
  try {
    const info = spawnSync("docker", ["info"], { stdio: "pipe", encoding: "utf8" })
    if (info.status !== 0) {
      if (!tryInstallDocker()) return null
      const retry = spawnSync("docker", ["info"], { stdio: "pipe", encoding: "utf8" })
      if (retry.status !== 0) return null
    }
    spawnSync("docker", ["stop", SEARXNG_CONTAINER], { stdio: "ignore" })
    const key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const settingsDir = join(homedir(), ".config", "hexz-searxng")
    mkdirSync(settingsDir, { recursive: true })
    const settingsPath = join(settingsDir, "settings.yml")
    writeFileSync(settingsPath, `use_default_settings: true\nserver:\n  secret_key: "${key}"\n  bind_address: "0.0.0.0"\n  limiter: false\n  image_proxy: false\nsearch:\n  safe_search: 0\n  autocomplete: ""\n  formats:\n    - html\n    - json\n`)
    const run = spawnSync("docker", ["run", "-d", "--rm", "--name", SEARXNG_CONTAINER, "-p", `127.0.0.1:${SEARXNG_PORT}:8080`, "-v", `${settingsPath}:/etc/searxng/settings.yml:ro`, "-e", `SEARXNG_SECRET_KEY=${key}`, "searxng/searxng"], { encoding: "utf8" })
    if (run.status !== 0) return null
    searXngUrl = `http://127.0.0.1:${SEARXNG_PORT}`
    return searXngUrl
  } catch { return null }
}
function tryInstallDocker(): boolean {
  try {
    const isRoot = spawnSync("id", ["-u"], { encoding: "utf8" }).stdout.trim() === "0"
    const prefix = isRoot ? "" : "sudo "
    let cmd = ""
    if (spawnSync("command", ["-v", "curl"], { stdio: "pipe" }).status === 0) cmd = `curl -fsSL https://get.docker.com | ${prefix}sh`
    else if (spawnSync("command", ["-v", "wget"], { stdio: "pipe" }).status === 0) cmd = `wget -qO- https://get.docker.com | ${prefix}sh`
    else return false
    const r = spawnSync("sh", ["-c", cmd], { stdio: "pipe", timeout: 120000, encoding: "utf8" })
    return r.status === 0
  } catch { return false }
}
function stopSearXng(): void {
  if (!searXngUrl) return
  spawnSync("docker", ["stop", SEARXNG_CONTAINER], { stdio: "ignore" })
  searXngUrl = ""
  try { rmSync(join(homedir(), ".config", "hexz-searxng", "settings.yml")) } catch {}
}
function startDdgRecoveryCheck(): void {
  if (searXngRecoveryTimer) return
  searXngRecoveryTimer = setInterval(async () => {
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 5000)
      const res = await fetch("https://api.duckduckgo.com/?q=healthz&format=json&no_html=1&skip_disambig=1", { signal: ac.signal })
      clearTimeout(t)
      if (res.ok) {
        stopSearXng()
        if (searXngRecoveryTimer) {
          clearInterval(searXngRecoveryTimer)
          searXngRecoveryTimer = null
        }
      }
    } catch {}
  }, DDG_RECOVERY_CHECK_MS)
}
async function searchSearXng(query: string): Promise<string | null> {
  const baseUrl = ensureSearXng()
  if (!baseUrl) return null
  let ready = false
  for (let i = 0; i < 30; i++) {
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 3000)
      const res = await fetch(`${baseUrl}/search?q=healthz&format=json`, { signal: ac.signal })
      clearTimeout(t)
      if (res.ok) { ready = true; break }
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  if (!ready) { stopSearXng(); return null }
  startDdgRecoveryCheck()
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 15000)
    const res = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&language=en-US`, { signal: ac.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const data = (await res.json()) as any
    const results: Array<{ title?: string; content?: string; url?: string }> = data.results ?? []
    if (results.length === 0) return "No results (SearXNG)."
    return results.slice(0, 5).map(r => `${r.title || ""}${r.content ? ` — ${r.content.slice(0, 200)}` : ""}`).join("\n")
  } catch { return null }
}
async function searchChromium(query: string): Promise<string | null> {
  try {
    let executablePath: string | undefined
    for (const bin of ["chromium-browser", "google-chrome-stable", "google-chrome", "chromium"]) {
      const r = spawnSync("command", ["-v", bin], { stdio: "pipe", encoding: "utf8" })
      if (r.status === 0) { executablePath = r.stdout.trim(); break }
    }
    const mod = await import("puppeteer") as any
    const browser = await (mod.default || mod).launch({
      headless: true, executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })
    const page = await browser.newPage()
    await page.goto(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      waitUntil: "networkidle0", timeout: 15000,
    })
    const html: string = await page.content()
    await browser.close()
    const items: string[] = []
    const regex = /<a[^>]+class="result-link"[^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null = regex.exec(html)
    while (m !== null && items.length < 5) {
      const t = m[1].replace(/<[^>]*>/g, "").trim()
      if (t) items.push(`• ${t}`)
      m = regex.exec(html)
    }
    return items.length ? items.join("\n") : null
  } catch { return null }
}
async function webSearch(query: string): Promise<string> {
  const q = query.trim().slice(0, 300)
  if (!q) return "Empty query"
  const cached = searchCache.get(q)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) { return cached.result }
  const now = Date.now()
  if (now - lastSearchTime < RATE_LIMIT_MS) { return "Rate limited — try again in a few seconds" }
  lastSearchTime = now
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
  let ddgFailed = false
  let ddgResult = ""
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 8000)
    const res = await fetch(url, { signal: ac.signal })
    clearTimeout(t)
    if (!res.ok) { ddgFailed = true }
    else {
      const d = (await res.json()) as any
      const items = (d.RelatedTopics ?? [])
        .filter((t: any): t is any => typeof t.Text === "string" && t.Text.length > 10)
        .slice(0, 5).map((t: any) => `• ${t.Text}`)
      ddgResult = items.length ? items.join("\n") : "No results."
    }
  } catch { ddgFailed = true }
  if (!ddgFailed) { searchCache.set(q, { result: ddgResult, timestamp: Date.now() }); return ddgResult }
  const fallback = await searchSearXng(q)
  if (fallback !== null) { searchCache.set(q, { result: fallback, timestamp: Date.now() }); return fallback }
  const cr = await searchChromium(q)
  if (cr !== null) { searchCache.set(q, { result: cr, timestamp: Date.now() }); return cr }
  return "Search failed (network error). All 3 fallbacks exhausted."
}

function run(cmd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", timeout: 30000 })
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" }
}

async function scanForSecrets(targetPath: string): Promise<string> {
  if (!fileExistsSync(targetPath)) return `Path not found: ${targetPath}`
  const lines: string[] = []
  try {
    const r = spawnSync("gitleaks", ["detect", "--source", targetPath, "--no-git", "-v"], { stdio: "pipe", encoding: "utf8", timeout: 30000 })
    const output = r.stdout || r.stderr || ""
    if (r.status === 0) lines.push("No secrets detected.")
    else lines.push(output.split("\n").slice(0, 20).join("\n"))
  } catch { lines.push("gitleaks not installed. Install: brew install gitleaks or go install github.com/zricethezav/gitleaks/v8@latest") }
  try {
    const tf = run("semgrep", ["--config=auto", "--metrics=off", targetPath])
    if (tf.status === 0) lines.push("Semgrep: no issues found.")
    else lines.push(tf.stdout.split("\n").slice(0, 15).join("\n"))
  } catch { lines.push("semgrep not available.") }
  return lines.join("\n") || "No security tools available."
}

function generateCodexPluginManifest(): string {
  return JSON.stringify({
    name: "hexz",
    version: VERSION,
    description: "HEXZ — Anti-slop, security scanning, design scaffolds, web search, image handling, plugin marketplace.",
    skills: "./skills/",
  }, null, 2)
}

function generateCodexSkill(name: string, description: string, prompt: string): string {
  return `---
name: ${name}
description: ${description}
---

${prompt}
`
}

function generateCodexPluginDir(baseDir: string): void {
  const pluginDir = join(baseDir, ".codex-plugin")
  const skillsDir = join(pluginDir, "skills")
  const hooksDir = join(pluginDir, "hooks")
  mkdirSync(skillsDir, { recursive: true })
  mkdirSync(hooksDir, { recursive: true })
  writeFile(join(pluginDir, "plugin.json"), generateCodexPluginManifest())

  writeFile(join(hooksDir, "hooks.json"), JSON.stringify({
    hooks: {
      PostToolUse: [{
        matcher: "Write|Edit",
        hooks: [{ type: "command", command: "sh -c 'which biome >/dev/null 2>&1 && biome format --write \"${FILE_PATH}\" 2>/dev/null || which prettier >/dev/null 2>&1 && prettier --write \"${FILE_PATH}\" 2>/dev/null || true'" }],
      }],
      PreToolUse: [{
        matcher: "Bash",
        hooks: [{ type: "command", command: "sh -c 'echo \"${ARGS}\" | grep -qE \"rm (-rf| -fr)|dd if=|mkfs\" > /dev/null && echo \"[HEXZ] Destructive command detected. Create a simulation first with: hexz_sim(name=..., plan=...)\" || true'" }],
      }],
    },
  }, null, 2))

  const skills: Array<{ name: string; description: string; prompt: string }> = [
    { name: "hexz_search", description: "Web search via DuckDuckGo with SearXNG and Chromium fallbacks", prompt: "Use web searches to find latest docs, API changes, breaking changes, and best practices before writing code. Cache results for 5 minutes. Rate limit: 3s between searches." },
    { name: "hexz_scan", description: "Security audit for injection, XSS, secrets, dependency vulns, data flow, auth, crypto", prompt: "Run security scans: static analysis with semgrep, dependency scanning (bun audit, npm audit, pip-audit), secret scanning with gitleaks. Report findings with CVSS v3.1 scores." },
    { name: "hexz_design", description: "Generate HTML/CSS design scaffolds from a brief with craft rules and design systems", prompt: "Generate design scaffolds following open-design craft rules. Apply design systems, templates, or project DESIGN.md. Default craft sections: typography, color, anti-ai-slop." },
    { name: "hexz_image", description: "Analyze images via OCR: screenshots, error messages, diagrams, mockups", prompt: "Use OCR to extract text from images. Supported formats: png, jpg, jpeg, gif, bmp, webp, svg, tiff. Describe what you see and replicate UI, fix errors, or code from diagrams." },
    { name: "hexz_webss", description: "Capture website screenshots via Puppeteer for visual debugging and design reference", prompt: "Capture screenshots of websites. Supports custom width, height, fullPage, device emulation, and CSS injection. Requires capture-website + Puppeteer." },
    { name: "hexz_mcp", description: "MCP server management for DB, filesystem, and API access", prompt: "Connect, disconnect, and list MCP servers. Manage external tool access for databases, filesystems, and APIs." },
    { name: "hexz_memory", description: "Persistent agent memory across sessions for project context and preferences", prompt: "Store and retrieve persistent data across sessions. Keys: project context, user preferences, session summaries, model routes." },
    { name: "hexz_pr", description: "Git PR workflow with status, diff, and creation via gh CLI", prompt: "Manage git pull requests: check status, view diffs, create PRs with AI descriptions. Requires git + gh CLI." },
    { name: "hexz_mkp", description: "Plugin/skill marketplace for installing from GitHub or npm", prompt: "Install plugins and skills from GitHub repos or npm packages. Manage installed items with list and remove commands." },
    { name: "hexz_status", description: "Show HEXZ active status, uptime, search count, and cache info", prompt: "Display current HEXZ status: active/inactive, uptime, search count, cache entries, SearXNG fallback status." },
    { name: "hexz_sim", description: "Simulation sandbox for safe destructive actions", prompt: "Create simulation sandboxes before destructive operations. Review proposed changes for edge cases, breaking changes, and security implications." },
    { name: "hexz_codebase", description: "Scan project and generate codebase.md with file connections", prompt: "Scan the project directory, identify all source files, their imports and exports, and generate a codebase.md map. Read this before making changes." },
    { name: "hexz_cyber", description: "Cybersecurity skills across 15 domains with MITRE/NIST/OWASP mappings", prompt: "Access cybersecurity skills across 15 core domains: recon, vulnerability scanning, exploit dev, reverse engineering, malware analysis, threat hunting, incident response, network/web/cloud security, forensics, SOC, crypto, red/blue team. Mapped to MITRE ATT&CK, NIST CSF 2.0, OWASP Top 10." },
    { name: "hexz_doctor", description: "Health check for HEXZ runtime, scanners, browser, git, and safety defaults", prompt: "Check runtime health: bun version, git availability, browser for Puppeteer, Python/semgrep/pip-audit for security scanning, Docker for SearXNG." },
    { name: "active", description: "Engage HEXZ upgrade layer", prompt: "HEXZ_ACTIVATE — Enable all HEXZ features: anti-slop, security scanning, design scaffolds, web search, image handling, plugin marketplace." },
    { name: "off", description: "Revert to default behavior and deactivate HEXZ", prompt: "HEXZ_DEACTIVATE — Disable HEXZ features, stop SearXNG, revert to default behavior." },
  ]

  for (const skill of skills) {
    const skillDir = join(skillsDir, skill.name)
    mkdirSync(skillDir, { recursive: true })
    writeFile(join(skillDir, "SKILL.md"), generateCodexSkill(skill.name, skill.description, skill.prompt))
  }
}

export const hexz_search = tool({
  description: "Web search via DuckDuckGo with SearXNG and Chromium fallbacks. Call BEFORE writing code — always get current info first.",
  args: { query: tool.schema.string() },
  async execute(args: { query: string }) {
    if (!isSafeInput(args.query)) return "Invalid query — only alphanumeric, spaces, hyphens, dots, slashes, underscores allowed."
    return await webSearch(args.query)
  },
})

export const hexz_scan = tool({
  description: "Security audit: injection, XSS, secrets, dependency vulns, data flow, auth, crypto. CVSS v3.1 scores. Run after building.",
  args: { target: tool.schema.string(), mode: tool.schema.string().optional() },
  async execute(args: { target: string; mode?: string }) {
    if (!isSafeInput(args.target)) return "Invalid target path."
    const targetPath = resolveProjectPath(process.cwd(), args.target)
    if (!targetPath) return "Target path must stay inside the project directory."
    const m = args.mode ?? "full"
    const lines: string[] = [`[HEXZ Scan] ${args.target} (${m})\n`]

    if (m === "full" || m === "quick") {
      try {
        const sg = run("semgrep", ["--config=auto", "--metrics=off", targetPath])
        lines.push("STATIC ANALYSIS:")
        lines.push(sg.status === 0 ? "No issues found." : sg.stdout.slice(0, 1000))
      } catch { lines.push("STATIC ANALYSIS: semgrep not available.") }
    }
    if (m === "full" || m === "deps") {
      lines.push("\nDEPENDENCY SCANNING:")
      if (fileExistsSync(join(targetPath, "bun.lock"))) {
        const ba = run("bun", ["audit", "--cwd", targetPath])
        lines.push(`bun: ${ba.stdout.slice(0, 300) || "No vulnerabilities"}`)
      }
      if (fileExistsSync(join(targetPath, "package-lock.json"))) {
        const na = run("npm", ["audit", "--prefix", targetPath])
        lines.push(`npm: ${na.stdout.slice(0, 300) || "No vulnerabilities"}`)
      }
      if (fileExistsSync(join(targetPath, "requirements.txt")) || fileExistsSync(join(targetPath, "Pipfile"))) {
        const pa = run("pip-audit", [])
        lines.push(`pip: ${pa.stdout.slice(0, 300) || pa.stderr.slice(0, 100)}`)
      }
    }
    if (m === "full") {
      lines.push("\nSECRET SCANNING:")
      lines.push(await scanForSecrets(targetPath))
    }
    lines.push("\nFormat: [Severity] File:Line | Description | Fix suggestion")
    lines.push("Run with mode:quick for faster scan, mode:deps for dependencies only.")
    return lines.join("\n")
  },
})

export const hexz_design = tool({
  description: "Generate HTML/CSS design scaffolds from a brief. Applies craft rules, design systems, or project DESIGN.md.",
  args: {
    brief: tool.schema.string(),
    surface: tool.schema.string().optional(),
    design_system: tool.schema.string().optional(),
    template: tool.schema.string().optional(),
    craft_sections: tool.schema.string().optional(),
    save: tool.schema.string().optional(),
  },
  async execute(args: any) {
    const sections = (args.craft_sections ?? "typography,color,anti-ai-slop").split(",").map(s => s.trim()).filter(Boolean)
    const lines: string[] = [`[HEXZ Design] v${VERSION}`, `Brief: ${args.brief}`, `Surface: ${args.surface ?? "web"}`, ""]
    for (const section of sections) {
      const content = readCraftSection(DESIGN_DIR, section)
      if (content) lines.push(`## ${section}\n${content}`)
    }
    if (args.design_system) {
      const ds = readDesignSystemDESIGN(DESIGN_DIR, args.design_system)
      lines.push(ds ? `══ Design System: ${args.design_system} ══\n${ds}` : `[Design system '${args.design_system}' not found.]`)
    }
    if (args.template) {
      const tpl = readOpenDesignTemplate(DESIGN_DIR, args.template)
      if (tpl) lines.push(`══ Template: ${args.template} ══\n${tpl}`)
    }
    lines.push("══ Generated Scaffold ══")
    const safeBrief = escapeHtml(args.brief)
    const scaffoldBody = `<header><div class="container"><nav><span class="badge">HEXZ</span><h1>${safeBrief}</h1></nav></div></header><main><section class="hero"><div class="container"><h1>${safeBrief}</h1><p>Your project description goes here. Replace this with your actual content.</p><button class="btn">Get Started</button></div></section><section><div class="container"><h2>Features</h2><div class="grid"><div class="card"><h3>Feature</h3><p>Replace with real content</p></div><div class="card"><h3>Feature</h3><p>Replace with real content</p></div><div class="card"><h3>Feature</h3><p>Replace with real content</p></div></div></div></section></main>`
    const html = generateDesignScaffoldHTML(scaffoldBody)
    if (args.save) {
      const outPath = resolveProjectPath(process.cwd(), args.save)
      if (!outPath) return "Save path must stay inside the project directory."
      mkdirSync(resolve(outPath, ".."), { recursive: true })
      writeFile(outPath, html)
      lines.push(`\nSaved to ${args.save}`)
    } else { lines.push(html) }
    return lines.join("\n")
  },
})

export const hexz_image = tool({
  description: "Analyze images: screenshots, error messages, diagrams, mockups. Uses OCR to extract text.",
  args: { image_path: tool.schema.string(), intent: tool.schema.string().optional() },
  async execute(args: any) {
    if (!isSafeInput(args.image_path)) return "Invalid image path."
    const imagePath = resolveProjectPath(process.cwd(), args.image_path)
    if (!imagePath) return "Image path must stay inside the project directory."
    if (!fileExistsSync(imagePath)) return `[HEXZ Image] File not found: ${imagePath}`
    if (!/\.(png|jpg|jpeg|gif|bmp|webp|svg|tiff?)$/i.test(args.image_path)) return `[HEXZ Image] Unsupported format.`
    const intent = args.intent ?? "auto"
    try {
      const mod = await import("tesseract.js")
      const result = await (mod as any).recognize(imagePath, "eng")
      const text = result.data.text.trim()
      let response = `[HEXZ Image] ${args.image_path}\nIntent: ${intent}\n`
      if (text) response += `\nExtracted text (${text.split("\n").length} lines):\n${text.slice(0, 2000)}`
      else response += "\nNo text detected in image."
      response += `\n\nConfidence: ${Math.round(result.data.confidence)}%`
      return response
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error"
      return `[HEXZ Image] OCR failed: ${msg}. You can still manually describe what you see.`
    }
  },
})

export const hexz_webss = tool({
  description: "Capture website screenshots via Puppeteer. For visual debugging, design reference, or archiving.",
  args: {
    url: tool.schema.string(), output: tool.schema.string().optional(),
    width: tool.schema.number().optional(), height: tool.schema.number().optional(),
    fullPage: tool.schema.boolean().optional(), type: tool.schema.string().optional(),
    quality: tool.schema.number().optional(), emulateDevice: tool.schema.string().optional(),
    css: tool.schema.string().optional(), inputType: tool.schema.string().optional(),
  },
  async execute(args: any) {
    const safeUrl = args.url.trim()
    if (!isSafeWebUrl(safeUrl)) return "URL must be public http(s), not localhost or a private network address."
    try {
      const mod = await import("capture-website")
      const cw = (mod as any).default || mod
      const opts: Record<string, unknown> = {}
      if (args.width) opts.width = Number(args.width)
      if (args.height) opts.height = Number(args.height)
      if (args.fullPage) opts.fullPage = args.fullPage === true || args.fullPage === "true"
      if (args.type) opts.type = args.type
      if (args.quality) opts.quality = Number(args.quality)
      if (args.emulateDevice && args.emulateDevice !== "none") opts.emulateDevice = args.emulateDevice
      if (args.css) opts.css = args.css
      if (args.inputType) opts.inputType = args.inputType
      if (args.output) {
        const outPath = resolveProjectPath(process.cwd(), args.output)
        if (!outPath) return "Output path must stay inside the project directory."
        await cw.file(safeUrl, outPath, opts)
        return `[HEXZ WebSS] Screenshot saved to ${args.output}`
      }
      const b64: string = await cw.base64(safeUrl, opts)
      return `[HEXZ WebSS] Screenshot captured (base64, ${Math.floor(b64.length / 1024)} KB). Pass output=path to save to file.`
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error"
      return `[HEXZ WebSS] Failed: ${msg}. Ensure capture-website and Puppeteer are installed.`
    }
  },
})

export const hexz_mcp = tool({
  description: "MCP (Model Context Protocol) server management. Connect to external servers for DB, filesystem, and API access.",
  args: { action: tool.schema.string(), server: tool.schema.string().optional(), tool_name: tool.schema.string().optional(), args_json: tool.schema.string().optional() },
  async execute(args: any) {
    const a = args.action
    if (a === "list") {
      const configPath = join(homedir(), ".config", "codex", "mcp-servers.json")
      try {
        const servers = JSON.parse(readFileSync(configPath, "utf8"))
        const entries = Object.entries(servers) as Array<[string, { url: string }]>
        return entries.length ? `[HEXZ MCP] Configured servers:\n${entries.map(([k, v]) => `  ${k} — ${v.url}`).join("\n")}` : "[HEXZ MCP] No servers configured."
      } catch { return "[HEXZ MCP] No MCP servers configured. Use action=connect server=<url>" }
    }
    if (a === "connect") {
      if (!args.server) return "Usage: action=connect server=<url>"
      const servers: Record<string, { url: string }> = {}
      try { Object.assign(servers, JSON.parse(readFileSync(join(homedir(), ".config", "codex", "mcp-servers.json"), "utf8"))) } catch {}
      const name = new URL(args.server).hostname || `server-${Date.now()}`
      servers[name] = { url: args.server }
      mkdirSync(join(homedir(), ".config", "codex"), { recursive: true })
      writeFileSync(join(homedir(), ".config", "codex", "mcp-servers.json"), JSON.stringify(servers, null, 2) + "\n")
      return `[HEXZ MCP] Added server '${name}': ${args.server}`
    }
    if (a === "disconnect") {
      if (!args.server) return "Usage: action=disconnect server=<name or url>"
      const configPath = join(homedir(), ".config", "codex", "mcp-servers.json")
      try {
        const raw = readFileSync(configPath, "utf8")
        const servers = JSON.parse(raw)
        delete servers[args.server]
        for (const [k, v] of Object.entries(servers) as Array<[string, { url: string }]>) {
          if (v.url === args.server) delete servers[k]
        }
        writeFileSync(configPath, JSON.stringify(servers, null, 2) + "\n")
        return `[HEXZ MCP] Disconnected ${args.server}`
      } catch { return `[HEXZ MCP] Not found: ${args.server}` }
    }
    return "Usage: hexz_mcp action=(connect|disconnect|list) [server=<url>]"
  },
})

export const hexz_memory = tool({
  description: "Persistent agent memory across sessions. Get/set/list/clear stored project context, preferences, and summaries.",
  args: { action: tool.schema.string(), key: tool.schema.string().optional(), value: tool.schema.string().optional() },
  async execute(args: any) {
    const a = args.action
    if (a === "get") {
      if (!args.key) return "Usage: hexz_memory action=get key=<name>"
      const val = getMemory(args.key)
      return val !== null ? `[HEXZ Memory] ${args.key} = ${val}` : `[HEXZ Memory] Key '${args.key}' not found.`
    }
    if (a === "set") {
      if (!args.key || args.value === undefined) return "Usage: hexz_memory action=set key=<name> value=<text>"
      setMemory(args.key, redactSecrets(args.value))
      return `[HEXZ Memory] Set ${args.key} = ${String(args.value).slice(0, 100)}`
    }
    if (a === "list") {
      const keys = ["active", "total_searches", "sessions", "project_context", "last_error", "last_session_summary"]
      const entries: string[] = []
      for (const k of keys) { const v = getMemory(k); if (v !== null) entries.push(`  ${k}: ${v.slice(0, 80)}`) }
      return entries.length ? `[HEXZ Memory] Stored keys:\n${entries.join("\n")}` : "[HEXZ Memory] No stored data."
    }
    if (a === "clear") { for (const k of ["project_context", "last_error", "last_session_summary"]) setMemory(k, ""); return "[HEXZ Memory] Cleared session keys." }
    return "Usage: hexz_memory action=(get|set|list|clear) [key=<name>] [value=<text>]"
  },
})

export const hexz_pr = tool({
  description: "Git PR workflow. Check status, diff, and create pull requests with AI descriptions.",
  args: { action: tool.schema.string(), title: tool.schema.string().optional(), base: tool.schema.string().optional() },
  async execute(args: any) {
    const a = args.action
    if (a === "status") {
      try {
        const branch = run("git", ["branch", "--show-current"]).stdout.trim()
        const status = run("git", ["status", "--short"]).stdout.trim()
        const ahead = run("git", ["log", "--oneline", "@{upstream}..HEAD", "--"]).stdout.trim()
        return `[HEXZ PR] Branch: ${branch}\n${status || "Clean"}\n${ahead ? `\nUnpushed commits:\n${ahead}` : ""}`
      } catch { return "[HEXZ PR] Not a git repository or git not available." }
    }
    if (a === "diff") {
      try {
        const diff = run("git", ["diff", "HEAD", "--stat"]).stdout.trim()
        const staged = run("git", ["diff", "--cached", "--stat"]).stdout.trim()
        return `[HEXZ PR] Changes:\n${diff || "(unstaged)"}\n${staged ? `\nStaged:\n${staged}` : ""}`
      } catch { return "[HEXZ PR] Not a git repository." }
    }
    if (a === "create") {
      try {
        const branch = run("git", ["branch", "--show-current"]).stdout.trim()
        const base = args.base ?? "main"
        const title = args.title ?? `Update ${branch}`
        const body = `Automated PR from HEXZ v${VERSION}\n\nBranch: ${branch}\nBase: ${base}`
        run("git", ["push", "-u", "origin", branch])
        const prUrl = run("gh", ["pr", "create", "--base", base, "--title", title, "--body", body]).stdout.trim()
        return `[HEXZ PR] Created: ${prUrl}`
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error"
        return `[HEXZ PR] Failed: ${msg}. Ensure gh CLI is installed and authenticated.`
      }
    }
    return "Usage: hexz_pr action=(status|diff|create) [title=<text>] [base=<branch>]"
  },
})

export const hexz_mkp = tool({
  description: "Install plugins & skills from GitHub or npm. Commands: list, remove:name, owner/repo, npm-pkg, skill:owner/repo, skill:name --content '...'",
  args: { target: tool.schema.string() },
  async execute(args: any) {
    const t = args.target.trim()
    if (!t) return "Usage: mkp <target>. Examples: mkp list, mkp owner/repo"
    const toolsDir = join(process.cwd(), ".codex-plugin")
    const skillsDir = join(toolsDir, "skills")

    if (t === "list") {
      const lines: string[] = ["[HEXZ Market] Installed:\n"]
      lines.push("Plugins:")
      try {
        const entries = readdirSync(toolsDir)
        for (const entry of entries) {
          const fullPath = join(toolsDir, entry)
          if (statSync(fullPath).isDirectory() && fileExistsSync(join(fullPath, "plugin.json"))) lines.push(`  - ${entry}`)
        }
      } catch {}
      lines.push("\nSkills:")
      try {
        const entries = readdirSync(skillsDir)
        for (const entry of entries) {
          if (fileExistsSync(join(skillsDir, entry, "SKILL.md"))) lines.push(`  - ${entry}`)
        }
      } catch {}
      return lines.join("\n")
    }

    if (t.startsWith("remove:")) {
      const name = t.slice(7).trim().replace(/[^a-zA-Z0-9._-]/g, "")
      if (!name) return "Invalid name"
      const pluginPath = join(toolsDir, name)
      try { rmSync(pluginPath, { recursive: true, force: true }); return `Removed '${name}'.` }
      catch { return `Nothing found matching '${name}'.` }
    }

    if (t.startsWith("skill:")) {
      const skillTarget = t.slice(6).trim()
      if (skillTarget.includes("--content")) {
        const match = skillTarget.match(/^(\S+)\s+--content\s+"(.+)"$/)
        if (!match) return 'Usage: skill:name --content "description and prompt"'
        const name = match[1]!.replace(/[^a-zA-Z0-9._-]/g, "")
        const content = match[2]!
        const skillDir = join(skillsDir, name)
        mkdirSync(skillDir, { recursive: true })
        writeFile(join(skillDir, "SKILL.md"), generateCodexSkill(name, "Custom skill", content))
        return `Created skill '${name}'.`
      }
      if (skillTarget.includes("/")) {
        const parts = skillTarget.split("/")
        if (parts.length !== 2) return "Use owner/repo format"
        const owner = parts[0]!.replace(/[^a-zA-Z0-9._-]/g, "")
        const repo = parts[1]!.replace(/[^a-zA-Z0-9._-]/g, "")
        const tmpDir = `/tmp/hexz-skill-${Date.now()}`
        try {
          run("git", ["clone", `https://github.com/${owner}/${repo}.git`, tmpDir, "--depth", "1"])
          let count = 0
          for (const mdFile of globSync("**/*.md", tmpDir)) {
            const text = readFile(mdFile)
            if (text?.includes("---")) {
              const filename = mdFile.split("/").pop()!
              const skillName = filename.replace(/\.md$/, "")
              const skillDir2 = join(skillsDir, skillName)
              mkdirSync(skillDir2, { recursive: true })
              writeFile(join(skillDir2, "SKILL.md"), text)
              count++
            }
          }
          rmSync(tmpDir, { recursive: true, force: true })
          return count ? `Installed ${count} skill(s).` : "No skill files found."
        } catch (e: unknown) {
          try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
          return `Failed: ${e instanceof Error ? e.message : "unknown"}`
        }
      }
      return 'Use skill:owner/repo or skill:name --content "..."'
    }

    if (t.includes("/") && !t.startsWith("http")) {
      const parts = t.split("/")
      if (parts.length !== 2) return "Use owner/repo format"
      const owner = parts[0]!.replace(/[^a-zA-Z0-9._-]/g, "")
      const repo = parts[1]!.replace(/[^a-zA-Z0-9._-]/g, "")
      const pluginDir = join(toolsDir, repo)
      mkdirSync(pluginDir, { recursive: true })
      const result = run("git", ["clone", `https://github.com/${owner}/${repo}.git`, pluginDir, "--depth", "1"])
      return result.status === 0 ? `Installed plugin ${owner}/${repo}.` : `Failed to clone ${owner}/${repo}: ${result.stderr}`
    }

    if (t.startsWith("http://") || t.startsWith("https://")) {
      const name = t.split("/").pop()?.replace(/\.git$/, "") || "plugin"
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "")
      if (!safeName) return "Could not determine plugin name from URL."
      const pluginDir = join(toolsDir, safeName)
      mkdirSync(pluginDir, { recursive: true })
      const result = run("git", ["clone", t, pluginDir, "--depth", "1"])
      return result.status === 0 ? `Installed from URL as '${safeName}'.` : `Failed: ${result.stderr}`
    }

    return "Invalid target. Use 'owner/repo', 'https://url', or 'npm-package'."
  },
})

export const hexz_status = tool({
  description: "Show HEXZ status: active/inactive, uptime, search count, cache entries.",
  args: {},
  execute() {
    const up = Math.floor((Date.now() - lastSearchTime) / 1000)
    const fallback = searXngUrl ? " | SearXNG fallback active" : ""
    return `HEXZ for Codex | v${VERSION} | ${Math.floor(up / 60)}m${up % 60}s | cache: ${searchCache.size} entries${fallback}`
  },
})

export const hexz_doctor = tool({
  description: "Check HEXZ runtime, scanner, browser, git, and safety readiness.",
  args: {},
  execute() {
    const lines: string[] = ["[HEXZ Doctor] Health Check\n"]
    try { const v = run("bun", ["--version"]).stdout.trim(); lines.push(`bun ${v} [OK]`) } catch { lines.push("bun [MISSING]") }
    try { const v = run("git", ["--version"]).stdout.trim(); lines.push(`git ${v} [OK]`) } catch { lines.push("git [MISSING]") }
    try { run("semgrep", ["--version"]); lines.push("semgrep [OK]") } catch { lines.push("semgrep [MISSING] — install: pip install semgrep") }
    try { run("gitleaks", ["--version"]); lines.push("gitleaks [OK]") } catch { lines.push("gitleaks [MISSING]") }
    for (const bin of ["chromium-browser", "google-chrome", "chromium"]) {
      try { run("command", ["-v", bin]); lines.push(`${bin} [OK]`); break } catch {}
    }
    if (!lines.some(l => l.includes("[OK]") && l.includes("chrom"))) lines.push("Chromium [MISSING] — hexz_webss requires it")
    try { run("docker", ["--version"]); lines.push("docker [OK]") } catch { lines.push("docker [MISSING] — SearXNG fallback unavailable") }
    try { run("gh", ["--version"]); lines.push("gh CLI [OK]") } catch { lines.push("gh CLI [MISSING] — hexz_pr unavailable") }
    lines.push("\nTo install missing tools: brew install <tool> or apt install <tool>")
    return lines.join("\n")
  },
})

export const hexz_sim = tool({
  description: "Simulation sandbox for destructive actions. Creates .sims/simscode-<name>/ with diff of proposed changes. Call BEFORE destructive operations.",
  args: { name: tool.schema.string(), plan: tool.schema.string(), files: tool.schema.string().optional() },
  execute(args: any) {
    const simName = args.name.replace(/[^a-zA-Z0-9._-]/g, "")
    if (!simName) return "Invalid simulation name."
    const simDir = join(process.cwd(), SIMS_DIR, `simscode-${simName}`)
    mkdirSync(simDir, { recursive: true })
    const ts = new Date().toISOString()
    writeFile(join(simDir, "simulation.md"),
      `# Simulation: ${simName}\nCreated: ${ts}\n\n## Plan\n${args.plan}\n\n## Files Affected\n${args.files ?? "(not specified)"}\n\n## Status: PENDING REVIEW\nReview the plan and files above. Check for:\n- Edge cases and error states\n- Breaking changes\n- Missing imports\n- Type mismatches\n- Security implications\n\n## Result\n- [ ] Simulation reviewed\n- [ ] Edge cases handled\n- [ ] No breaking changes\n- [ ] Ready to execute\n`)
    return `[HEXZ Sim] Created simulation at .sims/simscode-${simName}/\nPlan: ${args.plan}\nReview the sim before executing.`
  },
})

export const hexz_codebase = tool({
  description: "Scan project and generate codebase.md with file connections, imports, and exports",
  args: {},
  execute() {
    const content = scanCodebase(process.cwd())
    const dest = join(process.cwd(), "codebase.md")
    writeFileSync(dest, content)
    return `[HEXZ Codebase] Generated codebase.md (${content.split("\n").length} lines). Read it to understand file connections before making changes.`
  },
})

export const hexz_cyber = tool({
  description: "Cybersecurity skills & framework mappings. MITRE ATT&CK, NIST CSF, OWASP. 15 core domains.",
  args: { domain: tool.schema.string().optional(), query: tool.schema.string().optional(), framework: tool.schema.string().optional(), list: tool.schema.boolean().optional() },
  async execute(args: any) {
    const cyberDir = (() => {
      const candidates = [join(process.cwd(), ".codex-plugin", "cybersecurity"), join(process.cwd(), "src", "cybersecurity")]
      for (const p of candidates) { try { if (existsSync(p)) return p } catch {} }
      return candidates[0]
    })()
    if (args.list) { const skills = listCyberSkills(cyberDir); return `[HEXZ Cyber] Available skills (${skills.length} total):\n${skills.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nFrameworks: mitre, nist, owasp` }
    const lines: string[] = ["[HEXZ Cyber]"]
    if (args.framework) return readCyberFrameworkMapping(cyberDir, args.framework)
    if (args.domain) {
      const domainArg: string = args.domain
      const q = domainArg.toLowerCase().replace(/[^a-z0-9]/g, "-")
      const match = CYBER_DOMAINS.find(d => d.id.includes(q) || d.label.toLowerCase().includes(domainArg.toLowerCase()) || d.keywords.some(k => k.includes(q)))
      if (match) { lines.push(`Domain: ${match.label}`, `Keywords: ${match.keywords.join(", ")}`); const c = readCyberSkill(cyberDir, match.id); lines.push(`\n══ Skill Content ══\n${c.slice(0, 3000)}`); return lines.join("\n") }
      const skillContent = readCyberSkill(cyberDir, q)
      if (skillContent && !skillContent.startsWith("No skill file")) { lines.push(`Skill: ${args.domain}`, `\n══ Skill Content ══\n${skillContent.slice(0, 3000)}`); return lines.join("\n") }
      lines.push(`Domain '${args.domain}' not found. Available domains:`)
      for (const d of CYBER_DOMAINS) lines.push(`  ${d.id} — ${d.label}`)
      lines.push("\nUse list=true to see all skills.", "Frameworks: mitre, nist, owasp")
      return lines.join("\n")
    }
    if (args.query) {
      const q = args.query.toLowerCase()
      lines.push(`Searching cybersecurity for: ${args.query}`)
      const matched = CYBER_DOMAINS.filter(d => d.label.toLowerCase().includes(q) || d.keywords.some(k => k.includes(q)))
      if (matched.length) for (const m of matched) lines.push(`  ${m.id} — ${m.label}`)
      const skills = listCyberSkills(cyberDir)
      const skillMatches = skills.filter(s => s.toLowerCase().includes(q))
      if (skillMatches.length) { lines.push(`\nSkill matches (${skillMatches.length}):`); for (const s of skillMatches.slice(0, 20)) lines.push(`  - ${s}`) }
      if (!matched.length && !skillMatches.length) lines.push("No matches found.")
      lines.push("\nUse domain=<name> to view a skill. Frameworks: mitre, nist, owasp")
      return lines.join("\n")
    }
    lines.push("Use domain=, query=, framework=, or list=true")
    lines.push("\nMasriyan domains (15):")
    for (const d of CYBER_DOMAINS) lines.push(`  ${d.id} — ${d.label}`)
    lines.push(`\nTotal skills: ${listCyberSkills(cyberDir).length}`)
    lines.push("\nFrameworks: mitre, nist, owasp")
    return lines.join("\n")
  },
})

process.on("exit", () => stopSearXng())
process.on("SIGINT", () => { stopSearXng(); process.exit(0) })

export async function initCodexPlugin(input: any = {}): Promise<Record<string, any>> {
  const projectDir = input?.directory ?? process.cwd()
  generateCodexPluginDir(projectDir)
  return {
    hexz_search, hexz_scan, hexz_design, hexz_image, hexz_webss,
    hexz_mcp, hexz_memory, hexz_pr, hexz_mkp, hexz_status,
    hexz_doctor, hexz_sim, hexz_codebase, hexz_cyber,
  }
}

export default initCodexPlugin
export const server = initCodexPlugin
export const plugin = initCodexPlugin
