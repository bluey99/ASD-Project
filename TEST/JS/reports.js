// ../JS/reports.js
// Shows:
// 1) Child logs in children/{childDocId}/history where data.id is null/empty (regular logs)
// 2) Parent reports in top-level "reports" where reports.childID == children.childID (numeric)
// ✅ Unread rows tracked by localStorage (row becomes read ONLY when clicked)
// ✅ Reports tab shows a blue dot (no number) if any unread rows exist
// ✅ Toggle: "Unread first" sorts unread to top

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

function getActiveChildDocId() {
  const urlId = new URLSearchParams(window.location.search).get("childId");
  if (urlId) return urlId;
  const saved = localStorage.getItem("selectedChildId");
  if (saved) return saved;
  return null;
}

/* =========================
   Unread tracking (localStorage)
   ========================= */
function keyReadReports(childDocId) {
  return `moodi_read_reports_${childDocId}`;
}
function getReadSet(childDocId) {
  try {
    const raw = localStorage.getItem(keyReadReports(childDocId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveReadSet(childDocId, set) {
  localStorage.setItem(keyReadReports(childDocId), JSON.stringify([...set]));
}
function markRead(childDocId, rowId, readSet) {
  readSet.add(rowId);
  saveReadSet(childDocId, readSet);
}
function isRead(childDocId, rowId, readSet) {
  return readSet.has(rowId);
}

/* =========================
   Tab dot
   ========================= */
function setTabDot(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function toDate(tsLike) {
  if (!tsLike) return null;
  if (typeof tsLike?.toDate === "function") return tsLike.toDate();
  if (tsLike instanceof Date) return tsLike;

  const s = String(tsLike).trim();

  // dd/mm/yyyy hh:mm
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
    const hh = Number(m[4]), mm = Number(m[5]);
    const d = new Date(year, month - 1, day, hh, mm);
    return isNaN(d.getTime()) ? null : d;
  }

  // d/m/yyyy, h:mmAM
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})(AM|PM)$/i);
  if (m) {
    const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
    let hh = Number(m[4]);
    const mm = Number(m[5]);
    const ap = String(m[6]).toUpperCase();
    if (ap === "PM" && hh < 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
    const d = new Date(year, month - 1, day, hh, mm);
    return isNaN(d.getTime()) ? null : d;
  }

  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2;
}

function formatDateTime(tsLike) {
  const d = toDate(tsLike);
  return d ? d.toLocaleString() : "—";
}

function normalizeFeeling(raw) {
  return String(raw || "").trim().toLowerCase();
}

function feelingToEmoji(raw) {
  const f = normalizeFeeling(raw);
  const map = {
    happy: "😊", joy: "😊", excited: "😄",
    sad: "😢", upset: "😢", down: "😢",
    angry: "😡", mad: "😡",
    afraid: "😨", fear: "😨", scared: "😨",
    anxious: "😰",
    surprised: "😲", shocked: "😲",
    calm: "😌", relaxed: "😌",
    bored: "😐", neutral: "😐",
    disgust: "🤢",
  };
  return map[f] || "🙂";
}

function safeText(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function detailCard(label, value) {
  const isNote = String(label || "").trim().toLowerCase() === "note";
  return `
    <div class="detail-card ${isNote ? "note" : ""}">
      <div class="detail-label">${safeText(label)}</div>
      <div class="detail-value">${safeText(value)}</div>
    </div>
  `;
}

async function fetchChildDoc(childDocId) {
  try {
    const snap = await getDoc(doc(db, "children", childDocId));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    console.error("fetchChildDoc error:", e);
    return null;
  }
}

async function fetchPatientName(childDocId) {
  const data = await fetchChildDoc(childDocId);
  return data?.name || data?.username || "Patient";
}

async function fetchPatientNumericId(childDocId) {
  const data = await fetchChildDoc(childDocId);
  return data?.childID || data?.childId || null;
}

// --------- child logs (history) ----------
async function fetchHistoryRows(childDocId, patientName) {
  try {
    const qHist = query(collection(db, "children", childDocId, "history"));
    const snap = await getDocs(qHist);

    const rows = [];
    snap.forEach((d) => {
      const data = d.data() || {};

      // regular only
      if (data?.id !== null && data?.id !== undefined && data?.id !== "") return;

      const ts = data.timestamp;

      rows.push({
        id: `child_${d.id}`, // prefix to avoid collisions with reports ids
        source: "child",
        emoji: feelingToEmoji(data.feeling),
        dateObj: toDate(ts),
        dateText: formatDateTime(ts),
        assignedBy: patientName,
        detailsTitle: "Child emotion log",
        details: {
          Emotion: data.feeling,
          Intensity: data.intensity,
          "What happened?": data.situation,
          Where: data.location,
          When: formatDateTime(ts),
          Note: data.note,
        },
      });
    });

    return rows;
  } catch (e) {
    console.error("fetchHistoryRows error:", e);
    return [];
  }
}

// --------- parent reports (reports collection) ----------
async function fetchParentReportRows(childNumericId) {
  try {
    if (!childNumericId) return [];

    const qRep = query(collection(db, "reports"), where("childID", "==", childNumericId));
    const snap = await getDocs(qRep);

    const rows = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      const ts = data.timestamp || data.dateAndTime || null;

      rows.push({
        id: `parent_${d.id}`,
        source: "parent",
        emoji: feelingToEmoji(data.childReaction),
        dateObj: toDate(ts),
        dateText: formatDateTime(ts),
        assignedBy: "Parent",
        detailsTitle: "Parent report",
        details: {
          "Child name": data.childName,
          "Child reaction": data.childReaction,
          Situation: data.situation,
          Where: data.location,
          When: formatDateTime(ts),
          "How handled": data.howHandled,
          Questions: data.questions,
        },
      });
    });

    return rows;
  } catch (e) {
    console.error("fetchParentReportRows error:", e);
    return [];
  }
}

// --------- details ----------
function openDetails(row) {
  const empty = $("reportDetailsEmpty");
  const body = $("reportDetailsBody");
  const badge = $("detailsBadge");
  const heading = $("detailsHeading");
  const meta = $("detailsMeta");
  const grid = $("detailsGrid");

  if (!body || !grid) return;

  if (empty) empty.style.display = "none";
  body.classList.remove("hidden");

  if (badge) badge.textContent = row.emoji;
  if (heading) heading.textContent = row.detailsTitle;
  if (meta) meta.textContent = `${row.dateText} • Assigned by: ${row.assignedBy}`;

  grid.innerHTML = Object.entries(row.details)
    .map(([k, v]) => detailCard(k, v))
    .join("");
}

// --------- render ----------
function renderTable(childDocId, rows) {
  const tbody = $("reportsTbody");
  const subtitle = $("reportsSubtitle");
  if (!tbody) return;

  const readSet = getReadSet(childDocId);
  const unreadFirst = !!$("reportsUnreadToggle")?.checked;

  let list = [...rows];

  // sort newest first by default
  list.sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0));

  // unread first
  if (unreadFirst) {
    list.sort((a, b) => {
      const ar = isRead(childDocId, a.id, readSet) ? 1 : 0;
      const br = isRead(childDocId, b.id, readSet) ? 1 : 0;
      if (ar !== br) return ar - br;
      return (b.dateObj || 0) - (a.dateObj || 0);
    });
  }

  if (subtitle) subtitle.textContent = `${list.length} report(s) found.`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="reports-empty">No reports yet.</td></tr>`;
    setTabDot("reportsDot", false);
    return;
  }

  const anyUnread = list.some((r) => !isRead(childDocId, r.id, readSet));
  setTabDot("reportsDot", anyUnread);

  tbody.innerHTML = list
    .map((r, idx) => {
      const unread = !isRead(childDocId, r.id, readSet);
      return `
        <tr class="report-row ${unread ? "row-unread" : ""}" data-rowid="${r.id}" data-idx="${idx}">
          <td class="col-emoji"><span class="emoji">${r.emoji}</span></td>
          <td>${r.dateText}</td>
          <td>${r.assignedBy}</td>
          <td class="col-open">
            <button class="open-btn" data-open="${idx}" aria-label="Open report">➜</button>
          </td>
        </tr>
      `;
    })
    .join("");

  // clicking row OR arrow marks read, and arrow opens details
  tbody.querySelectorAll("tr[data-rowid]").forEach((tr) => {
    tr.addEventListener("click", (e) => {
      const id = tr.getAttribute("data-rowid");
      const idx = Number(tr.getAttribute("data-idx"));

      const rs = getReadSet(childDocId);
      if (!rs.has(id)) {
        markRead(childDocId, id, rs);
        tr.classList.remove("row-unread");
      }

      // if they clicked the arrow or any row area → open details
      openDetails(list[idx]);

      // update dot
      const stillUnread = list.some((x) => !getReadSet(childDocId).has(x.id));
      setTabDot("reportsDot", stillUnread);
    });
  });
}

export async function initReports() {
  const childDocId = getActiveChildDocId();
  const tbody = $("reportsTbody");
  const pill = $("reportsPatientPill");

  if (!childDocId) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" class="reports-empty">Missing childId. Open patient using ?childId=...</td></tr>`;
    }
    return;
  }

  const patientName = await fetchPatientName(childDocId);
  if (pill) pill.textContent = patientName;

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4" class="reports-empty">Loading reports…</td></tr>`;
  }

  const childNumericId = await fetchPatientNumericId(childDocId);

  async function load() {
    const [historyRows, parentRows] = await Promise.all([
      fetchHistoryRows(childDocId, patientName),
      fetchParentReportRows(childNumericId),
    ]);

    const all = [...historyRows, ...parentRows]
      .filter((r) => r.dateObj instanceof Date && !isNaN(r.dateObj.getTime()));

    renderTable(childDocId, all);
  }

  $("reportsUnreadToggle")?.addEventListener("change", load);

  await load();
}

export async function refreshReportsDot() {
  const childDocId = getActiveChildDocId();
  if (!childDocId) return;

  const childNumericId = await fetchPatientNumericId(childDocId);

  const [historyRows, parentRows] = await Promise.all([
    fetchHistoryRows(childDocId, await fetchPatientName(childDocId)),
    fetchParentReportRows(childNumericId),
  ]);

  const all = [...historyRows, ...parentRows]
    .filter((r) => r.dateObj instanceof Date && !isNaN(r.dateObj.getTime()));

  const readSet = getReadSet(childDocId);
  const anyUnread = all.some((r) => !readSet.has(r.id));

  setTabDot("reportsDot", anyUnread);
}

