// ====== 1) Your data: edit this list only ======
const patients = [
  "Emily",
  "Daniel",
  "Liam",
  "Sofia",
  "Noah",
  "Olivia",
  "Ethan",
  "Ava",
  "Mason",
];

// Optional: create a short auto "code" from name + index
const makeCode = (name, idx) =>
  (name.slice(0, 2) + String(idx + 1).padStart(2, "0")).toUpperCase();

// ====== 2) Reusable SVGs ======
const personSVG = `
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="8" r="3.2" stroke="#334155" stroke-width="1.6"></circle>
    <path d="M5 19a7 7 0 0 1 14 0" stroke="#334155" stroke-width="1.6"></path>
  </svg>
`;

const plusSVG = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="#334155" stroke-width="2" stroke-linecap="round"></path>
  </svg>
`;

// ====== 3) Card builders ======
function buildAddCard() {
  const article = document.createElement("article");
  article.className = "card add";
  article.innerHTML = `
    <div class="icon" aria-hidden="true">${plusSVG}</div>
    <div class="name">add new patient</div>
  `;
  article.setAttribute("role", "button");
  article.setAttribute("tabindex", "0");
  // Hook an action here if needed (e.g., open modal)
  return article;
}

function buildPatientCard(name, code) {
  const article = document.createElement("article");
  article.className = "card";
  article.innerHTML = `
    <div class="icon" aria-hidden="true">${personSVG}</div>
    <div class="name">${name}</div>
    <div class="sub">${code || "code"}</div>
  `;
  // Example click handler for navigation (optional)
  // article.addEventListener("click", () => {
  //   location.href = \`/patients/\${encodeURIComponent(name)}\`;
  // });
  return article;
}

// ====== 4) Render logic ======
function renderCards(list) {
  const rail = document.getElementById("rail");
  if (!rail) return;
  rail.innerHTML = "";

  // Always show the "Add new patient" card first
  rail.appendChild(buildAddCard());

  // Then the patient cards
  const frag = document.createDocumentFragment();
  list.forEach((name, idx) => {
    const code = makeCode(name, idx);
    frag.appendChild(buildPatientCard(name, code));
  });
  rail.appendChild(frag);
}

// ====== 5) Search/filter ======
function setupSearch() {
  const input = document.getElementById("search");
  if (!input) return;

  const doFilter = () => {
    const q = input.value.trim().toLowerCase();
    const filtered = q
      ? patients.filter((n) => n.toLowerCase().includes(q))
      : patients;
    renderCards(filtered);
  };

  input.addEventListener("input", doFilter);
}

// ====== 6) Carousel arrows ======
function setupArrows() {
  const rail = document.getElementById("rail");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  if (!rail || !prev || !next) return;

  function cardStep() {
    // Approximate scroll step: one card width + gap
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

// ====== 7) Init ======
document.addEventListener("DOMContentLoaded", () => {
  renderCards(patients);
  setupSearch();
  setupArrows();
});
