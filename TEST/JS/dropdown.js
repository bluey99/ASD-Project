function setupTasksDropdown() {
  const panel = document.getElementById("panel");

  const viewBtn = document.querySelector('button[data-action="viewTasks"]');
  const addBtn = document.querySelector('button[data-action="addTask"]');

  if (!viewBtn || !addBtn) return;

  viewBtn.addEventListener("click", () => {
    renderTasksTable();
  });

  addBtn.addEventListener("click", () => {
    renderAddTaskForm();
  });
}
