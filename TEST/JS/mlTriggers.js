// ../JS/mlTriggers.js
// Common stress triggers (bar chart) + location clustering into categories + clearer insight text
// Uses NLP-lite keyword themes from note + situation + location.

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIntensity(x) {
  const n = Number(x);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

async function fetchEmotionLogs({ childDocId, childIdValue }) {
  const results = [];

  // A) subcollection
  try {
    const subRef = collection(db, "children", childDocId, "history");
    const snap = await getDocs(subRef);
    snap.forEach(doc => results.push({ ...doc.data(), __id: doc.id }));
  } catch (e) { /* ignore */ }

  if (results.length) return results;

  // B) fallback top-level history
  try {
    const qRef = query(
      collection(db, "history"),
      where("childId", "==", childIdValue),
      limit(500)
    );
    const snap2 = await getDocs(qRef);
    snap2.forEach(doc => results.push({ ...doc.data(), __id: doc.id }));
  } catch (e) { /* ignore */ }

  return results;
}

/* ---------- Theme detection (trigger themes) ---------- */
const THEMES = [
  { key: "Academic pressure", keywords: ["test", "exam", "quiz", "homework", "grade", "study", "class", "teacher", "assignment"] },
  { key: "Social stress", keywords: ["friend", "friends", "group", "people", "everyone", "laughed", "embarrass", "bully", "alone", "social"] },
  { key: "Sensory overload", keywords: ["loud", "noise", "noisy", "crowd", "crowded", "bright", "sound", "yelling", "busy", "too much"] },
  { key: "Uncertainty / change", keywords: ["new", "change", "unknown", "unexpected", "surprise", "different", "confusing", "confused", "not sure"] },
  { key: "Conflict", keywords: ["argue", "fight", "angry", "yelled", "rules", "punish", "problem", "conflict"] },
  { key: "Other", keywords: [] }
];

function classifyTheme(text) {
  let bestTheme = "Other";
  let bestScore = 0;

  for (const t of THEMES) {
    if (!t.keywords.length) continue;
    let score = 0;
    for (const kw of t.keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTheme = t.key;
    }
  }
  return bestScore > 0 ? bestTheme : "Other";
}

/* ---------- Location clustering ---------- */
const LOCATION_CATEGORIES = [
  { key: "School", keywords: ["school", "class", "classroom", "teacher"] },
  { key: "Home", keywords: ["home", "house"] },
  { key: "Friends / Social", keywords: ["friend", "josh", "park", "party", "playground"] },
  { key: "Public places", keywords: ["mall", "store", "zoo", "restaurant", "bus", "street", "market", "cinema"] },
  { key: "Other", keywords: [] }
];

function categorizeLocation(locRaw) {
  const loc = normalizeText(locRaw);
  if (!loc) return "Other";

  for (const c of LOCATION_CATEGORIES) {
    if (!c.keywords.length) continue;
    for (const kw of c.keywords) {
      if (loc.includes(kw)) return c.key;
    }
  }
  return "Other";
}

function niceRow(theme, count, avg, topLoc) {
  const avgTxt = avg ? avg.toFixed(1) : "—";
  const locTxt = topLoc || "—";
  return `
    <div class="row">
      <div class="k">${theme}</div>
      <div class="v">${count} events · avg intensity ${avgTxt} · mainly ${locTxt}</div>
    </div>
  `;
}

let __triggerChart = null;

function renderTriggerChart(labels, values) {
  const el = document.getElementById("triggerChart");
  if (!el || !window.Chart) return;

  if (__triggerChart) {
    __triggerChart.destroy();
    __triggerChart = null;
  }

  __triggerChart = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Number of logs",
        data: values,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Trigger: ${items?.[0]?.label || ""}`,
            label: (item) => `Logs: ${item.formattedValue}`
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: "Number of logs" },
          beginAtZero: true,
          ticks: { stepSize: 1 }
        },
        x: {
          title: { display: true, text: "Trigger theme" },
          ticks: { maxRotation: 0, minRotation: 0 }
        }
      }
    }
  });
}

export async function initTriggerML({ childDocId, childIdValue, windowDays = 30 }) {
  const subtitle = document.getElementById("ovTriggerSubtitle");
  const table = document.getElementById("ovTriggerTable");
  const windowBadge = document.getElementById("ovTriggerWindow");
  const insightEl = document.getElementById("ovTriggerInsight");
  const catBox = document.getElementById("ovLocationCategories");

  if (windowBadge) windowBadge.textContent = `Window: ${windowDays} days`;
  if (subtitle) subtitle.textContent = "Detecting trigger themes and grouping places…";

  const logs = await fetchEmotionLogs({ childDocId, childIdValue });

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - windowDays + 1);

  const recent = logs.filter(l => {
    const d = toDate(l.timestamp) || toDate(l.createdAt);
    return d && d >= start && d <= now;
  });

  if (!recent.length) {
    renderTriggerChart(["No data"], [0]);
    if (subtitle) subtitle.textContent = `No emotion logs found in the last ${windowDays} days.`;
    if (insightEl) insightEl.textContent = "Add emotion logs to see recurring triggers and locations.";
    if (catBox) catBox.innerHTML = "";
    if (table) table.innerHTML = `<div class="row"><div class="k">—</div><div class="v">No triggers to summarize yet.</div></div>`;
    return;
  }

  /* ---- Build location categories -> places list ---- */
  const catMap = new Map(); // category -> Set(places)
  for (const l of recent) {
    const place = String(l.location || "").trim();
    const cat = categorizeLocation(place);
    if (!catMap.has(cat)) catMap.set(cat, new Set());
    if (place) catMap.get(cat).add(place);
  }

  if (catBox) {
    const entries = Array.from(catMap.entries())
      .map(([cat, set]) => ({ cat, places: Array.from(set).sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => b.places.length - a.places.length);

    catBox.innerHTML = entries.map(e => `
      <div class="cat">
        <div class="cat-title">${e.cat} (${e.places.length})</div>
        <div class="cat-items">${e.places.length ? e.places.join(", ") : "—"}</div>
      </div>
    `).join("");
  }

  /* ---- Aggregate logs by theme ---- */
  const agg = new Map(); // theme -> { count, sumIntensity, locCounts: Map }
  for (const l of recent) {
    const text = normalizeText(`${l.note || ""} ${l.situation || ""} ${l.location || ""}`);
    const theme = classifyTheme(text);

    const inten = normalizeIntensity(l.intensity);
    const loc = String(l.location || "").trim() || "—";

    if (!agg.has(theme)) agg.set(theme, { count: 0, sum: 0, locCounts: new Map() });

    const a = agg.get(theme);
    a.count += 1;
    a.sum += inten;
    a.locCounts.set(loc, (a.locCounts.get(loc) || 0) + 1);
  }

  const rows = Array.from(agg.entries())
    .map(([theme, v]) => {
      let topLoc = "—";
      let best = 0;
      for (const [loc, c] of v.locCounts.entries()) {
        if (c > best) { best = c; topLoc = loc; }
      }
      return {
        theme,
        count: v.count,
        avg: v.sum / Math.max(1, v.count),
        topLoc
      };
    })
    .sort((a, b) => b.count - a.count);

  const top = rows.slice(0, 5);

  renderTriggerChart(top.map(x => x.theme), top.map(x => x.count));

  if (subtitle) subtitle.textContent = `Found ${recent.length} logs. Bars show how often each trigger theme appears.`;

  if (rows.length && insightEl) {
    const t0 = rows[0];
    insightEl.textContent =
      `Meaning: bars show how often each trigger appears. Most common trigger is "${t0.theme}" (${t0.count} logs), mainly in ${t0.topLoc}.`;
  }

  if (table) {
    table.innerHTML = top.map(x => niceRow(x.theme, x.count, x.avg, x.topLoc)).join("");
  }
}
