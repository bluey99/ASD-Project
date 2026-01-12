// ../JS/PD.js
// Loads overview/tasks/reports/feedback into #panel reliably
// Uses partial HTML + fresh module imports (prevents caching issues)

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel");
  if (!panel) return;

  // ---------- helpers ----------
  const tabs = Array.from(document.querySelectorAll(".tab"));

  function setActiveTab(tabName) {
    tabs.forEach((t) => t.classList.remove("active"));
    const target = tabs.find((t) => t.dataset.tab === tabName);
    if (target) target.classList.add("active");
  }

  async function loadPartial(htmlPath) {
    const res = await fetch(htmlPath);
    if (!res.ok) throw new Error(`Failed to load ${htmlPath}`);
    panel.innerHTML = await res.text();
  }

  // avoid module caching when switching tabs
  async function importFresh(modulePath) {
    return import(`${modulePath}?v=${Date.now()}`);
  }

  function clearSectionGlobals() {
    // optional: clear flags you may use in tasks/feedback scripts
    delete window.__TASKS_MODE__;
    delete window.__FEEDBACK_MODE__;
  }

  function loadScript(src) {
    // remove previous dynamic script (prevents duplicate handlers)
    const old = document.querySelector(`script[data-dyn="${src}"]`);
    if (old) old.remove();

    const s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.dataset.dyn = src;
    document.body.appendChild(s);
  }

  // ---------- section loaders ----------
  async function showOverview() {
    clearSectionGlobals();
    setActiveTab("overview");
    await loadPartial("../HTML/overview.html");

    // overview.js should export initOverview() OR just run on import
    const mod = await importFresh("../JS/overview.js");
    if (mod?.initOverview) await mod.initOverview();
  }

  async function showReports() {
    clearSectionGlobals();
    setActiveTab("reports");

    await loadPartial("../HTML/reports.html");

    // reports.js should export initReports()
    const mod = await importFresh("../JS/reports.js");
    if (mod?.initReports) await mod.initReports();
  }

  async function showTasksView() {
    clearSectionGlobals();
    setActiveTab("tasks");
    window.__TASKS_MODE__ = "view";

    panel.innerHTML = `
      <div style="padding:18px">
        <h2 style="margin:0 0 8px 0">Tasks</h2>
        <div id="tasksRoot"></div>
      </div>
    `;

    // tasks.js is a module and reads window.__TASKS_MODE__
    const mod = await importFresh("../JS/tasks.js");
    if (mod?.initTasks) await mod.initTasks();
  }

  async function showTasksAdd() {
    clearSectionGlobals();
    setActiveTab("tasks");
    window.__TASKS_MODE__ = "add";

    panel.innerHTML = `
      <div style="padding:18px">
        <h2 style="margin:0 0 8px 0">Add a task</h2>
        <div id="tasksRoot"></div>
      </div>
    `;

    const mod = await importFresh("../JS/tasks.js");
    if (mod?.initTasks) await mod.initTasks();
  }

  async function showFeedbacksView() {
    clearSectionGlobals();
    setActiveTab("feedbacks");
    window.__FEEDBACK_MODE__ = "view";

    panel.innerHTML = `
      <div style="padding:18px">
        <h2 style="margin:0 0 8px 0">Feedbacks</h2>
        <div id="feedbackRoot"></div>
      </div>
    `;

    // feedback.js is a normal script (not module)
    loadScript("../JS/feedback.js");
  }

  async function showFeedbacksAdd() {
    clearSectionGlobals();
    setActiveTab("feedbacks");
    window.__FEEDBACK_MODE__ = "add";

    panel.innerHTML = `
      <div style="padding:18px">
        <h2 style="margin:0 0 8px 0">Add feedback</h2>
        <div id="feedbackRoot"></div>
      </div>
    `;

    loadScript("../JS/feedback.js");
  }

  // ---------- tab click handling ----------
  tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      const tabName = tab.dataset.tab;

      try {
        if (tabName === "overview") await showOverview();
        else if (tabName === "reports") await showReports();
        else if (tabName === "tasks") await showTasksView(); // clicking "tasks ▾" defaults to view
        else if (tabName === "feedbacks") await showFeedbacksView(); // clicking "feedbacks ▾" defaults to view
      } catch (e) {
        console.error(e);
        panel.textContent = "Something went wrong loading this section.";
      }
    });
  });

  // ---------- dropdown actions ----------
  document.querySelectorAll(".dropdown-menu button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;

      try {
        if (action === "viewTasks") await showTasksView();
        else if (action === "addTask") await showTasksAdd();
        else if (action === "viewFeedbacks") await showFeedbacksView();
        else if (action === "addFeedback") await showFeedbacksAdd();
      } catch (err) {
        console.error(err);
        panel.textContent = "Failed to load section.";
      }
    });
  });

  // ---------- default ----------
  showOverview();
});
