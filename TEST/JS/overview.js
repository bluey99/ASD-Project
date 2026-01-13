// ../JS/overview.js  (FULL UPDATED)
// - Loads patient profile + PIN reset
// - Runs ML widgets (trend + triggers)
// - Handles info (i) popups WITHOUT creating a new file

import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

/* ---------------- toast ---------------- */
function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function formatCreatedAt(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

function calculateAgeYM(birthdateStr) {
  if (!birthdateStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthdateStr)) return "—";
  const birth = new Date(birthdateStr);
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years}.${months}`;
}

function randomPin4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

/* ---------------- child doc resolver ---------------- */
/**
 * ✅ ALWAYS use collection "children"
 * URL param childId can be:
 * 1) Firestore doc id
 * 2) 9-digit childID field
 */
async function getChildDocRefFromUrl() {
  const param = new URLSearchParams(window.location.search).get("childId");
  if (!param) return null;

  // resolve by 9-digit childID
  if (/^\d{9}$/.test(param)) {
    const qRef = query(
      collection(db, "children"),
      where("childID", "==", param),
      limit(1)
    );
    const snap = await getDocs(qRef);
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  // treat as doc id
  return doc(db, "children", param);
}

/* ---------------- popups (info i) ---------------- */
function initInfoPopups() {
  // avoid double-binding when tab reloads
  if (window.__OV_POPUPS_READY__) return;
  window.__OV_POPUPS_READY__ = true;

  // open/close from buttons with data-pop
  document.addEventListener("click", (e) => {
    const infoBtn = e.target.closest(".ov-info");
    const closeBtn = e.target.closest("[data-close]");

    // Close button
    if (closeBtn) {
      const id = closeBtn.getAttribute("data-close");
      const pop = document.getElementById(id);
      if (pop) {
        pop.classList.remove("show");
        pop.setAttribute("aria-hidden", "true");
      }
      return;
    }

    // Info button toggle
    if (infoBtn) {
      const id = infoBtn.getAttribute("data-pop");
      const pop = document.getElementById(id);
      if (!pop) return;

      // close other open popups
      document.querySelectorAll(".ov-pop.show").forEach((p) => {
        if (p !== pop) {
          p.classList.remove("show");
          p.setAttribute("aria-hidden", "true");
        }
      });

      pop.classList.toggle("show");
      pop.setAttribute("aria-hidden", pop.classList.contains("show") ? "false" : "true");
      return;
    }

    // click outside closes any popup
    const clickedInsidePopup = e.target.closest(".ov-pop");
    if (!clickedInsidePopup) {
      document.querySelectorAll(".ov-pop.show").forEach((p) => {
        p.classList.remove("show");
        p.setAttribute("aria-hidden", "true");
      });
    }
  });
}

/* ---------------- core overview loader ---------------- */
async function loadOverview() {
  const ref = await getChildDocRefFromUrl();
  if (!ref) {
    showToast("Missing/invalid childId in URL.");
    return null;
  }

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    showToast("Patient not found.");
    return null;
  }

  const d = snap.data();

  // created at (optional element)
  const createdEl = $("ovCreatedAt");
  if (createdEl) createdEl.textContent = `Created: ${formatCreatedAt(d.createdAt)}`;

  // top mini cards
  $("ovName") && ($("ovName").textContent = d.name || "—");
  $("ovChildID") && ($("ovChildID").textContent = d.childID || "—");
  $("ovParentIDInline") && ($("ovParentIDInline").textContent = d.parentID || "—");

  // details card
  $("ovFullName") && ($("ovFullName").textContent = d.name || "—");
  $("ovChildID2") && ($("ovChildID2").textContent = d.childID || "—");
  $("ovParentID2") && ($("ovParentID2").textContent = d.parentID || "—");

  const ageYM = calculateAgeYM(d.birthdate);
  $("ovAge") && ($("ovAge").textContent = ageYM);
  $("ovAgeMini") && ($("ovAgeMini").textContent = `Age: ${ageYM}`);

  // account card
  $("ovUsername") && ($("ovUsername").textContent = d.username || "—");

  // copy buttons
  $("copyChildID")?.addEventListener("click", async () => {
    await copyText(d.childID || "");
    showToast("Patient ID copied ✅");
  });

  $("copyParentID")?.addEventListener("click", async () => {
    await copyText(d.parentID || "");
    showToast("Parent ID copied ✅");
  });

  // PIN reset box
  const btnReset = $("btnResetPin");
  const pinValue = $("newPin");
  const copyPinBtn = $("copyPin");
  const hideBtn = $("hidePin");
  const pinHint = $("pinHint");

  btnReset?.addEventListener("click", async () => {
    try {
      btnReset.disabled = true;
      btnReset.textContent = "Resetting...";

      const newPin = randomPin4();
      const pinHash = await sha256Hex(newPin);

      await updateDoc(ref, { pinHash });

      if (pinValue) pinValue.textContent = newPin;
      if (copyPinBtn) copyPinBtn.disabled = false;
      if (hideBtn) hideBtn.disabled = false;
      if (pinHint) pinHint.textContent = "Give this PIN to the child now. It won’t be shown again.";

      showToast("PIN reset ✅ (shown one-time)");
    } catch (e) {
      console.error(e);
      showToast("Reset failed.");
    } finally {
      btnReset.disabled = false;
      btnReset.textContent = "Reset PIN";
    }
  });

  copyPinBtn?.addEventListener("click", async () => {
    const text = pinValue?.textContent || "";
    if (!text || text === "—") return;
    await copyText(text);
    showToast("PIN copied ✅");
  });

  hideBtn?.addEventListener("click", () => {
    if (pinValue) pinValue.textContent = "—";
    if (copyPinBtn) copyPinBtn.disabled = true;
    if (hideBtn) hideBtn.disabled = true;
    if (pinHint) pinHint.textContent = "PIN hidden.";
    showToast("PIN hidden");
  });

  // optional refresh button if exists
  $("btnRefresh")?.addEventListener("click", async () => {
    showToast("Refreshing…");
    await loadOverview();
  });

  return { ref, data: d };
}

/* ---------------- exported entry (used by PD.js) ---------------- */
export async function initOverview() {
  // Enable popups (risk info + trigger info)
  initInfoPopups();

  const loaded = await loadOverview();
  if (!loaded) return;

  // ✅ Run ML widgets only if their elements exist
  try {
    const ref = loaded.ref;
    const childDocId = ref.id;

    // fallback ID for history queries
    const childIdValue =
      document.getElementById("ovChildID")?.textContent?.trim() ||
      new URLSearchParams(window.location.search).get("childId") ||
      childDocId;

    // import fresh to avoid caching during tab switching
    const trendMod = await import(`../JS/mlTrend.js?v=${Date.now()}`);
    const trigMod = await import(`../JS/mlTriggers.js?v=${Date.now()}`);

    // 30 days window
    await trendMod.initTrendML({ childDocId, childIdValue, windowDays: 30 });
    await trigMod.initTriggerML({ childDocId, childIdValue, windowDays: 30 });

  } catch (e) {
    console.error("ML widgets failed:", e);
  }
}
