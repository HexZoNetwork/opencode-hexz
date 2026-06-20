import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"

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

const VERSION = "1.5.0"
const memoryPath = join(homedir(), ".config", "mimocode", "hexz-memory.json")
const SIMS_DIR = ".sims"

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

function isInsidePath(baseDir: string, targetPath: string): boolean {
  const rel = relative(resolve(baseDir), resolve(targetPath))
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

function resolveProjectPath(baseDir: string, input: string): string | null {
  if (!input.trim() || input.includes("\0")) return null
  const targetPath = resolve(baseDir, input)
  return isInsidePath(baseDir, targetPath) ? targetPath : null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function redactSecrets(text: string): string {
  return text
    .replace(/((?:api[_-]?key|apikey)\s*[:=]\s*['"])[^'"]+(['"])/gi, "$1REDACTED$2")
    .replace(/((?:secret[_-]?key|secretkey)\s*[:=]\s*['"])[^'"]+(['"])/gi, "$1REDACTED$2")
    .replace(/((?:password|passwd|pwd)\s*[:=]\s*['"])[^'"]+(['"])/gi, "$1REDACTED$2")
    .replace(/((?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"])[^'"]+(['"])/gi, "$1REDACTED$2")
    .replace(/AKIA[0-9A-Z]{16}/g, "AKIA_REDACTED")
    .replace(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g, "-----BEGIN PRIVATE KEY-----\nREDACTED\n-----END PRIVATE KEY-----")
    .replace(/ghp_[a-zA-Z0-9]{36}/g, "ghp_REDACTED")
    .replace(/xox[baprs]-[a-zA-Z0-9-]+/g, "xox_REDACTED")
    .replace(/(?:mongodb|mysql|postgres|redis):\/\/[^'"@\s]+:[^'"@\s]+@[^'"@\s]+/gi, "REDACTED_CONNECTION_STRING")
}

function commandExists(name: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" }).status === 0
}

function run(command: string, cwd = process.cwd()): string {
  const result = spawnSync("sh", ["-c", command], { cwd, encoding: "utf8" })
  return redactSecrets(`${result.stdout || ""}${result.stderr || ""}`.trim())
}

function readMemory(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(memoryPath, "utf8"))
  } catch {
    return {}
  }
}

function writeMemory(data: Record<string, string>): void {
  mkdirSync(resolve(memoryPath, ".."), { recursive: true })
  writeFileSync(memoryPath, JSON.stringify(data, null, 2) + "\n")
}

function scanSecrets(target: string): string {
  const findings: string[] = []
  const ignoredDirs = new Set([".git", "node_modules", "dist", ".sims", "coverage"])
  const textExts = new Set([".env", ".js", ".json", ".jsonc", ".md", ".py", ".sh", ".ts", ".tsx", ".txt", ".yaml", ".yml"])
  const patterns: Array<[string, RegExp]> = [
    ["API Key", /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/gi],
    ["Secret Key", /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"][^'"]+['"]/gi],
    ["Password", /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi],
    ["Token", /(?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][^'"]+['"]/gi],
    ["AWS Key", /AKIA[0-9A-Z]{16}/g],
    ["Private Key", /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
    ["GitHub Token", /ghp_[a-zA-Z0-9]{36}/g],
    ["Slack Token", /xox[baprs]-[a-zA-Z0-9-]+/g],
  ]

  function shouldScan(path: string): boolean {
    const name = path.split(/[\\/]/).pop() ?? ""
    if (name.startsWith(".env")) return true
    const ext = name.includes(".") ? `.${name.split(".").pop()}` : ""
    return textExts.has(ext)
  }

  function scanFile(path: string): void {
    let content = ""
    try { content = readFileSync(path, "utf8") } catch { return }
    for (const [name, pattern] of patterns) {
      pattern.lastIndex = 0
      if (pattern.test(content)) findings.push(`Found ${name} pattern in ${path}`)
    }
  }

  function walk(dir: string, depth: number): void {
    if (depth > 8 || findings.length >= 50) return
    for (const entry of readdirSync(dir)) {
      if (ignoredDirs.has(entry)) continue
      const full = join(dir, entry)
      try {
        const st = statSync(full)
        if (st.isDirectory()) walk(full, depth + 1)
        else if (st.isFile() && st.size <= 1024 * 1024 && shouldScan(full)) scanFile(full)
      } catch {}
      if (findings.length >= 50) return
    }
  }

  const st = statSync(target)
  if (st.isDirectory()) walk(target, 0)
  else if (st.isFile()) scanFile(target)
  return findings.length ? findings.join("\n") : "No secret patterns detected."
}

function scanCodebase(cwd: string): string {
  const files: string[] = []
  function walk(dir: string) {
    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const full = join(dir, entry)
        if (entry.startsWith(".") || entry === "node_modules") continue
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(ts|js|tsx|jsx|py|rs|go|java|css|html)$/.test(entry)) files.push(full)
      }
    } catch {}
  }
  walk(cwd)
  const lines: string[] = ["# Codebase Map\n", `Generated: ${new Date().toISOString()}\n`, `Total source files: ${files.length}\n`, "---\n"]
  for (const f of files.sort()) {
    const rel = f.replace(cwd, "").replace(/^[/\\]/, "")
    const content = (() => { try { return readFileSync(f, "utf8") } catch { return "" } })()
    const lineCount = content.split("\n").length
    const imports = (content.match(/^import .+ from .+$/gm) ?? []).slice(0, 5)
    const exports = (content.match(/^export (default |)const |^export (default |)function |^export (default |)class /gm) ?? []).slice(0, 3)
    lines.push(`## ${rel}`, `- Lines: ${lineCount}`)
    if (imports.length) lines.push(`- Imports: ${imports.map(i => `\`${i.trim()}\``).join(", ")}`)
    if (exports.length) lines.push(`- Exports: ${exports.map(e => `\`${e.trim()}\``).join(", ")}`)
    lines.push("")
  }
  return lines.join("\n")
}

function readCyberSkill(dir: string, domain: string): string {
  const skillDir = join(dir, "skills", domain)
  const skillFile = join(skillDir, "SKILL.md")
  let content = (() => { try { return readFileSync(skillFile, "utf8") } catch { return "" } })()
  const examplesDir = join(skillDir, "examples")
  try {
    for (const entry of readdirSync(examplesDir)) {
      if (entry.endsWith(".md")) {
        const ex = (() => { try { return readFileSync(join(examplesDir, entry), "utf8") } catch { return "" } })()
        if (ex) content += `\n\n## Example: ${entry}\n${ex.slice(0, 1000)}`
      }
    }
  } catch {}
  if (!content) {
    const mukulDir = join(dir, "skills-mukul")
    try {
      const entries = readdirSync(mukulDir)
      const match = entries.find(e => e.includes(domain.replace(/[^a-z0-9]/g, "-")))
      if (match) {
        const mukulSkill = (() => { try { return readFileSync(join(mukulDir, match, "SKILL.md"), "utf8") } catch { return "" } })()
        if (mukulSkill) content = mukulSkill.slice(0, 4000)
      }
    } catch {}
  }
  return content || `No skill file found for '${domain}'.`
}

function listCyberSkills(dir: string): string[] {
  const skills: string[] = []
  for (const sub of ["skills", "skills-mukul"]) {
    try {
      for (const e of readdirSync(join(dir, sub))) {
        if (existsSync(join(dir, sub, e, "SKILL.md"))) {
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
        const content = (() => { try { return readFileSync(join(fwDir, entry), "utf8") } catch { return "" } })()
        if (content) result += `--- ${entry} ---\n${content.slice(0, 2000)}\n\n`
      }
    }
    if (fw === "mitre") {
      const navFile = join(dir, "mappings", "attack-navigator-layer.json")
      const nav = (() => { try { return readFileSync(navFile, "utf8") } catch { return "" } })()
      if (nav) result += `\nATT&CK Navigator layer available (${Math.floor(nav.length / 1024)} KB JSON).\n`
    }
    return result
  } catch {
    return `[HEXZ Cyber] Framework '${framework}' not found. Available: mitre, nist, owasp`
  }
}

function isSafeWebUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== "http:" && u.protocol !== "https:") return false
    const host = u.hostname.toLowerCase()
    if (["localhost", "0.0.0.0", "127.0.0.1", "::1"].includes(host)) return false
    if (host.endsWith(".local") || host.startsWith("127.")) return false
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false
    return true
  } catch {
    return false
  }
}

export const hexz_search = tool({
  description: "Search DuckDuckGo for current docs, API changes, and info",
  args: { query: tool.schema.string().describe("Search query") },
  async execute(args: any) {
    const q = (args.query || "").trim().slice(0, 300)
    if (!q) return "Empty query."
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`)
    if (!res.ok) return `Search failed: HTTP ${res.status}`
    const data = await res.json() as { RelatedTopics?: Array<{ Text?: string }> }
    const items = (data.RelatedTopics ?? []).filter((item) => item.Text).slice(0, 5).map((item) => `- ${item.Text}`)
    return items.length ? items.join("\n") : "No results."
  },
})

export const hexz_scan = tool({
  description: "Security audit: deps + secret scanning. Run after building. CVSS v3.1.",
  args: {
    target: tool.schema.string().describe("Project-relative path to scan"),
    mode: tool.schema.string().optional().describe("full, deps, or quick"),
  },
  async execute(args: any) {
    const target = resolveProjectPath(process.cwd(), args.target || ".")
    if (!target) return "Target path must stay inside the project directory."
    const mode = args.mode ?? "full"
    const lines: string[] = [`[HEXZ Scan] ${args.target || "."} (${mode})`]
    if (mode === "full" || mode === "deps") {
      lines.push("", "DEPENDENCY SCANNING:")
      if (existsSync(join(target, "bun.lock")) || existsSync(join(process.cwd(), "bun.lock"))) {
        lines.push(commandExists("bun") ? run("bun audit", process.cwd()) : "bun not installed. Skipping Bun dependency audit.")
      } else if (existsSync(join(target, "package-lock.json")) || existsSync(join(process.cwd(), "package-lock.json"))) {
        lines.push(commandExists("npm") ? run("npm audit --json 2>/dev/null || npm audit", process.cwd()) : "npm not installed. Skipping npm dependency audit.")
      } else {
        lines.push("No supported dependency lockfile found.")
      }
      if (commandExists("semgrep") && mode === "full") {
        const sg = run(`semgrep --config=p/owasp-top-ten --config=p/secrets --json --quiet ${target} 2>/dev/null || true`, process.cwd())
        lines.push("", "SEMGREP STATIC ANALYSIS:", sg || "semgrep returned no output.")
      }
    }
    if (mode === "full" || mode === "quick") {
      lines.push("", "SECRET SCANNING:", scanSecrets(target))
    }
    return lines.join("\n")
  },
})

export const hexz_design = tool({
  description: "Generate HTML/CSS design scaffolds from a brief. Call for UI mockups.",
  args: {
    brief: tool.schema.string().describe("Design brief"),
    save: tool.schema.string().optional().describe("Project-relative output path"),
  },
  async execute(args: any) {
    const safeBrief = escapeHtml((args.brief || "").slice(0, 200))
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeBrief}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#111;line-height:1.6}.wrap{max-width:920px;margin:0 auto;padding:64px 24px}.card{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:24px;margin-bottom:16px}h1{font-size:2rem;font-weight:600;margin-bottom:8px;letter-spacing:-.02em}p{margin-bottom:16px;max-width:65ch}.btn{display:inline-flex;align-items:center;padding:8px 20px;background:#2f6feb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:500;font-size:15px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;margin:32px 0}.badge{display:inline-block;background:#2f6feb;color:#fff;font-size:13px;font-weight:500;padding:4px 12px;border-radius:4px;margin-bottom:16px}</style></head><body><div class="wrap"><div class="badge">HEXZ Design</div><h1>${safeBrief}</h1><p>Replace this with your project-specific content. The scaffold above gives you a clean starting point.</p><div class="grid"><div class="card"><h3>Section</h3><p>Your content here.</p></div><div class="card"><h3>Section</h3><p>Your content here.</p></div><div class="card"><h3>Section</h3><p>Your content here.</p></div></div><button class="btn">Get Started</button></div></body></html>`
    if (args.save) {
      const out = resolveProjectPath(process.cwd(), args.save)
      if (!out) return "Save path must stay inside the project directory."
      mkdirSync(resolve(out, ".."), { recursive: true })
      writeFileSync(out, html)
      return `[HEXZ Design] Saved to ${args.save}`
    }
    return html
  },
})

export const hexz_image = tool({
  description: "Analyze images via OCR. Extract text from screenshots, error messages, diagrams, mockups.",
  args: {
    image_path: tool.schema.string().describe("Path to image file"),
    intent: tool.schema.string().optional().describe("Analysis intent"),
  },
  async execute(args: any) {
    const imagePath = resolveProjectPath(process.cwd(), args.image_path)
    if (!imagePath) return "Image path must stay inside the project directory."
    if (!existsSync(imagePath)) return `[HEXZ Image] File not found: ${args.image_path}`
    const intent = args.intent ?? "auto"
    try {
      const mod = await import("tesseract.js") as any
      const result = await mod.recognize(imagePath, "eng")
      const text = result.data.text.trim()
      let response = `[HEXZ Image] ${args.image_path}\nIntent: ${intent}\n`
      if (text) {
        response += `\nExtracted text (${text.split("\n").length} lines):\n${text.slice(0, 2000)}`
      } else {
        response += "\nNo text detected in image."
      }
      response += `\n\nConfidence: ${Math.round(result.data.confidence)}%`
      return response
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error"
      return `[HEXZ Image] OCR failed: ${msg}. You can still manually describe what you see.`
    }
  },
})

export const hexz_webss = tool({
  description: "Capture website screenshots via Puppeteer. Use for visual debugging, design reference, or archiving.",
  args: {
    url: tool.schema.string().describe("Public URL to capture"),
    output: tool.schema.string().optional().describe("Project-relative save path"),
    width: tool.schema.number().optional(),
    height: tool.schema.number().optional(),
    fullPage: tool.schema.boolean().optional(),
    type: tool.schema.string().optional(),
    quality: tool.schema.number().optional(),
    emulateDevice: tool.schema.string().optional(),
    css: tool.schema.string().optional(),
    inputType: tool.schema.string().optional(),
  },
  async execute(args: any) {
    const safeUrl = (args.url || "").trim()
    if (!isSafeWebUrl(safeUrl)) return "URL must be public http(s), not localhost or a private network address."
    try {
      const mod = await import("capture-website") as any
      const cw = mod.default || mod
      const opts: Record<string, unknown> = {}
      if (args.width) opts["width"] = Number(args.width)
      if (args.height) opts["height"] = Number(args.height)
      if (args.fullPage) opts["fullPage"] = args.fullPage === true || args.fullPage === "true"
      if (args.type) opts["type"] = args.type
      if (args.quality) opts["quality"] = Number(args.quality)
      if (args.emulateDevice && args.emulateDevice !== "none" && args.emulateDevice !== "") opts["emulateDevice"] = args.emulateDevice
      if (args.css) opts["css"] = args.css
      if (args.inputType) opts["inputType"] = args.inputType
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
  description: "MCP (Model Context Protocol) server management. Connect/discover/list external MCP servers.",
  args: {
    action: tool.schema.string().describe("connect, disconnect, or list"),
    server: tool.schema.string().optional().describe("Server URL"),
  },
  async execute(args: any) {
    const a = args.action
    if (a === "list") {
      const configPath = join(homedir(), ".config", "mimocode", "mcp-servers.json")
      try {
        const raw = readFileSync(configPath, "utf8")
        const servers = JSON.parse(raw)
        const names = Object.keys(servers)
        return names.length ? `[HEXZ MCP] Configured servers:\n${names.map((n) => `  - ${n}`).join("\n")}` : "[HEXZ MCP] No MCP servers configured."
      } catch {
        return "[HEXZ MCP] No MCP servers configured. Use action=connect server=<url>"
      }
    }
    if (a === "connect") {
      if (!args.server) return "Usage: action=connect server=<url>"
      const servers: Record<string, { url: string }> = {}
      try { Object.assign(servers, JSON.parse(readFileSync(join(homedir(), ".config", "mimocode", "mcp-servers.json"), "utf8"))) } catch {}
      const name = new URL(args.server).hostname || `server-${Date.now()}`
      servers[name] = { url: args.server }
      mkdirSync(join(homedir(), ".config", "mimocode"), { recursive: true })
      writeFileSync(join(homedir(), ".config", "mimocode", "mcp-servers.json"), JSON.stringify(servers, null, 2) + "\n")
      return `[HEXZ MCP] Added server '${name}': ${args.server}`
    }
    if (a === "disconnect") {
      if (!args.server) return "Usage: action=disconnect server=<name or url>"
      const configPath = join(homedir(), ".config", "mimocode", "mcp-servers.json")
      try {
        const raw = readFileSync(configPath, "utf8")
        const servers = JSON.parse(raw)
        delete servers[args.server]
        for (const [k, v] of Object.entries(servers) as Array<[string, { url: string }]>) {
          if (v.url === args.server) delete servers[k]
        }
        writeFileSync(configPath, JSON.stringify(servers, null, 2) + "\n")
        return `[HEXZ MCP] Disconnected ${args.server}`
      } catch {
        return "[HEXZ MCP] Not connected."
      }
    }
    return "Usage: hexz_mcp action=(connect|disconnect|list) [server=<url>]"
  },
})

export const hexz_memory = tool({
  description: "Persistent agent memory across sessions. Store project context, preferences, and summaries.",
  args: {
    action: tool.schema.string().describe("get, set, list, or clear"),
    key: tool.schema.string().optional(),
    value: tool.schema.string().optional(),
  },
  async execute(args: any) {
    const data = readMemory()
    if (args.action === "get") return args.key && data[args.key] ? `[HEXZ Memory] ${args.key} = ${data[args.key]}` : "Key not found."
    if (args.action === "set") {
      if (!args.key || args.value === undefined) return "Usage: action=set key=<name> value=<text>"
      data[args.key] = redactSecrets(args.value)
      writeMemory(data)
      return `[HEXZ Memory] Set ${args.key}`
    }
    if (args.action === "list") {
      const keys = Object.keys(data)
      return keys.length ? `[HEXZ Memory] Stored keys:\n${keys.map((k) => `  ${k}: ${(data[k] || "").slice(0, 80)}`).join("\n")}` : "[HEXZ Memory] No stored data."
    }
    if (args.action === "clear") {
      writeMemory({})
      return "[HEXZ Memory] Cleared."
    }
    return "Usage: hexz_memory action=(get|set|list|clear) [key=<name>] [value=<text>]"
  },
})

export const hexz_pr = tool({
  description: "Git PR workflow. Status, diff, create pull requests with gh CLI.",
  args: {
    action: tool.schema.string().describe("status, diff, or create"),
    title: tool.schema.string().optional(),
    base: tool.schema.string().optional(),
  },
  async execute(args: any) {
    const a = args.action
    if (a === "status") {
      if (!commandExists("git")) return "[HEXZ PR] git not available."
      const branch = run("git branch --show-current")
      const status = run("git status --short")
      const ahead = run("git log --oneline @{u}.. 2>/dev/null || true")
      return `[HEXZ PR] Branch: ${branch}\n${status || "Clean working tree"}\n${ahead ? `Ahead by:\n${ahead}` : "Up to date with remote"}`
    }
    if (a === "diff") {
      if (!commandExists("git")) return "[HEXZ PR] git not available."
      const diff = run("git diff HEAD --stat")
      const staged = run("git diff --cached --stat")
      return `[HEXZ PR] Changes:\n${diff || "(unstaged)"}\n${staged ? `\nStaged:\n${staged}` : ""}`
    }
    if (a === "create") {
      if (!commandExists("git") || !commandExists("gh")) return "[HEXZ PR] git or gh CLI not available."
      const branch = run("git branch --show-current")
      const base = args.base ?? "main"
      const title = args.title ?? `Update ${branch}`
      const body = `Automated PR from HEXZ v${VERSION}\n\nBranch: ${branch}\nBase: ${base}`
      run(`git push -u origin ${branch} 2>/dev/null || true`)
      const prUrl = run(`gh pr create --base ${base} --title ${title} --body ${body}`)
      return prUrl ? `[HEXZ PR] ${prUrl}` : "[HEXZ PR] Failed to create PR."
    }
    return "Usage: hexz_pr action=(status|diff|create) [title=<text>] [base=<branch>]"
  },
})

export const hexz_mkp = tool({
  description: "Install plugins & skills from GitHub or npm. Commands: list, remove:name, owner/repo, npm-pkg, skill:owner/repo, skill:name --content '...'",
  args: { target: tool.schema.string().describe("Plugin/skill target") },
  async execute(args: any) {
    const t = (args.target || "").trim()
    if (!t) return "Usage: mkp <target>. Examples: mkp list, mkp owner/repo, mkp skill:my-skill"
    const toolsDir = join(process.cwd(), ".mimocode", "tools")
    const commandsDir = join(process.cwd(), ".mimocode", "commands")

    if (t === "list") {
      const tools: string[] = []
      const commands: string[] = []
      try { for (const e of readdirSync(toolsDir)) if (e.endsWith(".ts")) tools.push(e.replace(".ts", "")) } catch {}
      try { for (const e of readdirSync(commandsDir)) if (e.endsWith(".md")) commands.push(e.replace(".md", "")) } catch {}
      return `[HEXZ MKP] Installed:\nTools: ${tools.length ? tools.join(", ") : "(none)"}\nCommands: ${commands.length ? commands.join(", ") : "(none)"}`
    }

    if (t.startsWith("remove:")) {
      const name = t.slice(7).trim()
      let removed = false
      try { writeFileSync(join(toolsDir, `${name}.ts`), ""); removed = true } catch {}
      try { writeFileSync(join(commandsDir, `${name}.md`), ""); removed = true } catch {}
      return removed ? `[HEXZ MKP] Removed ${name}` : `[HEXZ MKP] ${name} not found.`
    }

    if (t.startsWith("skill:")) {
      const skillArg = t.slice(6).trim()
      const contentMatch = skillArg.match(/^(\S+)\s+--content\s+"(.+)"$/)
      if (contentMatch) {
        const name = contentMatch[1].replace(/[^a-zA-Z0-9._-]/g, "")
        const content = contentMatch[2]
        if (!name) return "Invalid skill name."
        mkdirSync(commandsDir, { recursive: true })
        writeFileSync(join(commandsDir, `${name}.md`), `---\ndescription: ${name}\n---\n${content}`)
        return `Created skill '${name}'.`
      }
      if (skillArg.includes("/")) {
        const [owner, repo] = skillArg.split("/")
        if (!owner || !repo) return "Use owner/repo format."
        const tmpDir = `/tmp/hexz-skill-${Date.now()}`
        const clone = run(`git clone https://github.com/${owner}/${repo}.git ${tmpDir} --depth 1 2>&1 || true`)
        if (clone.includes("fatal")) return `Failed to clone: ${clone}`
        let count = 0
        for (const searchDir of ["", "skills", "commands"]) {
          const target = searchDir ? join(tmpDir, searchDir) : tmpDir
          try {
            for (const e of readdirSync(target)) {
              if (e.endsWith(".md")) {
                const content = readFileSync(join(target, e), "utf8")
                mkdirSync(commandsDir, { recursive: true })
                writeFileSync(join(commandsDir, e), content)
                count++
              }
            }
          } catch {}
        }
        run(`rm -rf ${tmpDir}`)
        return `Installed ${count} skill(s) from ${owner}/${repo}.`
      }
      return 'Usage: skill:name --content "..." or skill:owner/repo'
    }

    if (t.includes("/") && !t.startsWith("http") && t.split("/").length === 2) {
      const [owner, repo] = t.split("/")
      const safeOwner = owner.replace(/[^a-zA-Z0-9._-]/g, "")
      const safeRepo = repo.replace(/[^a-zA-Z0-9._-]/g, "")
      const pluginDir = join(toolsDir, safeRepo)
      mkdirSync(pluginDir, { recursive: true })
      const result = run(`git clone https://github.com/${safeOwner}/${safeRepo}.git ${pluginDir} --depth 1 2>&1 || true`)
      return result.includes("Cloning into") ? `[HEXZ MKP] Installed ${t}.` : `[HEXZ MKP] ${result}`
    }

    if (/^[a-zA-Z0-9@._-]+$/.test(t)) {
      const result = run(`npm install ${t} --save 2>&1 || bun add ${t} 2>&1 || true`)
      return result ? `[HEXZ MKP] ${result.slice(0, 500)}` : `[HEXZ MKP] Installed ${t}.`
    }

    if (t.startsWith("http")) {
      const name = t.split("/").pop()?.replace(/\.git$/, "") || "plugin"
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "")
      const pluginDir = join(toolsDir, safeName)
      mkdirSync(pluginDir, { recursive: true })
      const result = run(`git clone ${t} ${pluginDir} --depth 1 2>&1 || true`)
      return result.includes("Cloning into") ? `[HEXZ MKP] Installed as '${safeName}'.` : `[HEXZ MKP] ${result}`
    }

    return "Invalid target. Use 'owner/repo', 'https://url', 'npm-package', or 'skill:name'."
  },
})

export const hexz_status = tool({
  description: "Show HEXZ MiMo adapter status and version",
  args: {},
  async execute() {
    return `HEXZ MiMo adapter ON | v${VERSION}`
  },
})

export const hexz_doctor = tool({
  description: "Check HEXZ MiMo runtime, scanners, browser, git, and safety readiness",
  args: {},
  async execute() {
    const checks = ["mimo", "bun", "git", "npm", "gh", "semgrep", "pip-audit", "chromium", "chromium-browser", "google-chrome"]
    const lines = [`[HEXZ Doctor] MiMo adapter v${VERSION}`, `Project: ${process.cwd()}`, "", "Tools:"]
    for (const name of checks) lines.push(`- ${commandExists(name) ? "OK" : "MISSING"} ${name}`)
    lines.push("", "Security defaults:", "- Project-bound file writes: enabled", "- Output/memory secret redaction: enabled", "- Directory secret scanning: enabled")
    return lines.join("\n")
  },
})

export const hexz_sim = tool({
  description: "Simulation sandbox for destructive actions. Creates .sims/simscode-<name>/ with plan. Call BEFORE Write/Edit/Bash-rm/mv/cp.",
  args: {
    name: tool.schema.string().describe("Simulation name"),
    plan: tool.schema.string().describe("Description of what will change"),
    files: tool.schema.string().optional().describe("Files that will be affected"),
  },
  async execute(args: any) {
    const simName = (args.name || "").replace(/[^a-zA-Z0-9._-]/g, "")
    if (!simName) return "Invalid simulation name."
    const simDir = join(process.cwd(), SIMS_DIR, `simscode-${simName}`)
    try { mkdirSync(simDir, { recursive: true }) } catch { return `Failed to create ${simDir}` }
    const ts = new Date().toISOString()
    const simContent = [
      `# Simulation: ${simName}`,
      `Created: ${ts}`,
      "",
      "## Plan",
      args.plan || "(no plan specified)",
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
    ].join("\n")
    writeFileSync(join(simDir, "simulation.md"), simContent)
    return `[HEXZ Sim] Created simulation at .sims/simscode-${simName}/\nPlan: ${args.plan}\nReview the sim before executing.`
  },
})

export const hexz_codebase = tool({
  description: "Scan project and generate codebase.md with file connections, imports, and exports",
  args: {},
  async execute() {
    const content = scanCodebase(process.cwd())
    const dest = join(process.cwd(), "codebase.md")
    writeFileSync(dest, content)
    return `[HEXZ Codebase] Generated codebase.md (${content.split("\n").length} lines). Read it to understand file connections before making changes.`
  },
})

export const hexz_cyber = tool({
  description: "Cybersecurity skills & framework mappings. MITRE ATT&CK, NIST CSF, OWASP. 15 core domains.",
  args: {
    domain: tool.schema.string().optional(),
    query: tool.schema.string().optional(),
    framework: tool.schema.string().optional(),
    list: tool.schema.boolean().optional(),
  },
  async execute(args: any) {
    const cyberDir = join(process.cwd(), ".mimocode", "cybersecurity")
    if (args.list) {
      const skills = listCyberSkills(cyberDir)
      return `[HEXZ Cyber] Available skills (${skills.length} total):\n${skills.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nFrameworks: mitre, nist, owasp`
    }
    const lines: string[] = ["[HEXZ Cyber]"]
    if (args.framework) return readCyberFrameworkMapping(cyberDir, args.framework)
    if (args.domain) {
      const domainArg: string = args.domain
      const q = domainArg.toLowerCase().replace(/[^a-z0-9]/g, "-")
      const match = CYBER_DOMAINS.find(d => d.id.includes(q) || d.label.toLowerCase().includes(domainArg.toLowerCase()) || d.keywords.some(k => k.includes(q)))
      if (match) {
        lines.push(`Domain: ${match.label}`, `Keywords: ${match.keywords.join(", ")}`)
        const skillContent = readCyberSkill(cyberDir, match.id)
        lines.push(`\n══ Skill Content ══\n${skillContent.slice(0, 3000)}`)
        return lines.join("\n")
      }
      const skillContent = readCyberSkill(cyberDir, q)
      if (skillContent && !skillContent.startsWith("No skill file")) {
        lines.push(`Skill: ${args.domain}`, `\n══ Skill Content ══\n${skillContent.slice(0, 3000)}`)
        return lines.join("\n")
      }
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
      if (skillMatches.length) {
        lines.push(`\nSkill matches (${skillMatches.length}):`)
        for (const s of skillMatches.slice(0, 20)) lines.push(`  - ${s}`)
        if (skillMatches.length > 20) lines.push(`  ... and ${skillMatches.length - 20} more`)
      }
      if (!matched.length && !skillMatches.length) lines.push("No matches found.")
      lines.push("\nUse domain=<name> to view a skill. Frameworks: mitre, nist, owasp")
      return lines.join("\n")
    }
    lines.push("Use domain=, query=, framework=, or list=true")
    lines.push("\nMasriyan domains (15):")
    for (const d of CYBER_DOMAINS) lines.push(`  ${d.id} — ${d.label}`)
    lines.push(`\nTotal skills available: ${listCyberSkills(cyberDir).length}`, "\nFrameworks: mitre, nist, owasp")
    return lines.join("\n")
  },
})
