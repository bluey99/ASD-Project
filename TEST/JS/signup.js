// ../JS/signup.js
import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  if (!form) {
    console.error("❌ signupForm not found");
    return;
  }

  const showError = (name, message) => {
    const el = document.querySelector(`.field-error[data-for="${name}"]`);
    if (el) el.textContent = message || "";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Clear errors
    ["name", "email", "password", "confirmPassword", "experience", "terms"]
      .forEach(n => showError(n, ""));

    // Read values
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    const fieldOfWork = form.field.value || ""; // select
    const yearsOfExperience = Number(form.experience.value);
    const terms = form.terms.checked;

    // Validation
    let valid = true;

    if (!name) { showError("name", "Please enter your name."); valid = false; }
    if (!email) { showError("email", "Please enter your email."); valid = false; }
    if (!password || password.length < 6) { showError("password", "Password must be at least 6 characters."); valid = false; }
    if (confirmPassword !== password) { showError("confirmPassword", "Passwords do not match."); valid = false; }
    if (Number.isNaN(yearsOfExperience) || yearsOfExperience < 0) { showError("experience", "Experience must be a positive number."); valid = false; }
    if (!terms) { showError("terms", "You must agree to the terms."); valid = false; }

    if (!valid) return;

    try {
      console.log("🚀 Creating auth user...");
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      console.log("✅ Auth created:", uid);

      console.log("💾 Writing Firestore therapist profile...");
      await setDoc(doc(db, "therapists", uid), {
        uid,
        name,
        email,
        fieldOfWork,
        yearsOfExperience,
        role: "therapist",
        createdAt: serverTimestamp()
      });
      console.log("✅ Firestore write OK");

      alert("Signed up successfully!");
      window.location.href = "login.html";

    } catch (err) {
      console.error("❌ Signup error:", err);

      if (err.code === "auth/email-already-in-use") {
        showError("email", "This email is already registered.");
      } else if (err.code === "auth/invalid-email") {
        showError("email", "Invalid email address.");
      } else if (err.code === "auth/weak-password") {
        showError("password", "Weak password (min 6 chars).");
      } else if (err.code === "permission-denied") {
        alert("Firestore rules blocked the write. Add therapists rule in Firestore Rules.");
      } else {
        alert(err.message);
      }
    }
  });
});
