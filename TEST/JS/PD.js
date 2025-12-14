// ==============================
// Patient Dashboard Main Script
// ==============================

// When page loads
window.addEventListener("DOMContentLoaded", () => {
  
  // Activate dropdown behavior
  if (typeof setupTasksDropdown === "function") {
    setupTasksDropdown();
  }

  // Default tab is overview
  const panel = document.getElementById("panel");
  panel.innerHTML = "overview";

  // Tabs switching for overview, reports, feedbacks
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {

      const selected = tab.dataset.tab;

      // If tasks tab clicked → DO NOTHING (dropdown handles it)
      if (selected === "tasks") return;

      // Change the content based on the selected tab
      switch (selected) {
        case "overview":
          panel.innerHTML = "overview";
          break;

        case "reports":
          panel.innerHTML = "reports";
          break;

        case "feedbacks":
          panel.innerHTML = "feedbacks";
          break;
      }

      // Update active class visually
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });
});
