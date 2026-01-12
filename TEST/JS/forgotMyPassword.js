// ../JS/forgotMyPassword.js
import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ hash helper
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// safer $
function $(id) {
  const el = document.getElementById(id);
  if (!el) console.warn("Missing element id:", id);
  return el;
}

let generatedCode = null;
let expiresAtMs = null;
let therapistDocId = null;

function showStep(n) {
  if ($("step1")) $("step1").style.display = (n === 1) ? "block" : "none";
  if ($("step2")) $("step2").style.display = (n === 2) ? "block" : "none";
  if ($("step3")) $("step3").style.display = (n === 3) ? "block" : "none";
}

function gen8DigitCode() {
  return Math.floor(Math.random() * 100000000).toString().padStart(8, "0");
}

// STEP 1: send code
async function sendResetEmail() {
  const email = ($("emailInput")?.value || "").trim().toLowerCase();

  if ($("error1")) $("error1").textContent = "";
  if ($("sentCodeMsg")) $("sentCodeMsg").textContent = "";
  if ($("info1")) $("info1").textContent = "";

  if (!email) {
    if ($("error1")) $("error1").textContent = "Please enter your email.";
    return;
  }

  try {
    // find therapist by email
    const qRef = query(collection(db, "therapists"), where("email", "==", email));
    const snap = await getDocs(qRef);

    if (snap.empty) {
      if ($("error1")) $("error1").textContent = "Email not found.";
      return;
    }

    therapistDocId = snap.docs[0].id;

    generatedCode = gen8DigitCode();
    expiresAtMs = Date.now() + 5 * 60 * 1000;

    const validUntil = new Date(expiresAtMs).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    // send email (EmailJS)
    await emailjs.send("service_dtapbjg", "template_urhofx8", {
      to_email: email,
      code: generatedCode,
      time: validUntil
    });

    if ($("sentCodeMsg")) $("sentCodeMsg").textContent =
      `Code sent ✅ It will expire at ${validUntil}.`;

    showStep(2);

  } catch (err) {
    console.error(err);
    if ($("error1")) $("error1").textContent = "Error sending email. Try again.";
  }
}

// STEP 2: verify code
async function verifyCode() {
  const code = ($("codeInput")?.value || "").trim();
  if ($("error2")) $("error2").textContent = "";

  if (!code) {
    if ($("error2")) $("error2").textContent = "Please enter the verification code.";
    return;
  }

  if (!generatedCode || !expiresAtMs || !therapistDocId) {
    if ($("error2")) $("error2").textContent = "Please send a new code.";
    return;
  }

  if (Date.now() > expiresAtMs) {
    if ($("error2")) $("error2").textContent = "Code expired. Send a new code.";
    return;
  }

  if (code !== generatedCode) {
    if ($("error2")) $("error2").textContent = "Incorrect code.";
    return;
  }

  showStep(3);
}

// STEP 3: reset password (update therapists.passwordHash)
async function resetPassword() {
  const newPass = $("newPass")?.value || "";
  const confirm = $("confirmPass")?.value || "";

  if ($("error3")) $("error3").textContent = "";
  if ($("success3")) $("success3").textContent = "";

  if (!newPass || !confirm) {
    if ($("error3")) $("error3").textContent = "Please fill both password fields.";
    return;
  }

  if (newPass.length < 6) {
    if ($("error3")) $("error3").textContent = "Password must be at least 6 characters.";
    return;
  }

  if (newPass !== confirm) {
    if ($("error3")) $("error3").textContent = "Passwords do not match.";
    return;
  }

  if (!therapistDocId) {
    if ($("error3")) $("error3").textContent = "Missing therapist. Restart the process.";
    return;
  }

  try {
    const newHash = await sha256(newPass);

    await updateDoc(doc(db, "therapists", therapistDocId), {
      passwordHash: newHash,
      passwordUpdatedAt: serverTimestamp()
    });

    if ($("success3")) $("success3").textContent =
      "Password updated ✅ You can now login.";

    // clear state
    generatedCode = null;
    expiresAtMs = null;

  } catch (err) {
    console.error(err);
    if ($("error3")) $("error3").textContent = "Failed to update password. Check rules.";
  }
}

// expose to inline onclick
window.sendResetEmail = sendResetEmail;
window.verifyCode = verifyCode;
window.resetPassword = resetPassword;

// start at step1
showStep(1);
