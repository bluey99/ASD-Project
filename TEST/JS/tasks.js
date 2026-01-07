// TEST/JS/tasks.js (MODULE)

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ============================
   Helpers: URL params
=============================== */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const childId = getParam("childId");          // required
const parentId = getParam("parentId") || "parent1";  // optional, fallback

/* ============================
   Mood dictionary (keep your filter logic)
=============================== */
const positiveMoods = ["happy", "excited", "calm", "relaxed", "proud"];
const negativeMoods = ["sad", "angry", "anxious", "scared", "upset"];

/* ============================
   Parse date for sorting filters (dd/mm/yyyy)
=============================== */
function parseTaskDate(dateStr) {
  if (!dateStr) return new Date(0);

  if (dateStr.includes("-")) return new Date(dateStr);

  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

/* ============================
   Tasks state
=============================== */
let tasks = [];

/* ============================
   Load tasks from Firestore
=============================== */
async function loadTasksFromFirestore() {
  if (!childId) {
    console.error("Missing childId in URL (PD.html?childId=...)");
    tasks = [];
    return;
  }

  try {
    // ✅ NO orderBy -> no index required
    const q = query(collection(db, "tasks"), where("childId", "==", childId));
    const snap = await getDocs(q);

    tasks = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.displayWhen || "--",
        title: d.taskName || "--",
        assignedBy: d.assignedBy || "me",
        status: d.status || "pending",
        mood: d.mood || "--",
        intensity: d.intensity || "--",
        note: d.discussionPrompts || "--"
      };
    });

    console.log("Loaded tasks ✅", tasks);
  } catch (err) {
    console.error("Failed to load tasks ❌", err);
    tasks = [];
  }
}

/* ============================
   Render tasks table
=============================== */
function renderTasksTable(filteredList = null) {
  const panel = document.getElementById("panel");
  const taskList = filteredList || tasks;

  let html = `
    <h2>Tasks</h2>

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
   Filter menu
=============================== */
function setupFilterMenu() {
  const btn = document.getElementById("filterBtn");
  const menu = document.getElementById("filterMenu");
  if (!btn || !menu) return;

  btn.addEventListener("click", () => menu.classList.toggle("show"));

  menu.addEventListener("click", e => {
    if (!e.target.dataset.filter) return;
    applyFilter(e.target.dataset.filter);
    menu.classList.remove("show");
  });
}

function applyFilter(type) {
  let filtered = [...tasks];

  switch (type) {
    case "date-asc":
      filtered.sort((a, b) => parseTaskDate(a.date) - parseTaskDate(b.date));
      break;
    case "date-desc":
      filtered.sort((a, b) => parseTaskDate(b.date) - parseTaskDate(a.date));
      break;
    case "status-pending":
      filtered = filtered.filter(t => t.status === "pending");
      break;
    case "status-done":
      filtered = filtered.filter(t => t.status === "done");
      break;
    case "assigned-me":
      filtered = filtered.filter(t => t.assignedBy === "me");
      break;
    case "assigned-parent":
      filtered = filtered.filter(t => t.assignedBy === "parent");
      break;
    case "mood-positive":
      filtered = filtered.filter(t => positiveMoods.includes(t.mood));
      break;
    case "mood-negative":
      filtered = filtered.filter(t => negativeMoods.includes(t.mood));
      break;
    case "reset":
      renderTasksTable();
      return;
  }

  renderTasksTable(filtered);
}

/* ============================
   Add task form + confirmation
=============================== */
function renderAddTaskForm() {
  const panel = document.getElementById("panel");

  panel.innerHTML = `
    <div class="add-task-container">
      <h2>Add a task</h2>

      <form class="add-task-form" id="taskForm">
        <input type="text" id="taskTitle" placeholder="title" required />
        <input type="text" id="taskPlace" placeholder="place" required />
        <input type="date" id="taskDate" required />
        <textarea id="taskDesc" placeholder="description" required></textarea>
        <button type="submit">Add</button>
      </form>
    </div>
  `;

  document.getElementById("taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate required fields
    const title = document.getElementById("taskTitle").value.trim();
    const place = document.getElementById("taskPlace").value.trim();
    const rawDate = document.getElementById("taskDate").value;
    const desc = document.getElementById("taskDesc").value.trim();

    if (!title || !place || !rawDate || !desc) {
      alert("Please fill all fields.");
      return;
    }

    if (!childId) {
      alert("Missing childId. Go back and select a child again.");
      return;
    }

    // convert date to dd/mm/yyyy
    let displayWhen = rawDate;
    if (rawDate.includes("-")) {
      const [y, m, d] = rawDate.split("-");
      displayWhen = `${Number(d)}/${Number(m)}/${y}`;
    }

    // Build confirmation text
    const summary =
      `Confirm adding this task?\n\n` +
      `childId: ${childId}\n` +
      `parentId: ${parentId}\n` +
      `createdAt: ${new Date().toLocaleString()}\n\n` +
      `taskName (title): ${title}\n` +
      `displayWhere (place): ${place}\n` +
      `displayWhen (date): ${displayWhen}\n` +
      `discussionPrompts (description): ${desc}\n`;

    const ok = window.confirm(summary);
    if (!ok) return;

    try {
      // ✅ Save to Firestore EXACT field names you requested
      await addDoc(collection(db, "tasks"), {
        childId: childId,
        parentId: parentId,
        createdAt: Date.now(),               // number timestamp like your DB screenshot
        taskName: title,
        displayWhere: place,
        displayWhen: displayWhen,
        discussionPrompts: desc,
        assignedBy: "me",
        status: "pending",
        mood: "--",
        intensity: "--"
      });

      alert("Task added ✅");

      // refresh table
      await loadTasksFromFirestore();
      renderTasksTable();

    } catch (err) {
      console.error("Failed to add task ❌", err);
      alert("Failed to add task. Check console.");
    }
  });
}

/* ============================
   Hook dropdown actions
   dropdown.js already shows menu,
   we only react to clicks on its buttons
=============================== */
function hookDropdownActions() {
  document.addEventListener("click", async (e) => {
    const action = e.target?.dataset?.action;
    if (!action) return;

    if (action === "viewTasks") {
      await loadTasksFromFirestore();
      renderTasksTable();
    }

    if (action === "addTask") {
      renderAddTaskForm();
    }
  });
}

/* ============================
   INIT
=============================== */
document.addEventListener("DOMContentLoaded", async () => {
  hookDropdownActions();

  // default: show overview remains handled in PD.js
  // but if user directly opens tasks dropdown -> it will load correctly
});
