// ../JS/index.js
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let patients = [];

/* =========================
   Helpers
   ========================= */
function $(id) {
  return document.getElementById(id);
}

function getTherapistId() {
  // 1) direct
  const direct = localStorage.getItem("therapistId");
  if (direct) return direct;

  // 2) moodiTherapist object (same pattern you use in other pages)
  const raw = localStorage.getItem("moodiTherapist");
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      return obj?.docId || obj?.id || null;
    } catch {}
  }
  return null;
}

// fallback code if no childID
const makeCode = (name, idx) =>
  (String(name || "").slice(0, 2) + String(idx + 1).padStart(2, "0")).toUpperCase();

const personSVG = `
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="8" r="3.2" stroke="#334155" stroke-width="1.6"></circle>
    <path d="M5 19a7 7 0 0 1 14 0" stroke="#334155" stroke-width="1.6"></path>
  </svg>
`;

const addPersonSVG = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="#334155" stroke-width="2" stroke-linecap="round"></path>
  </svg>
`;

/* =========================
   Cards
   ========================= */
function buildAddCard() {
  const article = document.createElement("article");
  article.className = "patient-card add";
  article.innerHTML = `
    <div class="icon" aria-hidden="true">${addPersonSVG}</div>
    <div class="name">add new patient</div>
  `;
  article.setAttribute("role", "button");
  article.setAttribute("tabindex", "0");

  const go = () => (window.location.href = "addPatient.html");
  article.addEventListener("click", go);
  article.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") go();
  });

  return article;
}

function buildPatientCard(name, code, childDocId) {
  const article = document.createElement("article");
  article.className = "patient-card";
  article.setAttribute("role", "button");
  article.setAttribute("tabindex", "0");

  article.innerHTML = `
    <div class="icon" aria-hidden="true">${personSVG}</div>
    <div class="name">${name}</div>
    <div class="sub">${code || ""}</div>
  `;

  const go = () => {
    localStorage.setItem("selectedChildId", childDocId);
    window.location.href = `PD.html?childId=${encodeURIComponent(childDocId)}`;
  };

  article.addEventListener("click", go);
  article.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") go();
  });

  return article;
}

function renderCards(list) {
  const rail = $("rail");
  if (!rail) return;

  rail.innerHTML = "";

  // ALWAYS show the add card (so you can confirm JS is working)
  rail.appendChild(buildAddCard());

  const frag = document.createDocumentFragment();
  list.forEach((child, idx) => {
    const name = child.name || "Unnamed";
    const code = child.childID || child.code || makeCode(name, idx);
    frag.appendChild(buildPatientCard(name, code, child.id));
  });

  rail.appendChild(frag);
}

/* =========================
   Search
   ========================= */
function setupSearch() {
  const input = $("search");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    const filtered = q
      ? patients.filter((p) => {
          const name = (p.name || "").toLowerCase();
          const childID = (p.childID || "").toLowerCase();
          const code = (p.code || "").toLowerCase();
          return name.includes(q) || childID.includes(q) || code.includes(q);
        })
      : patients;

    renderCards(filtered);
  });
}

/* =========================
   Arrows (prev/next)
   ========================= */
function setupArrows() {
  const rail = $("rail");
  const prev = $("prev");
  const next = $("next");
  if (!rail || !prev || !next) return;

  prev.type = "button";
  next.type = "button";

  const step = () => {
    const firstCard = rail.querySelector(".patient-card");
    const cardW = firstCard ? firstCard.getBoundingClientRect().width : 300;
    const gap = parseFloat(getComputedStyle(rail).gap || "16") || 16;
    return Math.round(cardW + gap);
  };

  prev.addEventListener("click", (e) => {
    e.preventDefault();
    rail.scrollBy({ left: -step(), behavior: "smooth" });
  });

  next.addEventListener("click", (e) => {
    e.preventDefault();
    rail.scrollBy({ left: +step(), behavior: "smooth" });
  });
}

/* =========================
   Notifications dropdown
   ========================= */
function setupNotifications() {
  const bell = document.querySelector(".bell");
  const notifBox = $("notifBox");
  if (!bell || !notifBox) return;

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    notifBox.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!bell.contains(e.target)) notifBox.classList.remove("show");
  });
}

/* =========================
   Firestore load (robust)
   ========================= */
async function loadChildrenFromFirestore() {
  const therapistId = getTherapistId();

  if (!therapistId) {
    // If you want: redirect to login
    // window.location.href = "login.html";
    console.warn("No therapistId found in localStorage.");
    patients = [];
    renderCards(patients);
    return;
  }

  try {
    const childrenCol = collection(db, "children");

    // Try therapistID first
    let snap = await getDocs(query(childrenCol, where("therapistID", "==", therapistId)));

    // If empty, try therapistId (some DBs use camelCase)
    if (snap.empty) {
      snap = await getDocs(query(childrenCol, where("therapistId", "==", therapistId)));
    }

    patients = snap.docs.map((docSnap) => {
      const d = docSnap.data() || {};
      return {
        id: docSnap.id,
        name: d.name || d.username || "Unnamed",
        childID: d.childID || d.childId || "",
        parentID: d.parentID || d.parentId || "",
        code: d.childID || d.childId || "",
      };
    });

    renderCards(patients);
    console.log("Loaded patients ✅", therapistId, patients);
  } catch (err) {
    console.error("Failed to load children ❌", err);
    patients = [];
    renderCards(patients);
  }
}

/* =========================
   Init
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  setupNotifications();
  setupSearch();
  setupArrows();

  // IMPORTANT: render immediately so you ALWAYS see at least "add new patient"
  renderCards([]);

  await loadChildrenFromFirestore();
});
