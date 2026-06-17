const ICONS = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  scan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  design: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  package: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  status: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
};

const data = {
  stats: [
    { value: "7", label: "Security Modules" },
    { value: "150", label: "Design Systems" },
    { value: "109", label: "Templates" },
  ],
  features: [
    {
      icon: "search",
      name: "hexz_search",
      desc: "Web search before every build. Latest docs, APIs, gotchas.",
    },
    {
      icon: "scan",
      name: "hexz_scan",
      desc: "7-module security audit. CVSS v3.1 scoring. Catches secrets, XSS, injections.",
    },
    {
      icon: "design",
      name: "hexz_design",
      desc: "HTML/CSS mockups with typography, color, anti-slop craft rules.",
    },
    {
      icon: "image",
      name: "hexz_image",
      desc: "Read screenshots, error dialogs, diagrams. Describe and execute.",
    },
    {
      icon: "package",
      name: "hexz_mkp",
      desc: "Plugin and skill marketplace. Install, list, remove in one command.",
    },
    {
      icon: "status",
      name: "hexz_status",
      desc: "HEXZ health check: active, uptime, search count, cache size.",
    },
  ],
  commands: [
    { name: "hexz_search", desc: "Search web for latest docs" },
    { name: "hexz_scan", desc: "Security audit with CVSS scores" },
    { name: "hexz_design", desc: "Generate design scaffolds" },
    { name: "hexz_image", desc: "Analyze screenshots and diagrams" },
    { name: "hexz_mkp", desc: "Plugin marketplace manager" },
    { name: "hexz_status", desc: "Check HEXZ system health" },
  ],
  workflow: [
    { name: "Research", desc: "hexz_search() before writing code" },
    { name: "Plan", desc: "Architecture, data flow, routes, errors" },
    { name: "Build", desc: "Production code with error handling" },
    { name: "Review", desc: "Self-review for bugs and secrets" },
    { name: "Test", desc: "Run the app, check crashes, confirm" },
  ],
};

const terminalCmds = [
  { cmd: "hexz_status --json", output: '{ "active": true, "version": "2.0.0", "uptime": "0m42s" }', cls: "terminal__output" },
  { cmd: "hexz_scan . --mode=injection", output: "[PASS] No injection vulnerabilities found", cls: "terminal__output--success" },
  { cmd: "hexz_design --brief='landing page' --save=out.html", output: "Generated: out.html (23kb, 0.4s)", cls: "terminal__output--success" },
  { cmd: "hexz_mkp list", output: "6 plugins installed, 3 skills loaded", cls: "terminal__output" },
];

const routeData = {
  enabled: true,
  routes: [
    { model: "gpt-4o", keywords: "design,ui,mockup" },
    { model: "claude-3-opus", keywords: "code,review,architecture" },
    { model: "deepseek-v4", keywords: "search,research,plan" },
  ],
};

function renderStats(container) {
  container.innerHTML = data.stats
    .map(
      (s) =>
        `<div class="stats__item">
          <div class="stats__value" data-count="${s.value}">0</div>
          <div class="stats__label">${s.label}</div>
        </div>`
    )
    .join("");
}

function renderFeatures(container) {
  container.innerHTML = data.features
    .map(
      (f) =>
        `<div class="feature reveal">
          <span class="feature__icon">${ICONS[f.icon]}</span>
          <div class="feature__name">${f.name}</div>
          <div class="feature__desc">${f.desc}</div>
        </div>`
    )
    .join("");
}

function renderCommands(container) {
  container.innerHTML = data.commands
    .map(
      (c) =>
        `<div class="command">
          <span class="command__prefix">/</span>
          <span class="command__name">${c.name}</span>
          <span class="command__desc">${c.desc}</span>
        </div>`
    )
    .join("");
}

function renderWorkflow(container) {
  container.innerHTML = data.workflow
    .map(
      (w, i) =>
        `<div class="workflow__step reveal">
          <div class="workflow__step-num">${i + 1}</div>
          <div class="workflow__step-name">${w.name}</div>
          <div class="workflow__step-desc">${w.desc}</div>
        </div>`
    )
    .join("");
}

function animateCounters() {
  document.querySelectorAll(".stats__value[data-count]").forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 600;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(progress * target);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(update);
      else el.classList.add("counted");
    }

    requestAnimationFrame(update);
  });
}

function observeReveals() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

function renderRoutes() {
  const statusEl = document.getElementById("routesStatus");
  const listEl = document.getElementById("routesList");
  const actionsEl = document.getElementById("routesActions");
  if (!statusEl || !listEl || !actionsEl) return;

  const statusClass = routeData.enabled ? "routes__status--on" : "routes__status--off";
  const statusText = routeData.enabled ? "Routing ON" : "Routing OFF";
  statusEl.innerHTML = `
    <div class="routes__indicator ${statusClass}">
      <span class="routes__dot"></span>
      <span>${statusText}</span>
      <span class="routes__count">${routeData.routes.length} route${routeData.routes.length !== 1 ? 's' : ''}</span>
    </div>
  `;

  if (routeData.routes.length === 0) {
    listEl.innerHTML = `<div class="routes__empty">No routes configured. Add a route below.</div>`;
  } else {
    listEl.innerHTML = routeData.routes.map((r, i) => `
      <div class="routes__route">
        <span class="routes__route-idx">${i + 1}</span>
        <span class="routes__route-model">${r.model}</span>
        <span class="routes__route-arrow">→</span>
        <span class="routes__route-kw">${r.keywords}</span>
      </div>
    `).join("");
  }

  actionsEl.innerHTML = `
    <button class="btn btn--secondary route-btn" data-action="toggle">
      ${routeData.enabled ? "Disable" : "Enable"} Routing
    </button>
    <button class="btn btn--primary route-btn" data-action="add">
      Add Route
    </button>
  `;

  actionsEl.querySelectorAll(".route-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "toggle") {
        routeData.enabled = !routeData.enabled;
        renderRoutes();
      } else if (action === "add") {
        const model = prompt("Model name (e.g. gpt-4o):");
        if (!model) return;
        const keywords = prompt("Task keywords (comma-separated):");
        if (!keywords) return;
        routeData.routes.push({ model: model.trim(), keywords: keywords.trim() });
        renderRoutes();
      }
    });
  });
}

function runTerminalDemo() {
  const body = document.getElementById("terminalBody");
  const cursorLine = body?.querySelector(".terminal__cursor-line");
  if (!body || !cursorLine) return;

  let cmdIndex = 0;

  function typeCommand(cmd, output, outputCls, callback) {
    const line = document.createElement("div");
    line.className = "terminal__line";
    line.innerHTML = `<span class="terminal__prompt">$</span> <span class="terminal__cmd"></span>`;
    const cmdSpan = line.querySelector(".terminal__cmd");
    body.insertBefore(line, cursorLine);

    let charIndex = 0;
    function typeChar() {
      if (charIndex < cmd.length) {
        cmdSpan.textContent += cmd[charIndex];
        charIndex++;
        setTimeout(typeChar, 30 + Math.random() * 20);
      } else {
        setTimeout(() => {
          const outLine = document.createElement("div");
          outLine.className = `terminal__line ${outputCls}`;
          outLine.innerHTML = output;
          body.insertBefore(outLine, cursorLine);
          callback();
        }, 200);
      }
    }
    typeChar();
  }

  function nextCmd() {
    if (cmdIndex >= terminalCmds.length) {
      setTimeout(() => {
        const resetLine = document.createElement("div");
        resetLine.className = "terminal__line";
        resetLine.innerHTML = `<span class="terminal__prompt">$</span> <span class="terminal__cmd" style="color:var(--muted)"># session ready</span>`;
        body.insertBefore(resetLine, cursorLine);
      }, 800);
      return;
    }
    const { cmd, output, cls } = terminalCmds[cmdIndex];
    cmdIndex++;
    typeCommand(cmd, output, cls, nextCmd);
  }

  setTimeout(nextCmd, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  const stats = document.getElementById("stats");
  const features = document.getElementById("features");
  const commands = document.getElementById("commandsGrid");
  const workflow = document.getElementById("workflowSteps");

  if (stats) {
    renderStats(stats);
    const statsObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounters();
            statsObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    statsObs.observe(stats);
  }
  if (features) renderFeatures(features);
  if (commands) renderCommands(commands);
  if (workflow) renderWorkflow(workflow);
  renderRoutes();

  observeReveals();
  runTerminalDemo();
});

// Route section navigable via #models hash
// The /route command is registered via the server plugin
