import { tool } from "@opencode-ai/plugin";
var state = {
  active: false,
  lastUserMessage: "",
  startTime: Date.now(),
  searches: 0,
  builds: 0
};
function sanitize(input) {
  return input.replace(/[<>"'`;|&$(){}]/g, "").trim().slice(0, 500);
}
function isSafe(input) {
  return !/[;&|`$(){}<>]/.test(input);
}
function getMessageText(parts) {
  for (const p of parts) {
    if ("text" in p && typeof p.text === "string")
      return p.text;
  }
  return "";
}
async function webSearch(query) {
  const q = sanitize(query);
  if (!q)
    return "Empty query";
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const ac = new AbortController;
    const t = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok)
      return `API ${res.status}`;
    const d = await res.json();
    const items = (d.RelatedTopics ?? []).filter((t2) => t2.Text?.length > 10).slice(0, 5).map((t2) => `• ${t2.Text}`);
    return items.length ? items.join(`
`) : "No results.";
  } catch (e) {
    return e?.name === "AbortError" ? "Timeout" : "Search failed";
  }
}
function guessTopic(cmd) {
  const l = cmd.toLowerCase();
  const y = new Date().getFullYear();
  const tech = {
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
    go: "Go golang",
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
    rest: "REST API",
    grpc: "gRPC",
    websocket: "WebSocket",
    jwt: "JWT",
    oauth: "OAuth2",
    api: "API design",
    auth: "authentication",
    testing: "testing",
    deploy: "deployment",
    cicd: "CI/CD",
    frontend: "frontend",
    backend: "backend",
    fullstack: "fullstack"
  };
  for (const [k, v] of Object.entries(tech)) {
    if (l.includes(k))
      return `${v} best practices ${y}`;
  }
  return state.lastUserMessage.slice(0, 80) || "web development";
}
var BUILD_PATTERNS = [
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
  "npm run dev",
  "npm run build",
  "npm start"
];
function isBuild(cmd) {
  const l = cmd.toLowerCase();
  return BUILD_PATTERNS.some((p) => l.includes(p));
}
var SYSTEM_PROMPT = `
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
hexz_mkp: Install plugins. "owner/repo" or "npm-package".
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
var CONTEXT_PRESERVE = `
## HEXZ Active
Personality: Senior engineer, no fluff, ships code.
Workflow: search → plan → build → review → test.
Active since: ${new Date(state.startTime).toISOString()}
`.trim();
var HexzPlugin = async ({ client, $, directory }) => {
  client.app.log?.({
    body: { service: "hexz", level: "info", message: "Loaded v1.2.0", extra: {} }
  });
  return {
    "chat.message": async (_input, output) => {
      const text = getMessageText(output.parts);
      state.lastUserMessage = text;
      if (text.includes("HEXZ_ACTIVATE") || text.toLowerCase().includes("engage hexz")) {
        state.active = true;
        for (const part of output.parts) {
          if ("text" in part)
            part.text = "[HEXZ] Active. Senior engineer mode.";
        }
        return;
      }
      if (text.includes("HEXZ_DEACTIVATE") || text.toLowerCase().includes("revert to default")) {
        state.active = false;
        for (const part of output.parts) {
          if ("text" in part)
            part.text = "[HEXZ] Off.";
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
    "tool.execute.before": async (input, output) => {
      if (!state.active)
        return;
      if (input.tool !== "Bash" && input.tool !== "Write")
        return;
      const args = JSON.stringify(output.args ?? "");
      if (!isBuild(args))
        return;
      state.searches++;
      const topic = guessTopic(args);
      let result = `[HEXZ] Researching: "${topic}"

`;
      try {
        result += (await webSearch(topic)).slice(0, 1200);
      } catch {
        result += "Search unavailable";
      }
      result += `

[HEXZ] Use the above to inform your build. Then proceed.`;
      throw new Error(result);
    },
    tool: {
      hexz_search: tool({
        get description() {
          return state.active ? "Web search via DuckDuckGo. Use before building code. Finds latest docs, API changes, breaking changes, best practices." : "[HEXZ OFF] Activate with /active first.";
        },
        args: { query: tool.schema.string() },
        async execute(args, _ctx) {
          if (!state.active)
            return "HEXZ not active. Type /active first.";
          state.searches++;
          return await webSearch(args.query);
        }
      }),
      hexz_scan: tool({
        get description() {
          return state.active ? "Security audit: injection, XSS, secrets, deps, data flow, auth, crypto. CVSS v3.1 per finding." : "[HEXZ OFF] Activate with /active first.";
        },
        args: {
          target: tool.schema.string(),
          mode: tool.schema.string().optional()
        },
        async execute(args, _ctx) {
          if (!state.active)
            return "HEXZ not active. Type /active first.";
          const m = args.mode ?? "full";
          const modules = {
            full: ["static", "deps", "data-flow", "arch", "blind-spots", "crypto", "auth"],
            quick: ["static", "deps"],
            deps: ["deps"]
          };
          return `[HEXZ Scan] ${args.target} (${m})
Modules: ${(modules[m] ?? modules.full).join(", ")}
Format: [CVSS v3.1] File:Line | Vector | Impact | Fix`;
        }
      }),
      hexz_design: tool({
        get description() {
          return state.active ? "Generate design scaffold as single HTML. Surfaces: web, mobile, dashboard, deck, email." : "[HEXZ OFF] Activate with /active first.";
        },
        args: {
          surface: tool.schema.string(),
          brief: tool.schema.string(),
          design_system: tool.schema.string().optional()
        },
        async execute(args, _ctx) {
          if (!state.active)
            return "HEXZ not active. Type /active first.";
          const specs = {
            web: "1440px single page",
            mobile: "375x812 iPhone frame",
            dashboard: "sidebar + KPI cards",
            deck: "1280x720 slides",
            email: "600px table layout"
          };
          return `[HEXZ Design]
Surface: ${specs[args.surface] ?? args.surface}
Brief: ${args.brief}
Output: single HTML, no external deps
Style: monochrome-flat (bg:#000 fg:#FFF accent:#E0E0E0)`;
        }
      }),
      hexz_image: tool({
        get description() {
          return state.active ? "Analyze images: UI screenshot, error, diagram, mockup. Describe and execute." : "[HEXZ OFF] Activate with /active first.";
        },
        args: {
          image_path: tool.schema.string(),
          intent: tool.schema.string().optional()
        },
        async execute(args, _ctx) {
          if (!state.active)
            return "HEXZ not active. Type /active first.";
          return `[HEXZ Image] ${args.image_path}
Intent: ${args.intent ?? "auto"}
1. Describe what you see
2. Execute: replicate (UI), fix (error), code (diagram), build (mockup)`;
        }
      }),
      hexz_mkp: tool({
        get description() {
          return state.active ? "Install opencode plugin. 'owner/repo' from GitHub or 'npm-name' via bun." : "[HEXZ OFF] Activate with /active first.";
        },
        args: { target: tool.schema.string() },
        async execute(args, ctx) {
          if (!state.active)
            return "HEXZ not active. Type /active first.";
          const t = sanitize(args.target);
          if (!t || !isSafe(t))
            return "Invalid target";
          try {
            if (t.includes("/")) {
              const [owner, repo] = t.split("/").map((s) => s.replace(/[^a-zA-Z0-9._-]/g, ""));
              if (!owner || !repo)
                return "Use owner/repo format";
              await $`git clone https://github.com/${owner}/${repo}.git ${ctx.directory}/.opencode/plugins/${repo} --depth 1`;
              return `Installed ${owner}/${repo}. Restart opencode.`;
            }
            if (!/^[a-zA-Z0-9@._-]+$/.test(t))
              return "Invalid package name";
            await $`bun add ${t} --cwd ${ctx.directory}`;
            return `Installed ${t}. Add to opencode.json, restart.`;
          } catch (e) {
            return `Failed: ${e?.message}`;
          }
        }
      }),
      hexz_status: tool({
        description: "Show HEXZ status: active/inactive, uptime, search count.",
        args: {},
        async execute() {
          const up = Math.floor((Date.now() - state.startTime) / 1000);
          return `HEXZ: ${state.active ? "ON" : "OFF"} | ${Math.floor(up / 60)}m${up % 60}s | ${state.searches} searches`;
        }
      })
    }
  };
};
var hexz_default = HexzPlugin;
export {
  hexz_default as default,
  HexzPlugin
};
