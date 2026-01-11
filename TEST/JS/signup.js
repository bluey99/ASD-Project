// ../JS/signup.js
import { auth, db } from "./firebase.js";

import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");

  // ======== Password Eye Toggle (works 100%) ========
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

  // ======== Errors helper ========
  const showError = (name, message) => {
    const el = document.querySelector(`.field-error[data-for="${name}"]`);
    if (el) el.textContent = message || "";
  };

  const clearAllErrors = () => {
    ["name", "email", "password", "confirmPassword", "experience", "terms"].forEach((n) =>
      showError(n, "")
    );
  };

  // ======== Signup Submit ========
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    // Read values
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    const fieldOfWork = form.field.value || "";
    const yearsOfExperience = Number(form.experience.value);
    const terms = form.terms.checked;

    // Validation
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
      // 1) Create Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const authUid = cred.user.uid;

      // 2) Generate therapistId: th1, th2, th3... (transaction)
      const counterRef = doc(db, "counters", "therapists");

      const therapistId = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);

        let next = 1;

        if (!snap.exists()) {
          tx.set(counterRef, { seq: 1 });
          next = 1;
        } else {
          const current = snap.data().seq || 0;
          next = current + 1;
          tx.update(counterRef, { seq: next });
        }

        return `th${next}`;
      });

      // 3) Save profile in Firestore using therapistId as Doc ID
      await setDoc(doc(db, "therapists", therapistId), {
        therapistId,                 // ✅ field too
        authUid,                     // ✅ link to auth user
        name,
        email,
        fieldOfWork,
        yearsOfExperience,
        role: "therapist",
        createdAt: serverTimestamp()
      });

      alert(`Signed up! Your Therapist ID is ${therapistId}`);
      window.location.href = "login.html";

    } catch (err) {
      console.error(err);

      if (err.code === "auth/email-already-in-use") {
        showError("email", "This email is already registered.");
      } else if (err.code === "auth/invalid-email") {
        showError("email", "Invalid email address.");
      } else if (err.code === "auth/weak-password") {
        showError("password", "Weak password (min 6 chars).");
      } else {
        alert(err.message);
      }
    }
  });
});
