// ../JS/feedback.js
// Firestore CRUD for collection: "feedbacks"
// fields: childID, parentID, therapistID, date(YYYY-MM-DD), time(HH:MM), title, description
// + after adding feedback -> add notification to "notifications" for the parent
// + disables browser "field history" (autocomplete)

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id) {
  return document.getElementById(id);
}

function getActiveChildId() {
  const urlId = new URLSearchParams(window.location.search).get("childId");
  if (urlId) return urlId;
  const saved = localStorage.getItem("selectedChildId");
  if (saved) return saved;
  return null;
}

function getTherapistId() {
  const direct = localStorage.getItem("therapistId");
  if (direct) return direct;

  const raw = localStorage.getItem("moodiTherapist");
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      return obj?.docId || "unknown";
    } catch {}
  }
  return "unknown";
}

// ✅ NEW: get parentID from /children/{childId}
async function getParentIdForChild(childId) {
  if (!childId) return null;
  try {
    const snap = await getDoc(doc(db, "children", childId));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    return data.parentID || data.parentId || null;
  } catch (err) {
    console.error("Failed to read parentID for child:", err);
    return null;
  }
}

// ✅ NEW: get child name from /children/{childId}
async function getChildName(childId) {
  if (!childId) return "Child";
  try {
    const snap = await getDoc(doc(db, "children", childId));
    if (!snap.exists()) return "Child";
    const data = snap.data() || {};
    return data.name || data.username || data.childName || "Child";
  } catch (err) {
    console.error("Failed to read child name:", err);
    return "Child";
  }
}

function combineKey(dateStr, timeStr) {
  return `${dateStr || ""} ${timeStr || ""}`.trim();
}

function setTodayDefaults() {
  const now = new Date();
  const d = now.toISOString().split("T")[0];
  const t = now.toTimeString().slice(0, 5);
  return { d, t };
}

// ✅ disable browser field history / suggestions
function disableFieldHistory() {
  const form = $("fbForm");
  if (form) form.setAttribute("autocomplete", "off");

  const title = $("fbTitle");
  const date = $("fbDate");
  const time = $("fbTime");
  const desc = $("fbDesc");

  if (title) {
    title.setAttribute("autocomplete", "off");
    title.setAttribute("autocapitalize", "off");
    title.setAttribute("autocorrect", "off");
    title.setAttribute("spellcheck", "false");
    title.setAttribute("name", "fbTitle_nohistory");
  }
  if (date) {
    date.setAttribute("autocomplete", "off");
    date.setAttribute("name", "fbDate_nohistory");
  }
  if (time) {
    time.setAttribute("autocomplete", "off");
    time.setAttribute("name", "fbTime_nohistory");
  }
  if (desc) {
    desc.setAttribute("autocomplete", "off");
    desc.setAttribute("autocapitalize", "off");
    desc.setAttribute("autocorrect", "off");
    desc.setAttribute("spellcheck", "false");
    desc.setAttribute("name", "fbDesc_nohistory");
  }
}

let feedbackRows = [];
let editingId = null;
let isBound = false;

async function fetchFeedbacks(childId) {
  const qFb = query(collection(db, "feedbacks"), where("childID", "==", childId));
  const snap = await getDocs(qFb);

  const rows = [];
  snap.forEach((d) => {
    const data = d.data();
    rows.push({
      id: d.id,
      childID: data.childID,
      parentID: data.parentID || "",
      therapistID: data.therapistID,
      date: data.date || "",
      time: data.time || "",
      title: data.title || "",
      description: data.description || "",
      _key: combineKey(data.date, data.time),
    });
  });

  return rows;
}

function renderTable() {
  const tbody = $("fbTbody");
  const subtitle = $("fbSubtitle");
  const sortSelect = $("fbSortSelect");
  const dateFilter = $("fbDateFilter");

  if (!tbody) return;

  let list = [...feedbackRows];

  const filterDate = dateFilter?.value || "";
  if (filterDate) list = list.filter((x) => x.date === filterDate);

  const sortDir = sortSelect?.value || "desc";
  list.sort((a, b) =>
    sortDir === "asc" ? a._key.localeCompare(b._key) : b._key.localeCompare(a._key)
  );

  if (subtitle) subtitle.textContent = `${list.length} feedback(s) found.`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="fb-empty">No feedback found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (fb) => `
      <tr>
        <td>${fb.date || "—"}</td>
        <td>${fb.title || "—"}</td>
        <td>${fb.time || "—"}</td>
        <td>${fb.description || "—"}</td>
        <td class="fb-actions-cell">
          <a href="#" data-edit="${fb.id}">edit</a> /
          <a href="#" data-del="${fb.id}">delete</a>
        </td>
      </tr>
    `
    )
    .join("");
}

function showList() {
  $("fbListView")?.classList.remove("hidden");
  $("fbFormView")?.classList.add("hidden");
  document.querySelector(".fb-filters")?.classList.remove("hidden");
  editingId = null;
}

function showForm(editFb = null) {
  $("fbListView")?.classList.add("hidden");
  $("fbFormView")?.classList.remove("hidden");
  document.querySelector(".fb-filters")?.classList.add("hidden");

  disableFieldHistory();

  const formTitle = $("fbFormTitle");
  const titleEl = $("fbTitle");
  const dateEl = $("fbDate");
  const timeEl = $("fbTime");
  const descEl = $("fbDesc");

  if (!titleEl || !dateEl || !timeEl || !descEl) return;

  if (editFb) {
    editingId = editFb.id;
    if (formTitle) formTitle.textContent = "Edit feedback";
    titleEl.value = editFb.title || "";
    dateEl.value = editFb.date || "";
    timeEl.value = editFb.time || "";
    descEl.value = editFb.description || "";
  } else {
    editingId = null;
    if (formTitle) formTitle.textContent = "Add feedback";
    const { d, t } = setTodayDefaults();
    titleEl.value = "";
    dateEl.value = d;
    timeEl.value = t;
    descEl.value = "";
  }
}

async function loadAndRender() {
  const childId = getActiveChildId();
  const subtitle = $("fbSubtitle");
  const tbody = $("fbTbody");

  if (!childId) {
    if (subtitle) subtitle.textContent = "Missing childId. Open patient using ?childId=...";
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="fb-empty">Missing childId.</td></tr>`;
    return;
  }

  if (subtitle) subtitle.textContent = "Loading…";
  feedbackRows = await fetchFeedbacks(childId);
  renderTable();
}

async function addFeedback(data) {
  await addDoc(collection(db, "feedbacks"), {
    childID: data.childID,
    parentID: data.parentID,
    therapistID: data.therapistID,
    title: data.title,
    date: data.date,
    time: data.time,
    description: data.description,
    createdAt: serverTimestamp(),
  });
}

// ✅ NEW: create notification in "notifications" for parent
async function addParentNotification({ parentID, childName }) {
  if (!parentID) return;

  const msg = `${childName} therapist added a feedback`;

  await addDoc(collection(db, "notifications"), {
    message: msg,
    read: false,
    receiverId: parentID,
    receiverType: "PARENT",
    createdAt: serverTimestamp(),
  });
}

async function updateFeedback(id, updates) {
  await updateDoc(doc(db, "feedbacks", id), {
    title: updates.title,
    date: updates.date,
    time: updates.time,
    description: updates.description,
    updatedAt: serverTimestamp(),
  });
}

async function deleteFeedback(id) {
  await deleteDoc(doc(db, "feedbacks", id));
  await loadAndRender();
}

function bindUIOnce() {
  if (isBound) return;
  isBound = true;

  $("fbRefreshBtn")?.addEventListener("click", loadAndRender);
  $("fbAddBtn")?.addEventListener("click", () => showForm(null));
  $("fbSortSelect")?.addEventListener("change", renderTable);
  $("fbDateFilter")?.addEventListener("change", renderTable);
  $("fbCancelBtn")?.addEventListener("click", showList);

  $("fbTbody")?.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");

    if (edit) {
      e.preventDefault();
      const id = edit.getAttribute("data-edit");
      const fb = feedbackRows.find((x) => x.id === id);
      if (fb) showForm(fb);
      return;
    }

    if (del) {
      e.preventDefault();
      const id = del.getAttribute("data-del");
      if (confirm("Delete this feedback?")) deleteFeedback(id);
    }
  });

  $("fbForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const childId = getActiveChildId();
    if (!childId) return alert("Missing childId.");

    const title = $("fbTitle")?.value.trim();
    const date = $("fbDate")?.value;
    const time = $("fbTime")?.value;
    const description = $("fbDesc")?.value.trim();

    if (!title || !date || !time || !description) {
      alert("Please fill in all fields.");
      return;
    }

    if (editingId) {
      await updateFeedback(editingId, { title, date, time, description });
      showList();
      await loadAndRender();
      return;
    }

    const parentID = await getParentIdForChild(childId);
    if (!parentID) {
      alert("Could not find parentID for this child in Firestore (children collection).");
      return;
    }

    await addFeedback({
      childID: childId,
      parentID,
      therapistID: getTherapistId(),
      title,
      date,
      time,
      description,
    });

    // ✅ send notification to parent
    const childName = await getChildName(childId);
    await addParentNotification({ parentID, childName });

    alert("Feedback added ");
    showList();
    await loadAndRender();
  });
}

// ✅ exported init
export async function initFeedbacks(mode = "view") {
  isBound = false;

  disableFieldHistory();
  bindUIOnce();
  await loadAndRender();

  if (mode === "add") showForm(null);
  else showList();
}
