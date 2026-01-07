// ../JS/overview.js
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- helpers ---------- */
function getChildDocIdFromUrl() {
  return new URLSearchParams(window.location.search).get("childId");
}
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

  if (today.getDate() < birth.getDate()) {
    months--;
  }

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

/* ---------- MAIN ---------- */
async function loadOverview() {
  const childDocId = getChildDocIdFromUrl();
  if (!childDocId) {
    showToast("Missing childId in URL.");
    return;
  }

  const ref = doc(db, "childrenn", childDocId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    showToast("Patient not found.");
    return;
  }

  const d = snap.data();

  /* --- top cards --- */
  setPill(d.status || "active");
  $("ovCreatedAt").textContent = `Created: ${formatCreatedAt(d.createdAt)}`;
  $("ovName").textContent = d.name || "—";
  $("ovChildID").textContent = d.childID || "—";
  $("ovParentIDInline").textContent = d.parentID || "—";

  /* --- patient details --- */
  $("ovFullName").textContent = d.name || "—";
  $("ovChildID2").textContent = d.childID || "—";
  $("ovParentID2").textContent = d.parentID || "—";

  const ageYM = calculateAgeYM(d.birthdate);
  $("ovAge").textContent = ageYM;
  $("ovAgeMini").textContent = `Age: ${ageYM}`;

  /* --- app account --- */
  $("ovUsername").textContent = d.username || "—";

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

      await updateDoc(ref, { pinHash });

      pinValue.textContent = newPin;
      copyPinBtn.disabled = false;
      hideBtn.disabled = false;
      pinHint.textContent = "Give this PIN to the child now. It won’t be shown again.";

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
    if (pinValue.textContent === "—") return;
    await copyText(pinValue.textContent);
    showToast("PIN copied ✅");
  });

  hideBtn?.addEventListener("click", () => {
    pinValue.textContent = "—";
    copyPinBtn.disabled = true;
    hideBtn.disabled = true;
    pinHint.textContent = "PIN hidden.";
    showToast("PIN hidden");
  });

  $("btnRefresh")?.addEventListener("click", async () => {
    showToast("Refreshing…");
    await loadOverview();
  });
}

loadOverview();
