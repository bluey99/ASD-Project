/* ============================
   MOOD DICTIONARY
=============================== */
const positiveMoods = ["happy", "excited", "calm", "relaxed", "proud"];
const negativeMoods = ["sad", "angry", "anxious", "scared", "upset"];

/* ============================
   HELPER: PARSE DATE (dd/mm/yyyy or yyyy-mm-dd)
=============================== */
function parseTaskDate(dateStr) {
  if (!dateStr) return 0;

  // ISO format: yyyy-mm-dd
  if (dateStr.includes("-")) {
    return new Date(dateStr);
  }

  // dd/mm/yyyy
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }

  // fallback
  return new Date(dateStr);
}

/* ============================
   RENDER TASKS TABLE
=============================== */
function renderTasksTable(filteredList = null) {
  const panel = document.getElementById("panel");
  const taskList = filteredList || tasks;

  let html = `
    <h2>Emily's Tasks</h2>

    <div class="filter-bar">
      <button id="filterBtn" class="filter-btn">Filter ⮟</button>

      <div id="filterMenu" class="filter-menu">
        <button data-filter="date-asc">Sort by Date ↑</button>
        <button data-filter="date-desc">Sort by Date ↓</button>
        <hr>
        <button data-filter="status-pending">Status: pending</button>
        <button data-filter="status-done">Status: done</button>
        <hr>
        <button data-filter="assigned-me">Assigned by: me</button>
        <button data-filter="assigned-parent">Assigned by: parent</button>
        <hr>
        <button data-filter="mood-positive">Mood: positive</button>
        <button data-filter="mood-negative">Mood: negative</button>
        <hr>
        <button data-filter="reset">Reset</button>
      </div>
    </div>

    <table class="tasks-table">
      <thead>
        <tr>
          <th>date</th>
          <th>title</th>
          <th>assigned by</th>
          <th>status</th>
          <th>mood</th>
          <th>intensity</th>
          <th>note</th>
        </tr>
      </thead>
      <tbody>
  `;

  taskList.forEach(t => {
    const dotClass = t.status === "done" ? "status-done" : "status-pending";

    html += `
      <tr>
        <td>${t.date}</td>
        <td>${t.title}</td>
        <td>${t.assignedBy}</td>
        <td><span class="status-dot ${dotClass}"></span>${t.status}</td>
        <td>${t.mood}</td>
        <td>${t.intensity}</td>
        <td>${t.note}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  panel.innerHTML = `<div class="tasks-container">${html}</div>`;

  setupFilterMenu();
}

/* ============================
   FILTER MENU LOGIC
=============================== */
function setupFilterMenu() {
  const btn = document.getElementById("filterBtn");
  const menu = document.getElementById("filterMenu");

  if (!btn || !menu) return;

  btn.addEventListener("click", () => {
    menu.classList.toggle("show");
  });

  menu.addEventListener("click", e => {
    if (!e.target.dataset.filter) return;
    applyFilter(e.target.dataset.filter);
    menu.classList.remove("show");
  });
}

/* ============================
   APPLY SORTING / FILTERS
=============================== */
function applyFilter(type) {
  let filtered = [...tasks];

  switch (type) {
    // SORTS
    case "date-asc":
      filtered.sort((a, b) => parseTaskDate(a.date) - parseTaskDate(b.date));
      break;

    case "date-desc":
      filtered.sort((a, b) => parseTaskDate(b.date) - parseTaskDate(a.date));
      break;

    // STATUS FILTERS
    case "status-pending":
      filtered = filtered.filter(t => t.status === "pending");
      break;

    case "status-done":
      filtered = filtered.filter(t => t.status === "done");
      break;

    // ASSIGNED BY FILTERS
    case "assigned-me":
      filtered = filtered.filter(t => t.assignedBy === "me");
      break;

    case "assigned-parent":
      filtered = filtered.filter(t => t.assignedBy === "parent");
      break;

    // MOOD FILTERS
    case "mood-positive":
      filtered = filtered.filter(t => positiveMoods.includes(t.mood));
      break;

    case "mood-negative":
      filtered = filtered.filter(t => negativeMoods.includes(t.mood));
      break;

    // RESET
    case "reset":
      renderTasksTable();
      return;
  }

  renderTasksTable(filtered);
}

/* ============================
   ADD TASK FORM
=============================== */
function renderAddTaskForm() {
  const panel = document.getElementById("panel");

  panel.innerHTML = `
    <div class="add-task-container">
      <h2>Add a mission for Emily</h2>

      <form class="add-task-form" id="taskForm">

        <input type="text" id="taskTitle" placeholder="title" required />

        <input type="text" id="taskPlace" placeholder="place" />

        <input type="date" id="taskDate" required />

        <textarea id="taskDesc" placeholder="description"></textarea>

        <button type="submit">Add</button>
      </form>
    </div>
  `;

  document.getElementById("taskForm").addEventListener("submit", e => {
    e.preventDefault();

    const rawDate = document.getElementById("taskDate").value; // yyyy-mm-dd
    let displayDate = rawDate;

    // Convert to dd/mm/yyyy for table display
    if (rawDate && rawDate.includes("-")) {
      const [y, m, d] = rawDate.split("-");
      displayDate = `${Number(d)}/${Number(m)}/${y}`;
    }

    const newTask = {
      date: displayDate,
      title: document.getElementById("taskTitle").value,
      assignedBy: "me",
      status: "pending",
      mood: "--",
      intensity: "--",
      note: document.getElementById("taskDesc").value || "--"
    };

    tasks.push(newTask);
localStorage.setItem("tasks", JSON.stringify(tasks));

renderTasksTable();
  });
}
