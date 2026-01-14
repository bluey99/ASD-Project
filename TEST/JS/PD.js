// ../JS/PD.js
// Loads overview/tasks/reports/feedback into #panel reliably
// Uses partial HTML + fresh module imports (prevents caching issues)

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel");
  if (!panel) return;

  const tabs = Array.from(document.querySelectorAll(".tab"));

  // ✅ one single importFresh (no duplicates)
  function importFresh(modulePath) {
    return import(`${modulePath}?v=${Date.now()}`);
  }

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

  function clearSectionGlobals() {
    delete window.__TASKS_MODE__;
    delete window.__FEEDBACK_MODE__;
  }

  // ✅ run dot update without loading the tab UI
  async function refreshTabDots() {
    const tasksDot = document.getElementById("tasksDot");
    const reportsDot = document.getElementById("reportsDot");

    // if dots not in DOM, do nothing
    if (!tasksDot && !reportsDot) return;

    try {
      const [tmod, rmod] = await Promise.all([
        importFresh("../JS/tasks.js"),
        importFresh("../JS/reports.js"),
      ]);

      if (tmod?.refreshTasksDot) await tmod.refreshTasksDot();
      if (rmod?.refreshReportsDot) await rmod.refreshReportsDot();
    } catch (e) {
      console.warn("refreshTabDots failed:", e);
    }
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

  async function showTasksView() {
    clearSectionGlobals();
    setActiveTab("tasks");
    window.__TASKS_MODE__ = "view";

    panel.innerHTML = `<div id="tasksRoot" style="height:100%"></div>`;

    const mod = await importFresh("../JS/tasks.js");
    if (mod?.initTasks) await mod.initTasks("view");
  }

  async function showFeedbacks() {
    clearSectionGlobals();
    setActiveTab("feedbacks");

    await loadPartial("../HTML/feedback.html");
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

        // ✅ after any tab open, refresh dots again
        await refreshTabDots();
      } catch (e) {
        console.error(e);
        panel.textContent = "Something went wrong loading this section.";
      }
    });
  });

  // ✅ IMPORTANT: refresh dots immediately on load (no tab click)
  refreshTabDots();

  // default
  showOverview();
});
