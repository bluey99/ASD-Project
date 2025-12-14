document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");

  const showError = (name, message) => {
    const el = document.querySelector(`.field-error[data-for="${name}"]`);
    if (el) el.textContent = message || "";
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Clear errors
    ["name", "email", "password", "confirmPassword", "experience", "terms"]
      .forEach(n => showError(n, ""));

    let valid = true;

    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    const field = form.field.value;
    const experience = form.experience.value;
    const terms = form.terms.checked;

    // VALIDATION
    if (!name) {
      showError("name", "Please enter your name.");
      valid = false;
    }

    if (!email) {
      showError("email", "Please enter your email.");
      valid = false;
    }

    if (!password || password.length < 6) {
      showError("password", "Password must be at least 6 characters.");
      valid = false;
    }

    if (confirmPassword !== password) {
      showError("confirmPassword", "Passwords do not match.");
      valid = false;
    }

    if (experience === "" || Number(experience) < 0) {
      showError("experience", "Experience must be a positive number.");
      valid = false;
    }

    if (!terms) {
      showError("terms", "You must agree to the terms.");
      valid = false;
    }

    if (!valid) return;

    // LOAD EXISTING USERS
    let users = JSON.parse(localStorage.getItem("moodiUsers")) || [];

    // CHECK IF Name ALREADY EXISTS
    if (users.some(u => u.name === name)) {
      showError("name", "**this name is already registered.");
      return;
    }

    // CHECK IF EMAIL ALREADY EXISTS
    if (users.some(u => u.email === email)) {
      showError("email", "*this email is already registered.");
      return;
    }

    // CREATE TEMP DATE
    const now = new Date();
    const createdAt =
      now.getFullYear() +
      "-" + String(now.getMonth() + 1).padStart(2, "0") +
      "-" + String(now.getDate()).padStart(2, "0") +
      " " + String(now.getHours()).padStart(2, "0") +
      ":" + String(now.getMinutes()).padStart(2, "0");

    // CREATE NEW USER OBJECT
    const newUser = {
      name,
      email,
      password,
      field,
      experience,
      createdAt
    };

    


    // SAVE USER
    users.push(newUser);
    localStorage.setItem("moodiUsers", JSON.stringify(users));

    // REDIRECT TO LOGIN
    window.location.href = "login.html";
  });
});


const passwordField = document.getElementById('passwordField');
const togglePassword = document.getElementById('togglePassword');

togglePassword.addEventListener('click', function() {
  // Toggle field type
  const type = passwordField.getAttribute('type') === 'password'
    ? 'text'
    : 'password';
    
  passwordField.setAttribute('type', type);

  // Toggle FontAwesome icon
  this.querySelector('i').classList.toggle('fa-eye');
  this.querySelector('i').classList.toggle('fa-eye-slash');
});

//confirm password "eye"

const confirmPasswordField = document.getElementById('confirmPasswordField');
const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

toggleConfirmPassword.addEventListener('click', function() {
  const type = confirmPasswordField.getAttribute('type') === 'password'
    ? 'text'
    : 'password';

  confirmPasswordField.setAttribute('type', type);

  // Switch eye icon
  this.querySelector('i').classList.toggle('fa-eye');
  this.querySelector('i').classList.toggle('fa-eye-slash');
});
