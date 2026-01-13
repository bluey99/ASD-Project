// ../JS/tasks.js — Tasks (view + add)
// ✅ Saves to Firestore "tasks" collection FIRST, then reloads and renders table.
// ✅ Matches your Firestore fields:
// childId (numeric string), creatorId, creatorType, taskName, discussionPrompts, displayWhen, status, createdAt

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getActiveChildDocId() {
  // child document id (used to read children/{docId})
  return getParam("childId") || localStorage.getItem("selectedChildId") || null;
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

// ✅ read numeric childID from children/{childDocId}
async function getChildNumericId(childDocId) {
  if (!childDocId) return null;
  try {
    const snap = await getDoc(doc(db, "children", childDocId));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    // your field is usually childID: "214578903"
    return data.childID || data.childId || null;
  } catch (e) {
    console.error("getChildNumericId error:", e);
    return null;
  }
}

/* ---------- state ---------- */
let tasksRows = [];
let isBound = false;

function getRoot() {
  return document.getElementById("tasksRoot") || document.getElementById("panel");
}

function parseTaskDate(displayWhen) {
  if (!displayWhen) return new Date(0);
  const s = String(displayWhen).trim();

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s);

  // dd/mm/yyyy or d/m/yyyy with optional time "h:mmAM/PM"
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    let hour = m[4] ? Number(m[4]) : 0;
    const minute = m[5] ? Number(m[5]) : 0;
    const ap = m[6] ? String(m[6]).toUpperCase() : null;

    if (ap) {
      if (ap === "PM" && hour < 12) hour += 12;
      if (ap === "AM" && hour === 12) hour = 0;
    }

    const d = new Date(year, month - 1, day, hour, minute);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

// display only
function normalizeStatusForUI(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "ASSIGNED") return "pending";
  if (!s) return "pending";
  return String(status).toLowerCase();
}

function normalizeAssignedByForUI(creatorType) {
  const t = String(creatorType || "").trim().toUpperCase();
  if (t === "THERAPIST") return "therapist";
  return "me";
}

async function fetchTasks(childNumericId) {
  const q = query(collection(db, "tasks"), where("childId", "==", childNumericId));
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};

    const displayWhen = d.displayWhen || "";
    rows.push({
      id: docSnap.id,
      date: displayWhen,
      title: d.taskName || "",
      assignedBy: normalizeAssignedByForUI(d.creatorType),
      status: normalizeStatusForUI(d.status),
      mood: d.mood || "--",
      intensity: d.intensity || "--",
      note: d.discussionPrompts || "",
      _dateObj: parseTaskDate(displayWhen),
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

      <div id="tkListView" class="tk-card">
        <div class="tk-table-wrap">
          <table class="tk-table">
            <thead>
              <tr>
                <th>date</th>
                <th>title</th>
                <th class="tk-col-assigned">assigned by</th>
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

      <div id="tkFormView" class="tk-card tk-form hidden">
        <h3 class="tk-form-title">Add a task</h3>

        <form id="tkForm" class="tk-form-grid" autocomplete="off">
          <div class="tk-field">
            <label class="tk-label">title</label>
            <input id="tkTitle" class="tk-input" type="text" required autocomplete="off"
              autocapitalize="off" autocorrect="off" spellcheck="false" name="tkTitle_nohistory" />
          </div>

          <div class="tk-row">
            <div class="tk-field">
              <label class="tk-label">date</label>
              <input id="tkDate" class="tk-input" type="date" required autocomplete="off" name="tkDate_nohistory" />
            </div>
          </div>

          <div class="tk-field">
            <label class="tk-label">description</label>
            <textarea id="tkDesc" class="tk-textarea" rows="6" required autocomplete="off"
              autocapitalize="off" autocorrect="off" spellcheck="false" name="tkDesc_nohistory"></textarea>
          </div>

          <div class="tk-buttons">
            <button class="btn-primary" id="tkSaveBtn" type="submit">Save</button>
            <button class="btn-lite" id="tkCancelBtn" type="button">Cancel</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderTable() {
  const tbody = $("tkTbody");
  const subtitle = $("tkSubtitle");
  const sortSel = $("tkSort");
  const statusSel = $("tkStatus");
  if (!tbody) return;

  let list = [...tasksRows];

  const status = statusSel?.value || "";
  if (status) list = list.filter((t) => (t.status || "").toLowerCase() === status);

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
          <td class="tk-assigned-cell">${t.assignedBy || "—"}</td>
          <td><span class="status-dot ${dotClass}"></span>${t.status || "—"}</td>
          <td>${t.mood || "—"}</td>
          <td>${t.intensity || "—"}</td>
          <td>${t.note || "—"}</td>
        </tr>
      `;
    })
    .join("");
}

function showList() {
  $("tkListView")?.classList.remove("hidden");
  $("tkFormView")?.classList.add("hidden");
  $("tkFilters")?.classList.remove("hidden");
}

function showForm() {
  $("tkListView")?.classList.add("hidden");
  $("tkFormView")?.classList.remove("hidden");
  $("tkFilters")?.classList.add("hidden");
  $("tkForm")?.reset();
}

async function loadAndRender() {
  const childDocId = getActiveChildDocId();
  const subtitle = $("tkSubtitle");
  const tbody = $("tkTbody");

  if (!childDocId) {
    if (subtitle) subtitle.textContent = "Missing childId. Open patient using ?childId=...";
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="tk-empty">Missing childId.</td></tr>`;
    return;
  }

  const childNumericId = await getChildNumericId(childDocId);
  if (!childNumericId) {
    if (subtitle) subtitle.textContent = "Missing numeric childID in children document.";
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="tk-empty">Missing numeric childID.</td></tr>`;
    return;
  }

  if (subtitle) subtitle.textContent = "Loading…";
  tasksRows = await fetchTasks(childNumericId);
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

    const saveBtn = $("tkSaveBtn");
    if (saveBtn) saveBtn.disabled = true;

    try {
      const childDocId = getActiveChildDocId();
      const therapistId = getTherapistId();

      if (!therapistId) {
        alert("You must be logged in as a therapist.");
        window.location.href = "login.html";
        return;
      }

      const childNumericId = await getChildNumericId(childDocId);
      if (!childNumericId) {
        alert("Missing numeric childID in children document.");
        return;
      }

      const title = $("tkTitle")?.value.trim();
      const rawDate = $("tkDate")?.value; // yyyy-mm-dd
      const desc = $("tkDesc")?.value.trim();

      if (!title || !rawDate || !desc) {
        alert("Please fill in all fields.");
        return;
      }

      const [y, m, d] = rawDate.split("-");
      const displayWhen = `${Number(d)}/${Number(m)}/${y}`;

      // ✅ IMPORTANT: write to Firestore first
      const docRef = await addDoc(collection(db, "tasks"), {
        childId: childNumericId,
        creatorId: therapistId,
        creatorType: "THERAPIST",
        discussionPrompts: desc,
        displayWhen,
        status: "ASSIGNED",
        taskName: title,
        createdAt: serverTimestamp(),
      });

      console.log("✅ Task saved to Firestore with id:", docRef.id);

      alert("Task added ✅");
      showList();

      // ✅ then read from Firestore and render
      await loadAndRender();
    } catch (err) {
      console.error("❌ add task failed:", err);
      alert(`Task NOT saved to Firestore.\n\nError: ${err?.message || err}`);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}

export async function initTasks(mode = "view") {
  isBound = false;
  renderShell();
  bindUIOnce();
  await loadAndRender();

  if (mode === "add") showForm();
  else showList();
}
