// ../JS/reports.js
// Renders the Reports section inside #panel (loaded via PD.js)
// Reads ONLY from Firestore collection: "children" (NOT "childrenn")

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function $(id) {
  return document.getElementById(id);
}

/**
 * We always use the correct child doc id:
 * 1) ?childId= in URL (preferred)
 * 2) localStorage.selectedChildId (fallback)
 */
function getActiveChildId() {
  const urlId = new URLSearchParams(window.location.search).get("childId");
  if (urlId) return urlId;

  const saved = localStorage.getItem("selectedChildId");
  if (saved) return saved;

  return null;
}

function toDate(tsLike) {
  if (!tsLike) return null;
  if (typeof tsLike?.toDate === "function") return tsLike.toDate(); // Firestore Timestamp
  if (tsLike instanceof Date) return tsLike;
  const d = new Date(tsLike);
  return isNaN(d.getTime()) ? null : d;
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
    happy: "😊",
    joy: "😊",
    excited: "😄",
    sad: "😢",
    upset: "😢",
    down: "😢",
    angry: "😡",
    mad: "😡",
    afraid: "😨",
    fear: "😨",
    scared: "😨",
    anxious: "😰",
    surprised: "😲",
    shocked: "😲",
    calm: "😌",
    relaxed: "😌",
    bored: "😐",
    neutral: "😐",
    disgust: "🤢",
  };
  return map[f] || "🙂";
}

function safeText(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

/**
 * ✅ ONLY ONE detailCard function (with "note" support)
 * This is the one you want.
 */
function detailCard(label, value) {
  const isNote = String(label || "").trim().toLowerCase() === "note";

  return `
    <div class="detail-card ${isNote ? "note" : ""}">
      <div class="detail-label">${safeText(label)}</div>
      <div class="detail-value">${safeText(value)}</div>
    </div>
  `;
}

async function fetchPatientName(childId) {
  try {
    const snap = await getDoc(doc(db, "children", childId));
    if (!snap.exists()) return "Patient";
    const data = snap.data();
    return data?.name || data?.username || "Patient";
  } catch (e) {
    console.error("fetchPatientName error:", e);
    return "Patient";
  }
}

// --------- FETCH HISTORY (child logs) ----------
async function fetchHistoryRows(childId, patientName) {
  try {
    const qHist = query(collection(db, "children", childId, "history"));
    const snap = await getDocs(qHist);

    const rows = [];
    snap.forEach((d) => {
      const data = d.data();

      rows.push({
        id: d.id,
        source: "child",
        emoji: feelingToEmoji(data.feeling),
        dateObj: toDate(data.timestamp),
        dateText: formatDateTime(data.timestamp),
        assignedBy: patientName,
        detailsTitle: "Child emotion log",
        details: {
          Emotion: data.feeling,
          Intensity: data.intensity,
          "What happened?": data.situation,
          Where: data.location,
          When: formatDateTime(data.timestamp),
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

// --------- FETCH REPORTS (parent) ----------
async function fetchParentRows(childId) {
  try {
    const qRep = query(collection(db, "reports"), where("childID", "==", childId));
    const snap = await getDocs(qRep);

    const rows = [];
    snap.forEach((d) => {
      const data = d.data();

      rows.push({
        id: d.id,
        source: "parent",
        emoji: feelingToEmoji(data.childReaction),
        dateObj: toDate(data.dateAndTime),
        dateText: formatDateTime(data.dateAndTime),
        assignedBy: "Parent",
        detailsTitle: "Parent report",
        details: {
          "Child reaction": data.childReaction,
          Situation: data.situation,
          Where: data.location,
          When: formatDateTime(data.dateAndTime),
          "How handled": data.howHandled,
          Questions: data.questions,
        },
      });
    });

    return rows;
  } catch (e) {
    console.error("fetchParentRows error:", e);
    return [];
  }
}

// --------- RENDER TABLE ----------
function renderTable(rows) {
  const tbody = $("reportsTbody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="reports-empty">No reports yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r, idx) => `
      <tr class="report-row">
        <td class="col-emoji"><span class="emoji">${r.emoji}</span></td>
        <td>${r.dateText}</td>
        <td>${r.assignedBy}</td>
        <td class="col-open">
          <button class="open-btn" data-open="${idx}" aria-label="Open report">➜</button>
        </td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-open"));
      openDetails(rows[idx]);
    });
  });
}

// --------- DETAILS PANEL ----------
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

// --------- INIT (called by PD.js) ----------
export async function initReports() {
  const childId = getActiveChildId();

  console.log("Reports init childId:", childId);
  console.log("Firestore path:", childId ? `children/${childId}/history` : "(missing)");

  const tbody = $("reportsTbody");
  const refreshBtn = $("reportsRefreshBtn");
  const onlyParentToggle = $("onlyParentToggle");
  const subtitle = $("reportsSubtitle");
  const pill = $("reportsPatientPill");

  if (!childId) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" class="reports-empty">Missing childId. Open patient using ?childId=...</td></tr>`;
    }
    return;
  }

  const patientName = await fetchPatientName(childId);
  if (pill) pill.textContent = patientName;

  async function load() {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" class="reports-empty">Loading reports…</td></tr>`;
    }

    const onlyParent = !!onlyParentToggle?.checked;

    const [historyRows, parentRows] = await Promise.all([
      onlyParent ? Promise.resolve([]) : fetchHistoryRows(childId, patientName),
      fetchParentRows(childId),
    ]);

    const all = [...historyRows, ...parentRows]
      .filter((r) => r.dateObj instanceof Date && !isNaN(r.dateObj.getTime()))
      .sort((a, b) => b.dateObj - a.dateObj);

    renderTable(all);

    if (subtitle) subtitle.textContent = `${all.length} report(s) found.`;
  }

  refreshBtn?.addEventListener("click", load);
  onlyParentToggle?.addEventListener("change", load);

  await load();
}
