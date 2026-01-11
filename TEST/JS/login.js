// ../JS/login.js
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
      icon.classList.toggle("fa-eye");
      icon.classList.toggle("fa-eye-slash");
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const email = emailEl.value.trim().toLowerCase();
    const password = passwordEl.value;

    if (!email || !password) {
      errorEl.textContent = "Please fill in all fields.";
      return;
    }

    try {
      // 1) Auth login
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 2) Find therapist profile by authUid
      const q = query(collection(db, "therapists"), where("authUid", "==", uid));
      const snap = await getDocs(q);

      if (snap.empty) {
        errorEl.textContent = "No therapist profile found for this account.";
        return;
      }

      // 3) Save therapist profile locally (optional)
      const therapistDoc = snap.docs[0];
      const therapistData = therapistDoc.data();

      localStorage.setItem("moodiTherapist", JSON.stringify({
        docId: therapistDoc.id,     // th2
        ...therapistData
      }));

      // 4) Redirect
      window.location.href = "index.html";

    } catch (err) {
      console.error(err);

      if (err.code === "auth/invalid-credential") {
        errorEl.textContent = "Wrong email or password.";
      } else if (err.code === "auth/user-not-found") {
        errorEl.textContent = "User not found.";
      } else if (err.code === "auth/wrong-password") {
        errorEl.textContent = "Wrong password.";
      } else {
        errorEl.textContent = err.message;
      }
    }
  });
});

