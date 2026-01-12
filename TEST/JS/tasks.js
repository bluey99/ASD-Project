// ../JS/tasks.js (MODULE) — Tasks (view + add) — NO place field + NO browser history

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getActiveChildId() {
  return getParam("childId") || localStorage.getItem("selectedChildId") || null;
}

function getActiveParentId() {
  return getParam("parentId") || "parent1";
}

function getTherapistId() {
  const direct = localStorage.getItem("therapistId");
  if (direct) return direct;

  const raw = localStorage.getItem("moodiTherapist");
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj?.docId) return obj.docId;
    } catch {}
  }
  return null;
}

/* ---------- state ---------- */
let tasksRows = [];
let isBound = false;

function getRoot() {
  return document.getElementById("tasksRoot") || document.getElementById("panel");
}

function parseTaskDate(dateStr) {
  if (!dateStr) return new Date(0);
  if (dateStr.includes("-")) return new Date(dateStr); // yyyy-mm-dd
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

async function fetchTasks(childId) {
  const q = query(collection(db, "tasks"), where("childId", "==", childId));
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    rows.push({
      id: docSnap.id,
      date: d.displayWhen || "",
      title: d.taskName || "",
      assignedBy: d.assignedBy || "me",
      status: d.status || "pending",
      mood: d.mood || "--",
      intensity: d.intensity || "--",
      note: d.discussionPrompts || "",
      _dateObj: parseTaskDate(d.displayWhen || ""),
    });
  });
  return rows;
}

/* ---------- layout HTML ---------- */
function renderShell() {
  const root = getRoot();
  if (!root) return;

  root.innerHTML = `
    <section class="tk-page">
      <div class="tk-header">
        <div>
          <h2 class="tk-title">Tasks</h2>
          <p class="tk-subtitle" id="tkSubtitle">Loading…</p>
        </div>

        <div class="tk-actions">
          <button class="btn-primary" id="tkAddBtn" type="button">Add task</button>
        </div>
      </div>

      <div class="tk-filters" id="tkFilters">
        <div class="tk-field">
          <label class="tk-label">Sort</label>
          <select id="tkSort" class="tk-select">
            <option value="desc" selected>Newest → Oldest</option>
            <option value="asc">Oldest → Newest</option>
          </select>
        </div>

        <div class="tk-field">
          <label class="tk-label">Filter by status</label>
          <select id="tkStatus" class="tk-select">
            <option value="" selected>All</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <!-- LIST -->
      <div id="tkListView" class="tk-card">
        <div class="tk-table-wrap">
          <table class="tk-table">
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
            <tbody id="tkTbody">
              <tr><td colspan="7" class="tk-empty">Loading tasks…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- FORM -->
      <div id="tkFormView" class="tk-card tk-form hidden">
        <h3 class="tk-form-title">Add a task</h3>

        <!-- autocomplete off to stop browser history suggestions -->
        <form id="tkForm" class="tk-form-grid" autocomplete="off">
          <div class="tk-field">
            <label class="tk-label">title</label>
            <input
              id="tkTitle"
              class="tk-input"
              type="text"
              placeholder="e.g., breathing exercise"
              required
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              name="tkTitle_nohistory"
            />
          </div>

          <div class="tk-row">
            <div class="tk-field">
              <label class="tk-label">date</label>
              <input
                id="tkDate"
                class="tk-input"
                type="date"
                required
                autocomplete="off"
                name="tkDate_nohistory"
              />
            </div>
          </div>

          <div class="tk-field">
            <label class="tk-label">description</label>
            <textarea
              id="tkDesc"
              class="tk-textarea"
              rows="6"
              placeholder="Write what the child should do..."
              required
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              name="tkDesc_nohistory"
            ></textarea>
          </div>

          <div class="tk-buttons">
            <button class="btn-primary" type="submit">Save</button>
            <button class="btn-lite" id="tkCancelBtn" type="button">Cancel</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

/* ---------- render table ---------- */
function renderTable() {
  const tbody = $("tkTbody");
  const subtitle = $("tkSubtitle");
  const sortSel = $("tkSort");
  const statusSel = $("tkStatus");

  if (!tbody) return;

  let list = [...tasksRows];

  // filter
  const status = statusSel?.value || "";
  if (status) list = list.filter((t) => (t.status || "").toLowerCase() === status);

  // sort
  const dir = sortSel?.value || "desc";
  list.sort((a, b) => (dir === "asc" ? a._dateObj - b._dateObj : b._dateObj - a._dateObj));

  if (subtitle) subtitle.textContent = `${list.length} task(s) found.`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="tk-empty">No tasks found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((t) => {
      const dotClass = (t.status || "").toLowerCase() === "done" ? "status-done" : "status-pending";
      return `
        <tr>
          <td>${t.date || "—"}</td>
          <td>${t.title || "—"}</td>
          <td>${t.assignedBy || "—"}</td>
          <td><span class="status-dot ${dotClass}"></span>${t.status || "—"}</td>
          <td>${t.mood || "—"}</td>
          <td>${t.intensity || "—"}</td>
          <td>${t.note || "—"}</td>
        </tr>
      `;
    })
    .join("");
}

/* ---------- view switching ---------- */
function showList() {
  $("tkListView")?.classList.remove("hidden");
  $("tkFormView")?.classList.add("hidden");
  $("tkFilters")?.classList.remove("hidden");
}

function showForm() {
  $("tkListView")?.classList.add("hidden");
  $("tkFormView")?.classList.remove("hidden");
  $("tkFilters")?.classList.add("hidden");

  // optional: reset to avoid old values sticking around
  $("tkForm")?.reset();
}

/* ---------- load + bind ---------- */
async function loadAndRender() {
  const childId = getActiveChildId();
  const subtitle = $("tkSubtitle");
  const tbody = $("tkTbody");

  if (!childId) {
    if (subtitle) subtitle.textContent = "Missing childId. Open patient using ?childId=...";
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="tk-empty">Missing childId.</td></tr>`;
    return;
  }

  if (subtitle) subtitle.textContent = "Loading…";
  tasksRows = await fetchTasks(childId);
  renderTable();
}

function bindUIOnce() {
  if (isBound) return;
  isBound = true;

  $("tkAddBtn")?.addEventListener("click", showForm);
  $("tkCancelBtn")?.addEventListener("click", showList);

  $("tkSort")?.addEventListener("change", renderTable);
  $("tkStatus")?.addEventListener("change", renderTable);

  $("tkForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const childId = getActiveChildId();
    const parentId = getActiveParentId();
    const therapistId = getTherapistId();

    if (!therapistId) {
      alert("You must be logged in as a therapist.");
      window.location.href = "login.html";
      return;
    }

    const title = $("tkTitle")?.value.trim();
    const rawDate = $("tkDate")?.value; // yyyy-mm-dd
    const desc = $("tkDesc")?.value.trim();

    // ✅ only validate the fields you actually have
    if (!title || !rawDate || !desc) {
      alert("Please fill in all fields.");
      return;
    }

    // yyyy-mm-dd -> dd/mm/yyyy
    const [y, m, d] = rawDate.split("-");
    const displayWhen = `${Number(d)}/${Number(m)}/${y}`;

    await addDoc(collection(db, "tasks"), {
      childId,
      parentId,
      therapistID: therapistId,
      createdAt: serverTimestamp(),
      taskName: title,
      displayWhen,
      discussionPrompts: desc,
      assignedBy: "me",
      status: "pending",
      mood: "--",
      intensity: "--",
    });

    alert("Task added ✅");
    showList();
    await loadAndRender();
  });
}

/* ---------- exported init ---------- */
export async function initTasks(mode = "view") {
  isBound = false; // DOM recreated each time PD.js loads section
  renderShell();
  bindUIOnce();
  await loadAndRender();

  if (mode === "add") showForm();
  else showList();
}
