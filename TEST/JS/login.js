// ../JS/login.js
import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ hash helper (no extra file)
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("loginEmail");
  const passwordEl = document.getElementById("passwordField");
  const errorEl = document.getElementById("loginError");

  const togglePassword = document.getElementById("togglePassword");
  if (togglePassword && passwordEl) {
    togglePassword.addEventListener("click", () => {
      const isPassword = passwordEl.type === "password";
      passwordEl.type = isPassword ? "text" : "password";
      const icon = togglePassword.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const email = (emailEl.value || "").trim().toLowerCase();
    const password = passwordEl.value || "";

    if (!email || !password) {
      errorEl.textContent = "Please fill in all fields.";
      return;
    }

    try {
      const qRef = query(collection(db, "therapists"), where("email", "==", email));
      const snap = await getDocs(qRef);

      if (snap.empty) {
        errorEl.textContent = "Wrong email or password.";
        return;
      }

      const therapistDoc = snap.docs[0];
      const therapistData = therapistDoc.data();

      const inputHash = await sha256(password);
      if (inputHash !== therapistData.passwordHash) {
        errorEl.textContent = "Wrong email or password.";
        return;
      }

      localStorage.setItem("therapistId", therapistDoc.id);
      localStorage.setItem("moodiTherapist", JSON.stringify({
        therapistId: therapistDoc.id,
        ...therapistData
      }));

      window.location.href = "index.html";

    } catch (err) {
      console.error(err);
      errorEl.textContent = "Login failed. Check console.";
    }
  });
});
