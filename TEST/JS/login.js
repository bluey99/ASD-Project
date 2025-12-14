document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const loginInputEl = document.getElementById("loginEmail");
    const passwordField = document.getElementById("passwordField");
    const togglePassword = document.getElementById("togglePassword");
    const errorEl = document.getElementById("loginError");

    if (!form) return; // safety

    // --- Handle login submit ---
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const loginInput = loginInputEl.value.trim().toLowerCase();
        const password = passwordField.value;
        errorEl.textContent = ""; // clear previous error

        // Empty fields check
        if (!loginInput || !password) {
            errorEl.textContent = "Please fill in all fields.";
            return;
        }

        // Load users list saved from signup.js
        const users = JSON.parse(localStorage.getItem("moodiUsers")) || [];

        // Find user by email OR name (case-insensitive)
        const foundUser = users.find(u =>
            u.email.toLowerCase() === loginInput ||
            u.name.toLowerCase() === loginInput
        );

        if (!foundUser) {
            errorEl.textContent = "User does not exist.";
            return;
        }

        // Check password
        if (password !== foundUser.password) {
            errorEl.textContent = "Incorrect password.";
            return;
        }

        // Save logged-in user for later use (optional)
        localStorage.setItem("moodiLoggedUser", JSON.stringify(foundUser));

        // Redirect to home/dashboard
        window.location.href = "../HTML/index.html";
    });

    // --- Toggle password visibility ---
    if (togglePassword && passwordField) {
        togglePassword.addEventListener("click", () => {
            const isPassword = passwordField.getAttribute("type") === "password";
            passwordField.setAttribute("type", isPassword ? "text" : "password");

            // Switch FontAwesome icon
            const icon = togglePassword.querySelector("i");
            icon.classList.toggle("fa-eye");
            icon.classList.toggle("fa-eye-slash");
        });
    }
});
