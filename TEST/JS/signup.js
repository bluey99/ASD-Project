// ../JS/signup.js
import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  serverTimestamp,
  runTransaction,
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
  const form = document.getElementById("signupForm");

  // ======== Password toggles (keep yours if you want) ========
  const passwordField = document.getElementById("passwordField");
  const togglePassword = document.getElementById("togglePassword");
  const confirmPasswordField = document.getElementById("confirmPasswordField");
  const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

  function setupToggle(inputEl, toggleEl) {
    if (!inputEl || !toggleEl) return;
    toggleEl.addEventListener("click", () => {
      const isPassword = inputEl.type === "password";
      inputEl.type = isPassword ? "text" : "password";
      const icon = toggleEl.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
      }
    });
  }
  setupToggle(passwordField, togglePassword);
  setupToggle(confirmPasswordField, toggleConfirmPassword);

  const showError = (name, message) => {
    const el = document.querySelector(`.field-error[data-for="${name}"]`);
    if (el) el.textContent = message || "";
  };

  const clearAllErrors = () => {
    ["name", "email", "password", "confirmPassword", "experience", "terms"].forEach((n) =>
      showError(n, "")
    );
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    const fieldOfWork = form.field.value || "";
    const yearsOfExperience = Number(form.experience.value);
    const terms = form.terms.checked;

    let valid = true;

    if (!name) { showError("name", "Please enter your name."); valid = false; }
    if (!email) { showError("email", "Please enter your email."); valid = false; }

    if (!password || password.length < 6) {
      showError("password", "Password must be at least 6 characters.");
      valid = false;
    }

    if (confirmPassword !== password) {
      showError("confirmPassword", "Passwords do not match.");
      valid = false;
    }

    if (Number.isNaN(yearsOfExperience) || yearsOfExperience < 0) {
      showError("experience", "Experience must be a positive number.");
      valid = false;
    }

    if (!terms) {
      showError("terms", "You must agree to the terms.");
      valid = false;
    }

    if (!valid) return;

    try {
      // ✅ prevent duplicate email in therapists
      const qEmail = query(collection(db, "therapists"), where("email", "==", email));
      const emailSnap = await getDocs(qEmail);
      if (!emailSnap.empty) {
        showError("email", "This email is already registered.");
        return;
      }

      // 1) Generate therapistId: th1, th2, th3...
      const counterRef = doc(db, "counters", "therapists");

      const therapistId = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const current = snap.exists() ? (snap.data().seq || 0) : 0;
        const next = current + 1;

        if (!snap.exists()) tx.set(counterRef, { seq: next });
        else tx.update(counterRef, { seq: next });

        return `th${next}`;
      });

      // 2) Hash password
      const passwordHash = await sha256(password);

      // 3) Save in therapists collection
      await setDoc(doc(db, "therapists", therapistId), {
        therapistId,
        name,
        email,
        fieldOfWork,
        yearsOfExperience,
        role: "therapist",
        passwordHash,
        createdAt: serverTimestamp(),
        passwordUpdatedAt: serverTimestamp()
      });

      alert(`Signed up! Your Therapist ID is ${therapistId}`);
      window.location.href = "login.html";

    } catch (err) {
      console.error(err);
      alert(err?.message || "Signup failed. Check console.");
    }
  });
});
