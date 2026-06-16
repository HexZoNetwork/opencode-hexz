const data = {
  stats: [
    { value: "7", label: "Security Modules" },
    { value: "150", label: "Design Systems" },
    { value: "109", label: "Templates" },
  ],
  features: [
    {
      icon: "\u{1F50D}",
      name: "hexz_search",
      desc: "Web search before every build. Latest docs, APIs, gotchas.",
    },
    {
      icon: "\u{1F6E1}\uFE0F",
      name: "hexz_scan",
      desc: "7-module security audit. CVSS v3.1 scoring. Catches secrets, XSS, injections.",
    },
    {
      icon: "\u{1F3A8}",
      name: "hexz_design",
      desc: "HTML/CSS mockups with typography, color, anti-slop craft rules.",
    },
    {
      icon: "\u{1F5BC}\uFE0F",
      name: "hexz_image",
      desc: "Read screenshots, error dialogs, diagrams. Describe and execute.",
    },
    {
      icon: "\u{1F4E6}",
      name: "hexz_mkp",
      desc: "Plugin and skill marketplace. Install, list, remove in one command.",
    },
    {
      icon: "\u2699\uFE0F",
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

function renderStats(container) {
  container.innerHTML = data.stats
    .map(
      (s) =>
        `<div class="stats__item">
          <div class="stats__value">${s.value}</div>
          <div class="stats__label">${s.label}</div>
        </div>`
    )
    .join("");
}

function renderFeatures(container) {
  container.innerHTML = data.features
    .map(
      (f) =>
        `<div class="feature">
          <span class="feature__icon">${f.icon}</span>
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
        `<div class="workflow__step">
          <div class="workflow__step-num">${i + 1}</div>
          <div class="workflow__step-name">${w.name}</div>
          <div class="workflow__step-desc">${w.desc}</div>
        </div>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const stats = document.getElementById("stats");
  const features = document.getElementById("features");
  const commands = document.getElementById("commandsGrid");
  const workflow = document.getElementById("workflowSteps");

  if (stats) renderStats(stats);
  if (features) renderFeatures(features);
  if (commands) renderCommands(commands);
  if (workflow) renderWorkflow(workflow);
});
