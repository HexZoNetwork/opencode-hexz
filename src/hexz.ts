import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { Database } from "bun:sqlite";
export const VERSION = "1.3.0";
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
  diagnostics: [] as Array<{ file: string; line: number; message: string; severity: string }>,
};
const searchCache = new Map<string, SearchCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_MS = 3000;
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
  try {
    await Bun.file(path).exists();
    return true;
  } catch {
    return false;
  }
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
  
  
    const file = Bun.file(target);
    if (await file.exists()) {
      const content = await file.text();
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
function generateDesignScaffold(surface: string, brief: string, designSystem?: string): string {
  const colorScheme =
    designSystem === "light"
      ? { bg: "#FFFFFF", fg: "#000000", accent: "#0066CC", muted: "#666666" }
      : { bg: "#000000", fg: "#FFFFFF", accent: "#E0E0E0", muted: "#999999" };
  const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${colorScheme.bg}; color: ${colorScheme.fg}; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; margin-bottom: 0.75rem; color: ${colorScheme.muted}; }
    p { line-height: 1.6; margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 0.75rem 1.5rem; background: ${colorScheme.accent}; color: ${colorScheme.bg}; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
    .btn:hover { opacity: 0.9; }
  `;
  let body = "";
  switch (surface) {
    case "web":
      body = `
        <header style="padding: 2rem; border-bottom: 1px solid ${colorScheme.muted};">
          <div class="container">
            <h1>${brief}</h1>
            <nav style="margin-top: 1rem;">
              <a href="#" style="margin-right: 1rem; color: ${colorScheme.accent};">Home</a>
              <a href="#" style="margin-right: 1rem; color: ${colorScheme.accent};">Features</a>
              <a href="#" style="margin-right: 1rem; color: ${colorScheme.accent};">Pricing</a>
              <a href="#" style="color: ${colorScheme.accent};">Contact</a>
            </nav>
          </div>
        </header>
        <main class="container" style="padding: 4rem 2rem;">
          <section style="text-align: center; margin-bottom: 4rem;">
            <h2>Welcome to ${brief}</h2>
            <p style="max-width: 600px; margin: 1rem auto;">This is a scaffold for your web application. Replace this content with your actual design.</p>
            <button class="btn">Get Started</button>
          </section>
          <section style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;">
            <div style="padding: 1.5rem; border: 1px solid ${colorScheme.muted}; border-radius: 8px;">
              <h3>Feature 1</h3>
              <p>Description of feature one.</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid ${colorScheme.muted}; border-radius: 8px;">
              <h3>Feature 2</h3>
              <p>Description of feature two.</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid ${colorScheme.muted}; border-radius: 8px;">
              <h3>Feature 3</h3>
              <p>Description of feature three.</p>
            </div>
          </section>
        </main>
      `;
      break;
    case "mobile":
      body = `
        <div style="max-width: 375px; margin: 0 auto; border: 2px solid ${colorScheme.muted}; border-radius: 20px; overflow: hidden; height: 812px;">
          <div style="padding: 1rem; background: ${colorScheme.muted}; color: ${colorScheme.bg}; text-align: center;">
            <div style="width: 100px; height: 24px; background: ${colorScheme.bg}; border-radius: 12px; margin: 0 auto;"></div>
          </div>
          <div style="padding: 1.5rem;">
            <h1 style="font-size: 1.5rem;">${brief}</h1>
            <p style="margin-top: 1rem;">Mobile app scaffold. Replace with your actual content.</p>
            <button class="btn" style="width: 100%; margin-top: 2rem;">Action</button>
            <div style="margin-top: 2rem;">
              <div style="padding: 1rem; border-bottom: 1px solid ${colorScheme.muted};">Item 1</div>
              <div style="padding: 1rem; border-bottom: 1px solid ${colorScheme.muted};">Item 2</div>
              <div style="padding: 1rem;">Item 3</div>
            </div>
          </div>
        </div>
      `;
      break;
    case "dashboard":
      body = `
        <div style="display: flex; min-height: 100vh;">
          <aside style="width: 250px; background: ${colorScheme.muted}; color: ${colorScheme.bg}; padding: 1.5rem;">
            <h2 style="color: ${colorScheme.bg}; margin-bottom: 2rem;">Dashboard</h2>
            <nav>
              <a href="#" style="display: block; padding: 0.75rem; color: ${colorScheme.bg}; margin-bottom: 0.5rem;">Overview</a>
              <a href="#" style="display: block; padding: 0.75rem; color: ${colorScheme.bg}; margin-bottom: 0.5rem;">Analytics</a>
              <a href="#" style="display: block; padding: 0.75rem; color: ${colorScheme.bg}; margin-bottom: 0.5rem;">Users</a>
              <a href="#" style="display: block; padding: 0.75rem; color: ${colorScheme.bg};">Settings</a>
            </nav>
          </aside>
          <main style="flex: 1; padding: 2rem;">
            <h1>${brief}</h1>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 2rem;">
              <div style="padding: 1.5rem; background: ${colorScheme.accent}; color: ${colorScheme.bg}; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: bold;">1,234</div>
                <div>Total Users</div>
              </div>
              <div style="padding: 1.5rem; background: ${colorScheme.accent}; color: ${colorScheme.bg}; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: bold;">567</div>
                <div>Active Today</div>
              </div>
              <div style="padding: 1.5rem; background: ${colorScheme.accent}; color: ${colorScheme.bg}; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: bold;">89%</div>
                <div>Satisfaction</div>
              </div>
              <div style="padding: 1.5rem; background: ${colorScheme.accent}; color: ${colorScheme.bg}; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: bold;">$12k</div>
                <div>Revenue</div>
              </div>
            </div>
          </main>
        </div>
      `;
      break;
    case "deck":
      body = `
        <div style="width: 1280px; height: 720px; margin: 0 auto; padding: 4rem; display: flex; flex-direction: column; justify-content: center;">
          <h1 style="font-size: 3rem; margin-bottom: 2rem;">${brief}</h1>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem;">
            <div>
              <h2 style="margin-bottom: 1rem;">Key Points</h2>
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 0.5rem 0; border-bottom: 1px solid ${colorScheme.muted};">First important point</li>
                <li style="padding: 0.5rem 0; border-bottom: 1px solid ${colorScheme.muted};">Second important point</li>
                <li style="padding: 0.5rem 0;">Third important point</li>
              </ul>
            </div>
            <div style="background: ${colorScheme.muted}; height: 300px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
              <span style="color: ${colorScheme.bg};">Chart/Visual</span>
            </div>
          </div>
        </div>
      `;
      break;
    case "email":
      body = `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; background: ${colorScheme.bg};">
          <div style="text-align: center; padding: 2rem 0; border-bottom: 1px solid ${colorScheme.muted};">
            <h1 style="font-size: 1.5rem;">${brief}</h1>
          </div>
          <div style="padding: 2rem 0;">
            <p>Hello,</p>
            <p>This is a scaffold for your email template. Replace this content with your actual message.</p>
            <div style="text-align: center; margin: 2rem 0;">
              <a href="#" class="btn">Call to Action</a>
            </div>
            <p style="color: ${colorScheme.muted}; font-size: 0.875rem;">If you didn't request this email, please ignore it.</p>
          </div>
          <div style="text-align: center; padding: 1rem 0; border-top: 1px solid ${colorScheme.muted}; color: ${colorScheme.muted}; font-size: 0.75rem;">
            <p>Company Name • Address • City, State ZIP</p>
          </div>
        </div>
      `;
      break;
    default:
      body = `
        <div class="container">
          <h1>${brief}</h1>
          <p>Custom scaffold for: ${surface}</p>
        </div>
      `;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brief} — HEXZ Design Scaffold</title>
  <style>${baseStyles}</style>
</head>
<body>
${body}
</body>
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
[HEXZ MODE — SENIOR ENGINEER PERSONA]
You are a battle-hardened senior engineer. You ship working code, not essays.
══ RULES ══
1. ANSWER IN 1-3 SENTENCES FIRST. Then show code. Then explain ONLY if asked.
2. NEVER start with "Sure!", "Great question!", "I'd be happy to help!", "Certainly!".
   Start with the answer. Example:
   BAD: "Great question! Let me help you with that. Here's how you can set up Express..."
   GOOD: "Use express-rate-limit and helmet. Here's the setup:"
3. NEVER say "Here is the code" or "Here's how to do it" — just DO it.
4. Use contractions. "don't" not "do not". "it's" not "it is". "can't" not "cannot".
5. Vary sentence length. Mix 4-word sentences with 20-word sentences. Never 3 sentences of similar length.
6. NO FILLER WORDS. If you catch yourself writing these, delete the sentence:
   - pivotal, crucial, vital, robust, seamless, leverage, utilize, facilitate
   - innovative, dynamic, comprehensive, holistic, robust, ecosystem
   - delve, underscore, foster, cultivate, streamline, harness, illuminate
   - "It's worth noting", "In summary", "Furthermore", "Moreover"
   - "Let me know if you need anything else!"
7. When asked to build something:
   - First, ask 2-3 specific technical questions (not "what do you want?")
   - "REST or GraphQL? SQLite or Postgres? Auth needed?"
   - "What's the main entity? What fields?"
   - Then build it. No preamble.
8. Use hexz_search() BEFORE writing any code. Every. Single. Time.
   You don't know the latest API. You don't know the breaking changes. Search first.
9. Write production code from line 1:
   - Error handling: try/catch with specific messages
   - Input validation: check before using
   - No hardcoded values: use env vars or config
   - Types: use TypeScript interfaces, not 'any'
   - Logging: console.error for errors, not console.log spam
10. Self-review before finishing:
    - Did I handle errors?
    - Did I validate inputs?
    - Any hardcoded strings?
    - Is the code idiomatic?
    - Would I deploy this to production?
11. Code style:
    - Prefer 'const' over 'let'
    - Early returns over nested ifs
    - Small functions (< 50 lines)
    - Name things clearly: 'getUserById' not 'getStuff'
    - No console.log in production code
12. If something is wrong, say so directly:
    BAD: "That approach might work but there could be some edge cases to consider..."
    GOOD: "That'll break when the user is null. Use optional chaining."
══ TOOLS ══
hexz_search: Use before EVERY build. Search for latest docs, patterns, gotchas.
hexz_scan: Run security audit after building. 7 modules, CVSS scores.
hexz_design: Generate HTML/CSS mockups. Single file, no external deps.
hexz_image: Read screenshots, errors, diagrams. Describe what you see.
hexz_mkp: Install plugins & skills. "list", "remove:name", "owner/repo", "npm-pkg", "skill:owner/repo".
hexz_status: Check if HEXZ is active.
══ WHAT TO DO ══
When user says "build X":
  1. Ask clarifying questions (stack, scope, auth, DB)
  2. Search with hexz_search for current best practices
  3. Plan architecture (2-3 sentences max)
  4. Build it — write the code, don't describe writing it
  5. Review for bugs, errors, secrets
  6. Tell user what you built
When user shares code to review:
  1. Read it
  2. Find the bugs (there are always bugs)
  3. Show the fix, not the problem description
  4. Run hexz_scan if security-relevant
When user asks a question:
  1. Answer directly (1 sentence if possible)
  2. Show example if helpful
  3. Stop talking
`.trim();
const CONTEXT_PRESERVE = `
## HEXZ Active
Personality: Senior engineer, no fluff, ships code.
Workflow: search → plan → build → review → test.
Version: ${VERSION}
Active since: ${new Date(state.startTime).toISOString()}
`.trim();
export const HexzPlugin: Plugin = async ({ client, $ }) => {
  const db = new Database(".opencode/hexz-memory.db");
  db.exec("CREATE TABLE IF NOT EXISTS memory (key TEXT PRIMARY KEY, value TEXT)");
  function getMemory(key: string): string | null {
    const row = db.query("SELECT value FROM memory WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }
  function setMemory(key: string, value: string): void {
    db.query("INSERT OR REPLACE INTO memory (key, value) VALUES (?, ?)").run(key, value);
  }
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
      const exists = await Bun.file(`${pluginsDir}/${repo}/package.json`).exists();
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
      await Bun.write(`${commandsDir}/${name}.md`, skillContent);
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
            const glob = new Bun.Glob("**/*.md");
            for await (const entry of glob.scan({ cwd: dir, absolute: true })) {
              const file = Bun.file(entry);
              const text = await file.text();
              if (!text.includes("---")) continue;
              const filename = entry.split("/").pop()!;
              await Bun.write(`${commandsDir}/${filename}`, text);
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
      const glob = new Bun.Glob("*/package.json");
      for await (const _ of glob.scan({ cwd: pluginsDir })) {
      
      }
    
      const dirGlob = new Bun.Glob("*");
      for await (const entry of dirGlob.scan({ cwd: pluginsDir, onlyFiles: false })) {
        lines.push(`  - ${entry}`);
        pluginCount++;
      }
      if (pluginCount === 0) lines.push("  (none)");
    } catch {
      lines.push("  (none)");
    }
  
    lines.push("\nSkills:");
    let skillCount = 0;
    try {
      const glob = new Bun.Glob("*.md");
      for await (const entry of glob.scan({ cwd: commandsDir })) {
        const name = entry.replace(/\.md$/, "");
        lines.push(`  - ${name}`);
        skillCount++;
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
    try {
      const exists = await Bun.file(skillPath).exists();
      if (exists) {
        await $`rm -f ${skillPath}`;
        return `Removed skill '${safeName}'. Restart opencode.`;
      }
    } catch {
    
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
      if (text.includes("HEXZ_ACTIVATE") || text.toLowerCase().includes("engage hexz")) {
        state.active = true;
        for (const part of output.parts) {
          if ("text" in part) (part as MessagePart).text = "[HEXZ] Active. Senior engineer mode.";
        }
        return;
      }
      if (text.includes("HEXZ_DEACTIVATE") || text.toLowerCase().includes("revert to default")) {
        state.active = false;
        for (const part of output.parts) {
          if ("text" in part) (part as MessagePart).text = "[HEXZ] Off.";
        }
        return;
      }
    },
    "experimental.chat.system.transform": async (_input, output) => {
      if (state.active) {
        output.system.push(SYSTEM_PROMPT);
      }
    },
    "experimental.session.compacting": async (_input, output) => {
      if (state.active) {
        output.context.push(CONTEXT_PRESERVE);
      }
    },
    "chat.params": async (_input, output) => {
      if (!state.active) return;
      output.temperature = 0.3;
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
      if (input.tool !== "Bash" && input.tool !== "Write") return;
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
    
      if (!isBuild(args)) return;
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
    },
    "tool.execute.after": async (_input, output) => {
      if (!state.active) return;
      let cleaned = output.output.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "").replace(/\r\n/g, "\n");
    
      cleaned = redactSecrets(cleaned);
      if (cleaned.length > 4000) {
        output.output = `${cleaned.slice(0, 4000)}\n\n[HEXZ] Truncated — showing first 4000 chars.`;
      } else {
        output.output = cleaned;
      }
    },
    "tool.definition": async (input, output) => {
      if (state.active) return;
      const hidden = [
        "hexz_search",
        "hexz_scan",
        "hexz_design",
        "hexz_image",
        "hexz_mkp",
        "hexz_status",
      ];
      if (hidden.includes(input.toolID)) {
        output.description = "[HEXZ OFF] Activate with /active first.";
      }
    },
    "session.idle": async (_input: any, _output: any) => {
      if (!state.active) return;
      const up = Math.floor((Date.now() - state.startTime) / 1000);
      const minutes = Math.floor(up / 60);
      const seconds = up % 60;
      const message = `HEXZ active for ${minutes}m${seconds}s. ${state.searches} searches performed.`;
      await sendNotification("HEXZ Status", message);
    
      const prevSearches = parseInt(getMemory("total_searches") ?? "0", 10);
      setMemory("total_searches", String(prevSearches + state.searches));
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
      const filePath = input.path;
      if (!filePath) return;
    
      try {
        await $`biome format --write ${filePath}`.quiet();
      } catch {
      
        try {
          await $`prettier --write ${filePath}`.quiet();
        } catch {
        
        }
      }
    },
    "session.created": async (input: any, _output: any) => {
    
      const sessions = parseInt(getMemory("sessions") ?? "0", 10);
      setMemory("sessions", String(sessions + 1));
    
      const dir = input.directory ?? ".";
      const projectTypes = await detectProjectType(dir);
      if (projectTypes.length > 0 && !state.active) {
        state.active = true;
        console.log(`[HEXZ] Auto-activated for project type: ${projectTypes.join(", ")}`);
      }
    },
    tool: {
      hexz_search: tool({
        get description() {
          return state.active
            ? "Web search via DuckDuckGo. Use before building code. Finds latest docs, API changes, breaking changes, best practices."
            : "[HEXZ OFF] Activate with /active first.";
        },
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
        get description() {
          return state.active
            ? "Security audit: injection, XSS, secrets, deps, data flow, auth, crypto. CVSS v3.1 per finding."
            : "[HEXZ OFF] Activate with /active first.";
        },
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
        get description() {
          return state.active
            ? "Generate design scaffold as single HTML. Surfaces: web, mobile, dashboard, deck, email."
            : "[HEXZ OFF] Activate with /active first.";
        },
        args: {
          surface: tool.schema.string(),
          brief: tool.schema.string(),
          design_system: tool.schema.string().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          const specs: Record<string, string> = {
            web: "1440px single page",
            mobile: "375x812 iPhone frame",
            dashboard: "sidebar + KPI cards",
            deck: "1280x720 slides",
            email: "600px table layout",
          };
          const html = generateDesignScaffold(args.surface, args.brief, args.design_system);
          return `[HEXZ Design]
Surface: ${specs[args.surface] ?? args.surface}
Brief: ${args.brief}
Output: single HTML, no external deps
Style: ${args.design_system ?? "dark"} mode
${html}`;
        },
      }),
      hexz_image: tool({
        get description() {
          return state.active
            ? "Analyze images: UI screenshot, error, diagram, mockup. Describe and execute."
            : "[HEXZ OFF] Activate with /active first.";
        },
        args: {
          image_path: tool.schema.string(),
          intent: tool.schema.string().optional(),
        },
        async execute(args, _ctx) {
          if (!state.active) return "HEXZ not active. Type /active first.";
          if (!isSafeInput(args.image_path)) return "Invalid image path.";
          return `[HEXZ Image] ${args.image_path}
Intent: ${args.intent ?? "auto"}
1. Describe what you see
2. Execute: replicate (UI), fix (error), code (diagram), build (mockup)`;
        },
      }),
      hexz_mkp: tool({
        get description() {
          return state.active
            ? "Install plugins & skills. Commands: 'list', 'remove:name', 'owner/repo', 'npm-pkg', 'skill:owner/repo', 'skill:name --content \"...\"'"
            : "[HEXZ OFF] Activate with /active first.";
        },
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
    },
  };
};
export default HexzPlugin;
