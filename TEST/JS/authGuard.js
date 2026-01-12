// TEST/JS/authGuard.js
// Blocks access to protected pages unless therapist is logged in.
// Also handles logout links (.logout)

(function () {
  const PUBLIC_PAGES = ["login.html", "signup.html"];

  function currentPage() {
    return (location.pathname.split("/").pop() || "").toLowerCase();
  }

  function getTherapistId() {
    // Preferred key
    const direct = localStorage.getItem("therapistId");
    if (direct) return direct;

    // Backward compatibility: moodiTherapist object
    const raw = localStorage.getItem("moodiTherapist");
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj?.docId) return obj.docId;
      } catch {}
    }

    return null;
  }

  function requireLogin() {
    const page = currentPage();
    if (PUBLIC_PAGES.includes(page)) return; // allow

    const tid = getTherapistId();
    if (!tid) {
      // redirect to login
      window.location.replace("login.html");
    }
  }

  function wireLogout() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a.logout");
      if (!a) return;

      e.preventDefault();
      localStorage.removeItem("therapistId");
      localStorage.removeItem("moodiTherapist");
      localStorage.removeItem("selectedChildId"); // optional
      window.location.href = "login.html";
    });
  }

  requireLogin();
  wireLogout();
})();
