// ../JS/overview.js
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

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);

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

function setPill(status) {
  const pill = $("ovStatusPill");
  if (!pill) return;

  const s = (status || "active").toLowerCase();
  pill.classList.remove("ok", "warn", "off");

  if (s === "active") {
    pill.classList.add("ok");
    pill.textContent = "Active";
  } else if (s === "paused") {
    pill.classList.add("warn");
    pill.textContent = "Paused";
  } else {
    pill.classList.add("off");
    pill.textContent = s.charAt(0).toUpperCase() + s.slice(1);
  }
}

/* ---------- AGE: years.months ---------- */
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

function randomPin6() {
  return String(Math.floor(100000 + Math.random() * 900000));
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

/* ---------- IMPORTANT FIX ----------
   Allow URL param childId to be:
   1) Firestore doc id (letters/numbers)
   2) 9-digit patient ID (field: childID)
------------------------------------ */
async function getChildDocRefFromUrl() {
  const param = new URLSearchParams(window.location.search).get("childId");
  if (!param) return null;

  // if param is 9 digits => search by field childID
  if (/^\d{9}$/.test(param)) {
    const qRef = query(
      collection(db, "childrenn"),
      where("childID", "==", param),
      limit(1)
    );
    const snap = await getDocs(qRef);
    if (snap.empty) return null;
    return snap.docs[0].ref; // DocumentReference
  }

  // otherwise treat as firestore doc id
  return doc(db, "childrenn", param);
}

/* ---------- MAIN ---------- */
async function loadOverview() {
  const ref = await getChildDocRefFromUrl();
  if (!ref) {
    showToast("Missing/invalid childId in URL.");
    return;
  }

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    showToast("Patient not found.");
    return;
  }

  const d = snap.data();

  /* --- top cards --- */
  setPill(d.status || "active");

  const createdEl = $("ovCreatedAt");
  if (createdEl) createdEl.textContent = `Created: ${formatCreatedAt(d.createdAt)}`;

  const nameEl = $("ovName");
  if (nameEl) nameEl.textContent = d.name || "—";

  const childIdEl = $("ovChildID");
  if (childIdEl) childIdEl.textContent = d.childID || "—";

  const parentInlineEl = $("ovParentIDInline");
  if (parentInlineEl) parentInlineEl.textContent = d.parentID || "—";

  /* --- patient details --- */
  $("ovFullName") && ($("ovFullName").textContent = d.name || "—");
  $("ovChildID2") && ($("ovChildID2").textContent = d.childID || "—");
  $("ovParentID2") && ($("ovParentID2").textContent = d.parentID || "—");

  const ageYM = calculateAgeYM(d.birthdate);
  $("ovAge") && ($("ovAge").textContent = ageYM);
  $("ovAgeMini") && ($("ovAgeMini").textContent = `Age: ${ageYM}`);

  /* --- app account --- */
  $("ovUsername") && ($("ovUsername").textContent = d.username || "—");

  /* --- copy buttons --- */
  $("copyChildID")?.addEventListener("click", async () => {
    await copyText(d.childID || "");
    showToast("Patient ID copied ✅");
  });

  $("copyParentID")?.addEventListener("click", async () => {
    await copyText(d.parentID || "");
    showToast("Parent ID copied ✅");
  });

  /* --- reset PIN --- */
  const btnReset = $("btnResetPin");
  const pinValue = $("newPin");
  const copyPinBtn = $("copyPin");
  const hideBtn = $("hidePin");
  const pinHint = $("pinHint");

  btnReset?.addEventListener("click", async () => {
    try {
      btnReset.disabled = true;
      btnReset.textContent = "Resetting...";

      const newPin = randomPin6();
      const pinHash = await sha256Hex(newPin);

      // update Firestore with new hash (overwrite old)
      await updateDoc(ref, { pinHash });

      // show one-time pin in UI
      if (pinValue) pinValue.textContent = newPin;
      if (copyPinBtn) copyPinBtn.disabled = false;
      if (hideBtn) hideBtn.disabled = false;
      if (pinHint) pinHint.textContent = "Give this PIN to the child now. It won’t be shown again.";

      showToast("PIN reset ✅ (shown one-time)");
    } catch (e) {
      console.error(e);
      showToast("Reset failed (permissions?).");
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

  $("btnRefresh")?.addEventListener("click", async () => {
    showToast("Refreshing…");
    await loadOverview();
  });
}

loadOverview();
