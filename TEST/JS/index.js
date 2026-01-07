import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ====== Global list from Firestore ======
let patients = []; // [{id, name, code, pin, parentId}]

// create a short auto code from name + index (fallback if Firestore has no code)
const makeCode = (name, idx) =>
  (name.slice(0, 2) + String(idx + 1).padStart(2, "0")).toUpperCase();

// SVGs
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

// card builders
function buildAddCard() {
  const article = document.createElement("article");
  article.className = "card add";
  article.innerHTML = `
    <div class="icon" aria-hidden="true">${addPersonSVG}</div>
    <div class="name">add new patient</div>
  `;
  article.setAttribute("role", "button");
  article.setAttribute("tabindex", "0");

  // OPTIONAL: link to signup page for adding new child (change if you have another page)
  article.addEventListener("click", () => {
window.location.href = "addPatient.html";
  });

  article.addEventListener("keypress", (e) => {
    if (e.key === "Enter" || e.key === " ") article.click();
  });

  return article;
}

function buildPatientCard(name, code, childDocId) {
  const article = document.createElement("article");
  article.className = "card";
  article.setAttribute("role", "button");
  article.setAttribute("tabindex", "0");

  article.innerHTML = `
    <div class="icon" aria-hidden="true">${personSVG}</div>
    <div class="name">${name}</div>
    <div class="sub">${code || ""}</div>
  `;

  article.addEventListener("click", () => {
    window.location.href = `PD.html?childId=${encodeURIComponent(childDocId)}`;
  });

  article.addEventListener("keypress", (e) => {
    if (e.key === "Enter" || e.key === " ") article.click();
  });

  return article;
}

// render logic
function renderCards(list) {
  const rail = document.getElementById("rail");
  if (!rail) return;

  rail.innerHTML = "";
  rail.appendChild(buildAddCard());

  const frag = document.createDocumentFragment();
  list.forEach((child, idx) => {
    const name = child.name || "Unnamed";
    const code = child.code || makeCode(name, idx);
    frag.appendChild(buildPatientCard(name, code, child.id));
  });

  rail.appendChild(frag);
}

// search
function setupSearch() {
  const input = document.getElementById("search");
  if (!input) return;

  const doFilter = () => {
    const q = input.value.trim().toLowerCase();

    const filtered = q
      ? patients.filter((p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q)
        )
      : patients;

    renderCards(filtered);
  };

  input.addEventListener("input", doFilter);
}

// carousel arrows
function setupArrows() {
  const rail = document.getElementById("rail");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  if (!rail || !prev || !next) return;

  function cardStep() {
    const firstCard = rail.querySelector(".card");
    const w = firstCard ? firstCard.getBoundingClientRect().width : 280;
    return Math.round(w + 16);
  }

  prev.addEventListener("click", () => {
    rail.scrollBy({ left: -cardStep(), behavior: "smooth" });
  });

  next.addEventListener("click", () => {
    rail.scrollBy({ left: cardStep(), behavior: "smooth" });
  });
}

// Notification dropdown toggle
function setupNotifications() {
  const bell = document.querySelector(".bell");
  const notifBox = document.getElementById("notifBox");

  if (bell && notifBox) {
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      notifBox.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (!bell.contains(e.target)) {
        notifBox.classList.remove("show");
      }
    });
  }
}

// ====== Firestore load ======
async function loadChildrenFromFirestore() {
  try {
    // You already store role: "child" in documents, so we filter by that
    const q = collection(db, "childrenn");   // get ALL children docs
    const snap = await getDocs(q);

    patients = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || "Unnamed",
        parentID: d.parentID || "",
        pin: d.pinHash || "",
        code: d.childId || "" // optional if you store it later
      };
    });

    renderCards(patients);
    setupSearch();
    setupArrows();

    console.log("Loaded children ", patients);
  } catch (err) {
    console.error("Failed to load children ", err);

    // fallback: show empty list but still show add card
    patients = [];
    renderCards(patients);
    setupSearch();
    setupArrows();
  }
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupNotifications();
  loadChildrenFromFirestore();
});
