// ../JS/overview.js (FULL UPDATED)
// - Patient card now shows: name + username + age badge + Reset PIN button (opens modal)
// - Removed patient details/app account cards from UI (JS no longer targets them)
// - Parent card label fixed + copy buttons kept
// - ML cards stacked (trend then triggers)
// - Info (i) popups kept inside this file

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
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/* ---------------- child doc resolver ---------------- */
/**
 * Collection: "children"
 * URL param childId can be:
 * 1) Firestore doc id
 * 2) 9-digit childID field
 */
async function getChildDocRefFromUrl() {
  const param = new URLSearchParams(window.location.search).get("childId");
  if (!param) return null;

  // resolve by 9-digit childID field
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
  if (window.__OV_POPUPS_READY__) return;
  window.__OV_POPUPS_READY__ = true;

  document.addEventListener("click", (e) => {
    const infoBtn = e.target.closest(".ov-info");
    const closeBtn = e.target.closest("[data-close]");

    if (closeBtn) {
      const id = closeBtn.getAttribute("data-close");
      const pop = document.getElementById(id);
      if (pop) {
        pop.classList.remove("show");
        pop.setAttribute("aria-hidden", "true");
      }
      return;
    }

    if (infoBtn) {
      const id = infoBtn.getAttribute("data-pop");
      const pop = document.getElementById(id);
      if (!pop) return;

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

    const clickedInsidePopup = e.target.closest(".ov-pop");
    if (!clickedInsidePopup) {
      document.querySelectorAll(".ov-pop.show").forEach((p) => {
        p.classList.remove("show");
        p.setAttribute("aria-hidden", "true");
      });
    }
  });
}

/* ---------------- modal helpers ---------------- */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add("show");
  m.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function initModalClose() {
  if (window.__OV_MODAL_READY__) return;
  window.__OV_MODAL_READY__ = true;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close-modal]");
    if (!btn) return;
    const id = btn.getAttribute("data-close-modal");
    closeModal(id);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // close only if open
    const open = document.querySelector(".ov-modal.show");
    if (open?.id) closeModal(open.id);
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

  // ---- patient mini card
  $("ovName") && ($("ovName").textContent = d.name || "—");
  $("ovUsernameMini") && ($("ovUsernameMini").textContent = d.childID || "—");

  const ageYM = calculateAgeYM(d.birthdate);
  $("ovAgeBadge") && ($("ovAgeBadge").textContent = `Age: ${ageYM}`);

  // ---- parent mini card
  $("ovParentID") && ($("ovParentID").textContent = d.parentID || "—");
  $("ovChildID") && ($("ovChildID").textContent = d.childID || "—");

  // copy buttons (kept)
  $("copyChildID")?.addEventListener("click", async () => {
    await copyText(d.childID || "");
    showToast("Patient ID copied ");
  });

  $("copyParentID")?.addEventListener("click", async () => {
    await copyText(d.parentID || "");
    showToast("Parent ID copied ");
  });

  // open modal from patient card
  $("btnOpenPin")?.addEventListener("click", () => openModal("pinModal"));

  // ---- PIN reset (modal)
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

      showToast("PIN reset  (shown one-time)");
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
    showToast("PIN copied ");
  });

  hideBtn?.addEventListener("click", () => {
    if (pinValue) pinValue.textContent = "—";
    if (copyPinBtn) copyPinBtn.disabled = true;
    if (hideBtn) hideBtn.disabled = true;
    if (pinHint) pinHint.textContent = "PIN hidden.";
    showToast("PIN hidden");
  });

  return { ref, data: d };
}

/* ---------------- exported entry (used by PD.js) ---------------- */
export async function initOverview() {
  initInfoPopups();
  initModalClose();

  const loaded = await loadOverview();
  if (!loaded) return;

  try {
    const ref = loaded.ref;
    const childDocId = ref.id;

    const childIdValue =
      document.getElementById("ovChildID")?.textContent?.trim() ||
      new URLSearchParams(window.location.search).get("childId") ||
      childDocId;

    const trendMod = await import(`../JS/mlTrend.js?v=${Date.now()}`);
    const trigMod = await import(`../JS/mlTriggers.js?v=${Date.now()}`);

    await trendMod.initTrendML({ childDocId, childIdValue, windowDays: 30 });
    await trigMod.initTriggerML({ childDocId, childIdValue, windowDays: 30 });

  } catch (e) {
    console.error("ML widgets failed:", e);
  }
}
