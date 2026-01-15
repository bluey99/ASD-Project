// ../JS/mlTrend.js  (UPDATED: TWO LINES + TWO PERCENTAGES)
// - Blue line = Positive feelings intensity over time
// - Orange line = Negative feelings intensity over time
// - Two metrics:
//    1) Negative Risk %  (overload likelihood)   -> computed from NEGATIVE series
//    2) Positive Stability % (recent positivity strength & consistency) -> computed from POSITIVE series
//
// Works with either:
// 1) children/{childDocId}/history
// 2) top-level history where childId == childIdValue

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------------- helpers ---------------- */
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function niceDateLabel(yyyyMMdd) {
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeIntensity(x) {
  const n = Number(x);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n)); // expected 1..5
}

function normalizeFeeling(f) {
  return String(f || "").trim().toUpperCase();
}

/* ---------------- feeling polarity ----------------
   Adjust these to match YOUR feelings exactly.
   Anything not in POSITIVE is treated as NEGATIVE (safer).
--------------------------------------------------- */
const POSITIVE_FEELINGS = new Set([
  "HAPPY",
  "CALM",
  "RELAXED",
  "PROUD",
  "EXCITED",
  "SAFE",
  "CONFIDENT",
  "GRATEFUL",
  "CONTENT",
  "JOY"
]);

function isPositiveFeeling(feelingStr) {
  const f = normalizeFeeling(feelingStr);
  return POSITIVE_FEELINGS.has(f);
}

/* ---------------- math (trend + EMA) ---------------- */
function regressionSlope(y) {
  const n = y.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumXX += i * i;
  }
  const denom = (n * sumXX - sumX * sumX);
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function ema(values, alpha = 0.35) {
  if (!values.length) return 0;
  let e = values[0];
  for (let i = 1; i < values.length; i++) {
    e = alpha * values[i] + (1 - alpha) * e;
  }
  return e;
}

/* ---------------- firestore fetch ---------------- */
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

/* ---------------- build DAILY series for positive & negative ---------------- */
function buildDailySeries2(logs, windowDays = 30) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - windowDays + 1);

  const byDay = new Map(); // dayKey -> accumulators

  for (const l of logs) {
    const d = toDate(l.timestamp) || toDate(l.createdAt);
    if (!d) continue;
    if (d < start) continue;

    const key = dayKey(d);
    const inten = normalizeIntensity(l.intensity);
    const pos = isPositiveFeeling(l.feeling);

    const cur = byDay.get(key) || {
      posSum: 0, posCount: 0,
      negSum: 0, negCount: 0,
      totalCount: 0
    };

    if (pos) { cur.posSum += inten; cur.posCount += 1; }
    else { cur.negSum += inten; cur.negCount += 1; }

    cur.totalCount += 1;
    byDay.set(key, cur);
  }

  const keys = [];
  const posValues = [];
  const negValues = [];
  const counts = [];

  const cursor = new Date(start);
  while (cursor <= now) {
    const k = dayKey(cursor);
    keys.push(k);

    if (byDay.has(k)) {
      const v = byDay.get(k);
      posValues.push(v.posCount ? (v.posSum / v.posCount) : null);
      negValues.push(v.negCount ? (v.negSum / v.negCount) : null);
      counts.push(v.totalCount || 0);
    } else {
      posValues.push(null);
      negValues.push(null);
      counts.push(0);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return { keys, posValues, negValues, counts };
}

/* ---------------- NEGATIVE: risk (overload likelihood) ---------------- */
function computeNegativeRisk(negValues) {
  const y = negValues.filter(v => typeof v === "number");
  if (y.length < 3) {
    return { pct: 0, label: "Low", trend: "insufficient data", slope: 0, emaVal: 0, highCount: 0 };
  }

  const slope = regressionSlope(y);
  const e = ema(y, 0.35);
  const highCount = y.slice(-10).filter(v => v >= 4).length;

  const z = (1.2 * slope) + (0.9 * (e - 3.0)) + (0.35 * (highCount - 2));
  const risk = clamp01(sigmoid(z));
  const pct = Math.round(risk * 100);

  let trend = "stable";
  if (slope > 0.08) trend = "increasing";
  else if (slope < -0.08) trend = "decreasing";

  const label = pct >= 70 ? "High" : (pct >= 40 ? "Medium" : "Low");
  return { pct, label, trend, slope, emaVal: e, highCount };
}

/* ---------------- POSITIVE: stability (not risk) ----------------
   Idea: higher EMA of positive + non-decreasing trend => higher stability score
--------------------------------------------------- */
function computePositiveStability(posValues) {
  const y = posValues.filter(v => typeof v === "number");
  if (y.length < 3) {
    return { pct: 0, label: "Insufficient data", trend: "insufficient data", slope: 0, emaVal: 0 };
  }

  const slope = regressionSlope(y);
  const e = ema(y, 0.35);

  // map EMA (around 1..5) to a 0..1 score: center at 3
  const emaScore = clamp01((e - 2.5) / 2.5); // e=2.5 ->0, e=5 ->1
  // map slope to 0..1 (we reward stable/upward positivity, not punish too harsh)
  const slopeScore = clamp01((slope + 0.10) / 0.20); // -0.10->0, +0.10->1

  // combine (weights can be tuned)
  const score = clamp01(0.75 * emaScore + 0.25 * slopeScore);
  const pct = Math.round(score * 100);

  let trend = "stable";
  if (slope > 0.08) trend = "increasing";
  else if (slope < -0.08) trend = "decreasing";

  let label = "Low";
  if (pct >= 70) label = "Strong";
  else if (pct >= 40) label = "Moderate";
  else label = "Weak";

  return { pct, label, trend, slope, emaVal: e };
}

/* ---------------- footer text ---------------- */
function footText({ negRisk, posStab }) {
  const ns = negRisk.slope.toFixed(2);
  const ne = negRisk.emaVal.toFixed(2);

  const ps = posStab.slope.toFixed(2);
  const pe = posStab.emaVal.toFixed(2);

  return (
    `Meaning: blue = positive feelings (daily average intensity), orange = negative feelings (daily average intensity). ` +
    `Negative risk estimates near-term overload likelihood from the orange line (trend + recent intensity + repeated high-intensity days). ` +
    `Positive stability describes how strong/consistent positive feelings are recently (EMA + trend). ` +
    `Current: negative trend ${negRisk.trend} (slope ${ns}/day), EMA ${ne}, high-intensity negative days: ${negRisk.highCount}. ` +
    `Positive trend ${posStab.trend} (slope ${ps}/day), EMA ${pe}.`
  );
}

/* ---------------- chart rendering (TWO datasets) ---------------- */
let __trendChart = null;

function renderTrendChart2(keys, posValues, negValues) {
  const el = document.getElementById("trendChart");
  if (!el || !window.Chart) return;

  const labels = keys.map(niceDateLabel);
  const posData = posValues.map(v => (typeof v === "number" ? v : null));
  const negData = negValues.map(v => (typeof v === "number" ? v : null));

  if (__trendChart) {
    __trendChart.destroy();
    __trendChart = null;
  }

  __trendChart = new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Positive feelings",
          data: posData,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2,
          borderColor: "#2563eb" // blue
        },
        {
          label: "Negative feelings",
          data: negData,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2,
          borderColor: "#f59e0b" // orange
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 12, boxHeight: 12 }
        },
        tooltip: {
          callbacks: {
            title: (items) => `Date: ${items?.[0]?.label || ""}`,
            label: (item) => `${item.dataset.label}: ${item.formattedValue}`
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: "Intensity (1–5)" },
          suggestedMin: 0,
          suggestedMax: 5,
          ticks: { stepSize: 1 }
        },
        x: {
          title: { display: true, text: "Date" },
          ticks: { maxTicksLimit: 8 }
        }
      }
    }
  });
}

/* ---------------- exported init ---------------- */
export async function initTrendML({ childDocId, childIdValue, windowDays = 30 }) {
  const badgeTrend = document.getElementById("ovTrendBadge");
  const badgeRisk = document.getElementById("ovRiskBadge");
  const subtitle = document.getElementById("ovTrendSubtitle");
  const foot = document.getElementById("ovTrendFoot");

  if (subtitle) subtitle.textContent = "Analyzing recent emotion logs…";

  const logs = await fetchEmotionLogs({ childDocId, childIdValue });

  const { keys, posValues, negValues } = buildDailySeries2(logs, windowDays);
  renderTrendChart2(keys, posValues, negValues);

  const negRisk = computeNegativeRisk(negValues);
  const posStab = computePositiveStability(posValues);

  // ✅ Badge 1: negative trend (clarify it is negative)
  if (badgeTrend) badgeTrend.textContent = `Negative trend: ${negRisk.trend}`;

  // ✅ Badge 2: show BOTH metrics (no “risk” for positive)
  if (badgeRisk) {
    badgeRisk.textContent = `Negative risk: ${negRisk.label} (${negRisk.pct}%) · Positive stability: ${posStab.label} (${posStab.pct}%)`;
  }

  if (subtitle) {
    const total = logs.length;
    const posCount = logs.filter(l => isPositiveFeeling(l.feeling)).length;
    const negCount = total - posCount;

    subtitle.textContent = total
      ? `Based on ${total} logs in the last ${windowDays} days (${posCount} positive, ${negCount} negative).`
      : `No emotion logs found in the last ${windowDays} days.`;
  }

  if (foot) {
    foot.textContent = logs.length
      ? footText({ negRisk, posStab })
      : "Add emotion logs to see positive vs negative trends, negative risk, and positive stability.";
  }
}
