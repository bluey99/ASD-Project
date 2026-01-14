// ../JS/tasks.js — Tasks (view + add)

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

// ✅ numeric childID used in tasks collection
async function getChildNumericId(childDocId) {
  if (!childDocId) return null;
  try {
    const snap = await getDoc(doc(db, "children", childDocId));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    return data.childID || data.childId || null;
  } catch (e) {
    console.error("getChildNumericId error:", e);
    return null;
  }
}

/* =========================
   Unread tracking (localStorage)
   ========================= */
function keyReadTasks(childDocId) {
  return `moodi_read_tasks_${childDocId}`;
}
function getReadSet(childDocId) {
  try {
    const raw = localStorage.getItem(keyReadTasks(childDocId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveReadSet(childDocId, set) {
  localStorage.setItem(keyReadTasks(childDocId), JSON.stringify([...set]));
}
function markRead(childDocId, rowId, readSet) {
  readSet.add(rowId);
  saveReadSet(childDocId, readSet);
}

/* =========================
   Tab dot helpers
   ========================= */
function setTabDot(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

/* =========================
   displayWhen format helpers
   ========================= */
function formatDisplayWhen(dateStr, timeStr) {
  // dateStr: yyyy-mm-dd, timeStr: HH:MM (24h)
  const [y, m, d] = dateStr.split("-").map(Number);
  const [HH, MM] = timeStr.split(":").map(Number);

  let hour = HH;
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  const min2 = String(MM).padStart(2, "0");

  // REQUIRED: "14/1/2026, 7:29AM"
  return `${Number(d)}/${Number(m)}/${y}, ${hour}:${min2}${ampm}`;
}

function parseTaskDate(displayWhen) {
  if (!displayWhen) return new Date(0);
  const s = String(displayWhen).trim();

  // expected: d/m/yyyy, h:mmAM
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})(AM|PM)$/i
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    let hour = Number(m[4]);
    const minute = Number(m[5]);
    const ap = String(m[6]).toUpperCase();

    if (ap === "PM" && hour < 12) hour += 12;
    if (ap === "AM" && hour === 12) hour = 0;

    const dt = new Date(year, month - 1, day, hour, minute);
    return isNaN(dt.getTime()) ? new Date(0) : dt;
  }

  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? new Date(0) : d2;
}

// display-only mapping
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

/* ---------- state ---------- */
let tasksRows = [];
let isBound = false;

function getRoot() {
  return document.getElementById("tasksRoot") || document.getElementById("panel");
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

/* ---------- UI shell ---------- */
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

        <div class="tk-field">
          <label class="tk-label">Unread first</label>
          <label class="switch">
            <input type="checkbox" id="tkUnreadToggle" />
            <span class="slider"></span>
          </label>
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
              <label class="tk-label">display when</label>
              <input id="tkDate" class="tk-input" type="date" required autocomplete="off" name="tkDate_nohistory" />
            </div>

            <div class="tk-field">
              <label class="tk-label">time</label>
              <input id="tkTime" class="tk-input" type="time" required autocomplete="off" name="tkTime_nohistory" />
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

/* ---------- table render ---------- */
function renderTable(childDocId) {
  const tbody = $("tkTbody");
  const subtitle = $("tkSubtitle");
  if (!tbody) return;

  const readSet = getReadSet(childDocId);
  const unreadFirst = !!$("tkUnreadToggle")?.checked;

  // filter
  const statusFilter = ($("tkStatus")?.value || "").toLowerCase();
  let list = [...tasksRows];
  if (statusFilter) list = list.filter((t) => (t.status || "").toLowerCase() === statusFilter);

  // sort by date
  const dir = $("tkSort")?.value || "desc";
  list.sort((a, b) => (dir === "asc" ? a._dateObj - b._dateObj : b._dateObj - a._dateObj));

  // unread first sort
  if (unreadFirst) {
    list.sort((a, b) => {
      const ar = readSet.has(a.id) ? 1 : 0; // unread first => 0
      const br = readSet.has(b.id) ? 1 : 0;
      if (ar !== br) return ar - br;
      return dir === "asc" ? a._dateObj - b._dateObj : b._dateObj - a._dateObj;
    });
  }

  if (subtitle) subtitle.textContent = `${list.length} task(s) found.`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="tk-empty">No tasks found.</td></tr>`;
    setTabDot("tasksDot", false);
    return;
  }

  // ✅ dot only if unread exists
  const anyUnread = list.some((t) => !readSet.has(t.id));
  setTabDot("tasksDot", anyUnread);

  tbody.innerHTML = list
    .map((t) => {
      const isUnread = !readSet.has(t.id);
      const rowCls = isUnread ? "row-unread" : "";

      const dotClass =
        (t.status || "").toLowerCase() === "done" ? "status-done" : "status-pending";

      return `
        <tr class="${rowCls}" data-rowid="${t.id}">
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

  // ✅ row is "read" ONLY when clicked
  tbody.querySelectorAll("tr[data-rowid]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-rowid");
      const rs = getReadSet(childDocId);
      if (!rs.has(id)) {
        markRead(childDocId, id, rs);
        tr.classList.remove("row-unread");

        // update dot after click
        const stillUnread = tasksRows.some((r) => !getReadSet(childDocId).has(r.id));
        setTabDot("tasksDot", stillUnread);
      }
    });
  });
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

  const now = new Date();
  const d = now.toISOString().split("T")[0];
  const t = now.toTimeString().slice(0, 5);
  if ($("tkDate")) $("tkDate").value = d;
  if ($("tkTime")) $("tkTime").value = t;
  $("tkForm")?.reset();
  if ($("tkDate")) $("tkDate").value = d;
  if ($("tkTime")) $("tkTime").value = t;
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
  renderTable(childDocId);
}

function bindUIOnce() {
  if (isBound) return;
  isBound = true;

  $("tkAddBtn")?.addEventListener("click", showForm);
  $("tkCancelBtn")?.addEventListener("click", showList);

  $("tkSort")?.addEventListener("change", loadAndRender);
  $("tkStatus")?.addEventListener("change", loadAndRender);
  $("tkUnreadToggle")?.addEventListener("change", loadAndRender);

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
      const dateStr = $("tkDate")?.value; // yyyy-mm-dd
      const timeStr = $("tkTime")?.value; // HH:MM
      const desc = $("tkDesc")?.value.trim();

      if (!title || !dateStr || !timeStr || !desc) {
        alert("Please fill in all fields.");
        return;
      }

      const displayWhen = formatDisplayWhen(dateStr, timeStr);

      // ✅ SAVE to Firestore
      const docRef = await addDoc(collection(db, "tasks"), {
        childId: childNumericId,
        creatorId: therapistId,
        creatorType: "THERAPIST",
        taskName: title,
        discussionPrompts: desc,
        displayWhen,
        status: "ASSIGNED",
        createdAt: serverTimestamp(),
      });

      // ✅ IMPORTANT: therapist-added tasks should NOT become unread
      const rs = getReadSet(childDocId);
      markRead(childDocId, docRef.id, rs);

      alert("Task added ✅");
      showList();
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

// ✅ used by PD.js (dot refresh without opening Tasks tab)
export async function refreshTasksDot() {
  const childDocId = getActiveChildDocId();
  if (!childDocId) return;

  const childNumericId = await getChildNumericId(childDocId);
  if (!childNumericId) return;

  const rows = await fetchTasks(childNumericId);
  const readSet = getReadSet(childDocId);

  const anyUnread = rows.some((r) => !readSet.has(r.id));
  setTabDot("tasksDot", anyUnread);
}
