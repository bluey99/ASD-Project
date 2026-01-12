// ../JS/PD.js
// Loads overview/tasks/reports/feedback into #panel reliably
// Uses partial HTML + fresh module imports (prevents caching issues)

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel");
  if (!panel) return;

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
    delete window.__TASKS_MODE__;
    delete window.__FEEDBACK_MODE__;
  }

  // ---------- section loaders ----------
  async function showOverview() {
    clearSectionGlobals();
    setActiveTab("overview");
    await loadPartial("../HTML/overview.html");

    const mod = await importFresh("../JS/overview.js");
    if (mod?.initOverview) await mod.initOverview();
  }

  async function showReports() {
    clearSectionGlobals();
    setActiveTab("reports");
    await loadPartial("../HTML/reports.html");

    const mod = await importFresh("../JS/reports.js");
    if (mod?.initReports) await mod.initReports();
  }

  // --- TASKS ---
  async function showTasksView() {
    clearSectionGlobals();
    setActiveTab("tasks");
    window.__TASKS_MODE__ = "view";

    panel.innerHTML = `<div id="tasksRoot" style="height:100%"></div>`;

    const mod = await importFresh("../JS/tasks.js");
    if (mod?.initTasks) await mod.initTasks("view");
  }


  // --- FEEDBACKS ---
  async function showFeedbacks() {
  clearSectionGlobals();
  setActiveTab("feedbacks");

  await loadPartial("../HTML/feedback.html"); // <-- make sure path is correct
  const mod = await importFresh("../JS/feedback.js");
  if (mod?.initFeedbacks) await mod.initFeedbacks("view");
}


  // ---------- tab click handling ----------
  tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      const tabName = tab.dataset.tab;

      try {
        if (tabName === "overview") await showOverview();
        else if (tabName === "reports") await showReports();
        else if (tabName === "tasks") await showTasksView();
        else if (tabName === "feedbacks") await showFeedbacks();
      } catch (e) {
        console.error(e);
        panel.textContent = "Something went wrong loading this section.";
      }
    });
  });

  // default
  showOverview();
});
