// ../JS/addPatient.js
// Uses Firebase Firestore + generates username + generates PIN + validates 9-digit childID/parentID
// Stores pinHash (NOT pin). Therapist can see PIN one-time in UI.

import { db } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  limit,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------------- UI ---------------- */
const form = document.getElementById("addPatientForm");

const fullNameEl = document.getElementById("fullName");
const childIDEl = document.getElementById("childID");
const parentIDEl = document.getElementById("parentID");
const birthdateEl = document.getElementById("birthdate");

const btnGenerate = document.getElementById("btnGenerate");
const btnCreate = document.getElementById("btnCreate");
const statusEl = document.getElementById("status");

const genUsernameEl = document.getElementById("genUsername");
const genPinEl = document.getElementById("genPin");
const copyUsernameBtn = document.getElementById("copyUsername");
const copyPinBtn = document.getElementById("copyPin");

/* confirm modal (optional but supported by this file) */
const confirmModal = document.getElementById("confirmModal");
const cancelModal = document.getElementById("cancelModal");
const confirmCreateBtn = document.getElementById("confirmCreate");

const cName = document.getElementById("cName");
const cChildID = document.getElementById("cChildID");
const cParentID = document.getElementById("cParentID");
const cBirthdate = document.getElementById("cBirthdate");
const cUsername = document.getElementById("cUsername");
const cPin = document.getElementById("cPin");

/* ---------------- State ---------------- */
let generatedUsername = null;
let generatedPin = null;

/* ---------------- Helpers ---------------- */
function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#dc2626" : "#64748b";
}

function isNineDigits(v) {
  return /^\d{9}$/.test(v);
}

function isValidBirthdate(dateStr) {
  if (!dateStr) return false;
  // input type="date" => YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  return d <= now && d.getFullYear() > 1900;
}

function cleanBaseFromName(fullName) {
  // username base from first word
  const first = (fullName || "").trim().split(/\s+/)[0] || "";
  return first.toLowerCase().replace(/[^a-z0-9]/g, "");
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

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

/**
 * Optional but recommended: prevent duplicate childID
 * (so search by ID is reliable)
 */
async function childIdExists(childID) {
  // IMPORTANT: if your collection is named "childrenn", change below to "childrenn"
  const qRef = query(
    collection(db, "childrenn"),
    where("childID", "==", childID),
    limit(1)
  );
  const snap = await getDocs(qRef);
  return !snap.empty;
}

/**
 * Generate UNIQUE username using a counter doc:
 * Collection: usernameCounters
 * DocID: base (e.g. "leo")
 * Field: lastNumber
 * Output: leo1, leo2, ...
 */
async function generateUniqueUsername(fullName) {
  const base = cleanBaseFromName(fullName);
  if (!base) throw new Error("Full name must contain letters/numbers.");

  const counterRef = doc(db, "usernameCounters", base);

  const username = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    let last = 0;

    if (snap.exists()) {
      last = Number(snap.data().lastNumber || 0);
    }

    const next = last + 1;
    tx.set(counterRef, { lastNumber: next }, { merge: true });

    return `${base}${next}`;
  });

  return username;
}

function enableAfterGenerate(enabled) {
  if (btnCreate) btnCreate.disabled = !enabled;
  if (copyUsernameBtn) copyUsernameBtn.disabled = !enabled;
  if (copyPinBtn) copyPinBtn.disabled = !enabled;
}

/* ---------------- Main flow ---------------- */
btnGenerate?.addEventListener("click", async () => {
  try {
    setStatus("Checking inputs...");

    const fullName = fullNameEl?.value.trim() || "";
    const childID = childIDEl?.value.trim() || "";
    const parentID = parentIDEl?.value.trim() || "";
    const birthdate = birthdateEl?.value || "";

    // Required fields
    if (!fullName || !childID || !parentID || !birthdate) {
      setStatus("Please fill: Full name, Child ID, Parent ID, Birthdate.", true);
      return;
    }

    // 9 digits validation
    if (!isNineDigits(childID)) {
      setStatus("Child ID must be exactly 9 digits.", true);
      return;
    }
    if (!isNineDigits(parentID)) {
      setStatus("Parent ID must be exactly 9 digits.", true);
      return;
    }

    // birthdate validation
    if (!isValidBirthdate(birthdate)) {
      setStatus("Birthdate is not valid (YYYY-MM-DD).", true);
      return;
    }

    // uniqueness check (recommended)
    setStatus("Checking Child ID uniqueness...");
    if (await childIdExists(childID)) {
      setStatus("This Child ID already exists. Please verify it.", true);
      return;
    }

    // generate username + pin
    setStatus("Generating username and PIN...");
    generatedUsername = await generateUniqueUsername(fullName);
    generatedPin = randomPin6();

    // show on UI
    if (genUsernameEl) genUsernameEl.textContent = generatedUsername;
    if (genPinEl) genPinEl.textContent = generatedPin;

    enableAfterGenerate(true);
    setStatus("Generated  Click “Create patient”.");
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "Failed to generate credentials.", true);
  }
});

copyUsernameBtn?.addEventListener("click", async () => {
  if (!generatedUsername) return;
  await copyToClipboard(generatedUsername);
  setStatus("Username copied.");
});

copyPinBtn?.addEventListener("click", async () => {
  if (!generatedPin) return;
  await copyToClipboard(generatedPin);
  setStatus("PIN copied.");
});

/**
 * If you have a confirmation modal in addPatient.html, we use it.
 * If not, we create directly.
 */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!generatedUsername || !generatedPin) {
    setStatus("Please generate credentials first.", true);
    return;
  }

  const fullName = fullNameEl?.value.trim() || "";
  const childID = childIDEl?.value.trim() || "";
  const parentID = parentIDEl?.value.trim() || "";
  const birthdate = birthdateEl?.value || "";

  // Re-check validation
  if (!fullName || !childID || !parentID || !birthdate) {
    setStatus("Missing required fields.", true);
    return;
  }
  if (!isNineDigits(childID)) {
    setStatus("Child ID must be exactly 9 digits.", true);
    return;
  }
  if (!isNineDigits(parentID)) {
    setStatus("Parent ID must be exactly 9 digits.", true);
    return;
  }
  if (!isValidBirthdate(birthdate)) {
    setStatus("Birthdate is not valid (YYYY-MM-DD).", true);
    return;
  }

  // If modal exists, open it. Otherwise, create directly.
  if (confirmModal && confirmCreateBtn) {
    cName.textContent = fullName;
    cChildID.textContent = childID;
    cParentID.textContent = parentID;
    cBirthdate.textContent = birthdate;
    cUsername.textContent = generatedUsername;
    cPin.textContent = generatedPin;

    confirmModal.showModal();
  } else {
    await createPatient();
  }
});

cancelModal?.addEventListener("click", () => {
  confirmModal?.close();
});

confirmCreateBtn?.addEventListener("click", async () => {
  await createPatient();
});

/* ---------------- Create patient in Firestore ---------------- */
async function createPatient() {
  try {
    setStatus("Creating patient...");

    const fullName = fullNameEl.value.trim();
    const childID = childIDEl.value.trim();
    const parentID = parentIDEl.value.trim();
    const birthdate = birthdateEl.value;

    if (!isNineDigits(childID)) return setStatus("Child ID must be exactly 9 digits.", true);
    if (!isNineDigits(parentID)) return setStatus("Parent ID must be exactly 9 digits.", true);
    if (!isValidBirthdate(birthdate)) return setStatus("Birthdate must be YYYY-MM-DD.", true);

    if (await childIdExists(childID)) {
      setStatus("This Child ID already exists. Please verify it.", true);
      confirmModal?.close();
      return;
    }

    const pinHash = await sha256Hex(generatedPin);

    const newRef = doc(collection(db, "childrenn"));

    await setDoc(newRef, {
      name: fullName,
      childID,
      parentID,
      birthdate,
      username: generatedUsername,
      pinHash,
      createdAt: serverTimestamp()
    });

    confirmModal?.close();
    setStatus("Patient created ");

    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    confirmModal?.close();
    setStatus(err?.message || "Failed to create patient.", true);
  }
}

