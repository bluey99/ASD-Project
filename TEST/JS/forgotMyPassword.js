let generatedCode = null;
let foundUser = null; // store the matched user from signup

// STEP 1: Send the verification code
async function sendCode() {
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    const error = document.getElementById("error1");

    if (email === "") {
        error.textContent = "Please enter your email.";
        return;
    }

    // Load real users from signup
    const users = JSON.parse(localStorage.getItem("moodiUsers")) || [];

    // Check if email exists
    foundUser = users.find(u => u.email.toLowerCase() === email);

    if (!foundUser) {
        error.textContent = "Email not found.";
        return;
    }

    error.textContent = "";

    // Generate 6-digit verification code
    generatedCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create 15-minute validity time
    const now = new Date();
    const validUntil = new Date(now.getTime() + (15 * 60 * 1000));
    const formattedTime = validUntil.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    // EmailJS parameters (must match your template)
    const params = {
        to_email: email,
        code: generatedCode,
        time: formattedTime
    };

    try {
        await emailjs.send("service_dtapbjg", "template_urhofx8", params);

        // Move to next step
        document.getElementById("step1").style.display = "none";
        document.getElementById("step2").style.display = "block";
        document.getElementById("sentCodeMsg").textContent =
            "A verification code has been sent to your email.";

    } catch (err) {
        console.log("EMAILJS ERROR:", JSON.stringify(err));
        error.textContent = "Error sending email. Try again.";
    }
}

// STEP 2: Verify the code
function verifyCode() {
    const code = document.getElementById("codeInput").value.trim();
    const error = document.getElementById("error2");

    if (code === "") {
        error.textContent = "Please enter the verification code.";
        return;
    }

    if (code !== generatedCode) {
        error.textContent = "Incorrect code.";
        return;
    }

    error.textContent = "";

    // Move to step 3
    document.getElementById("step2").style.display = "none";
    document.getElementById("step3").style.display = "block";

    // Show real account info
    document.getElementById("foundName").textContent = foundUser.name;
    document.getElementById("foundEmail").textContent = foundUser.email;
    document.getElementById("foundPass").textContent = foundUser.password;
}

// STEP 3: Go back to login
function goLogin() {
    window.location.href = "../HTML/login.html";
}
