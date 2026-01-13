// ../JS/mlTrend.js
// Emotion over time (line chart) + Risk estimate + clear axis labels + clearer conclusion text
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
  return (n * sumXY - sumX * sumY) / denom; // slope per step
}

function ema(values, alpha = 0.35) {
  if (!values.length) return 0;
  let e = values[0];
  for (let i = 1; i < values.length; i++) {
    e = alpha * values[i] + (1 - alpha) * e;
  }
  return e;
}

function normalizeIntensity(x) {
  const n = Number(x);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n)); // expected 1..5
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

function buildDailySeries(logs, windowDays = 30) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - windowDays + 1);

  const byDay = new Map(); // dayKey -> { sum, count }
  for (const l of logs) {
    const d = toDate(l.timestamp) || toDate(l.createdAt);
    if (!d) continue;
    if (d < start) continue;

    const key = dayKey(d);
    const inten = normalizeIntensity(l.intensity);
    const cur = byDay.get(key) || { sum: 0, count: 0 };
    cur.sum += inten;
    cur.count += 1;
    byDay.set(key, cur);
  }

  const keys = [];
  const values = [];
  const counts = [];

  const cursor = new Date(start);
  while (cursor <= now) {
    const k = dayKey(cursor);
    keys.push(k);

    if (byDay.has(k)) {
      const { sum, count } = byDay.get(k);
      values.push(sum / Math.max(1, count));
      counts.push(count);
    } else {
      values.push(null);
      counts.push(0);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return { keys, values, counts };
}

function computeRisk(values) {
  const y = values.filter(v => typeof v === "number");
  if (y.length < 3) {
    return { riskPct: 0, trend: "insufficient data", slope: 0, emaVal: 0, highCount: 0 };
  }

  const slope = regressionSlope(y);
  const e = ema(y, 0.35);
  const highCount = y.slice(-10).filter(v => v >= 4).length;

  // tuned for 1..5 scale
  const z = (1.2 * slope) + (0.9 * (e - 3.0)) + (0.35 * (highCount - 2));
  const risk = clamp01(sigmoid(z));
  const riskPct = Math.round(risk * 100);

  let trend = "stable";
  if (slope > 0.08) trend = "increasing";
  else if (slope < -0.08) trend = "decreasing";

  return { riskPct, trend, slope, emaVal: e, highCount };
}

function riskLabel(pct) {
  if (pct >= 70) return "High";
  if (pct >= 40) return "Medium";
  return "Low";
}

function trendFootText({ trend, slope, emaVal, highCount }) {
  const s = slope.toFixed(2);
  const e = emaVal.toFixed(2);
  return `Meaning: the line shows how strong emotions were each day (average intensity). ` +
    `Risk estimates the chance of near-term emotional overload using the trend direction, recent intensity, ` +
    `and repeated high-intensity days. Current: trend is ${trend} (slope ${s}/day), EMA ${e}, ` +
    `high-intensity days recently: ${highCount}.`;
}

let __trendChart = null;

function renderTrendChart(keys, values) {
  const el = document.getElementById("trendChart");
  if (!el || !window.Chart) return;

  const labels = keys.map(niceDateLabel);
  const data = values.map(v => (typeof v === "number" ? v : null));

  if (__trendChart) {
    __trendChart.destroy();
    __trendChart = null;
  }

  __trendChart = new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Average intensity",
        data,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Date: ${items?.[0]?.label || ""}`,
            label: (item) => `Avg intensity: ${item.formattedValue}`
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

export async function initTrendML({ childDocId, childIdValue, windowDays = 30 }) {
  const badgeTrend = document.getElementById("ovTrendBadge");
  const badgeRisk = document.getElementById("ovRiskBadge");
  const subtitle = document.getElementById("ovTrendSubtitle");
  const foot = document.getElementById("ovTrendFoot");

  if (subtitle) subtitle.textContent = "Analyzing recent emotion logs…";

  const logs = await fetchEmotionLogs({ childDocId, childIdValue });

  const { keys, values } = buildDailySeries(logs, windowDays);
  renderTrendChart(keys, values);

  const stats = computeRisk(values);
  const rLabel = riskLabel(stats.riskPct);

  if (badgeTrend) badgeTrend.textContent = `Trend: ${stats.trend}`;
  if (badgeRisk) badgeRisk.textContent = `Risk: ${rLabel} (${stats.riskPct}%)`;

  if (subtitle) {
    subtitle.textContent = logs.length
      ? `Based on ${logs.length} logs in the last ${windowDays} days.`
      : `No emotion logs found in the last ${windowDays} days.`;
  }

  if (foot) foot.textContent = logs.length ? trendFootText(stats) : "Add emotion logs to see trends and risk estimation.";
}
