// ===============================================
// FEEDBACK PAGE LOGIC (View, Add, Edit, Delete)
// ===============================================

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel");
  if (!panel) return;

  loadFeedbackDB();

  let sortDirection = "desc"; // default: newest → oldest

  // ----------------------------- Helper Functions -----------------------------

  function setActiveTab() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((t) => t.classList.remove("active"));
    const fbTab = document.querySelector(".tab[data-tab='feedbacks']");
    if (fbTab) fbTab.classList.add("active");
  }

  function applyFilters(searchDate) {
    let list = [...feedbackDB];

    if (searchDate) {
      list = list.filter((fb) => fb.date === searchDate);
    }

    list.sort((a, b) => {
      const ad = a.date + " " + a.time;
      const bd = b.date + " " + b.time;

      return sortDirection === "asc"
        ? ad.localeCompare(bd)
        : bd.localeCompare(ad);
    });

    return list;
  }

  // ----------------------------- VIEW FEEDBACKS PAGE -----------------------------

  function renderViewFeedbacks() {
    setActiveTab();

    panel.innerHTML = `
      <div class="tasks-container">
        <h2>feedbacks</h2>

        <div class="filter-bar">
          <button class="filter-btn" id="fbFilterBtn">Sort by date</button>

          <div class="filter-menu" id="fbFilterMenu">
            <button data-sort="newest">Newest → Oldest</button>
            <button data-sort="oldest">Oldest → Newest</button>
          </div>

          <input type="date" id="fbSearchDate"
            style="margin-left: 10px; padding: 4px 8px; border-radius: 6px;
            border: 1px solid #cbd5e1; font-size: 14px;" />
        </div>

        <table class="tasks-table" id="fbTable">
          <thead>
            <tr>
              <th id="fbDateSort" style="cursor:pointer;">date</th>
              <th>title</th>
              <th>time</th>
              <th>description</th>
              <th>actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    const filterBtn = document.getElementById("fbFilterBtn");
    const filterMenu = document.getElementById("fbFilterMenu");
    const searchInput = document.getElementById("fbSearchDate");
    const tbody = document.querySelector("#fbTable tbody");
    const dateSortHeader = document.getElementById("fbDateSort");

    let searchDate = "";

    filterBtn.addEventListener("click", () => {
      filterMenu.classList.toggle("show");
    });

    filterMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-sort]");
      if (!btn) return;

      const sortType = btn.getAttribute("data-sort");

      if (sortType === "newest") sortDirection = "desc";
      else sortDirection = "asc";

      filterMenu.classList.remove("show");
      renderTable();
    });

    searchInput.addEventListener("change", () => {
      searchDate = searchInput.value;
      renderTable();
    });

    dateSortHeader.addEventListener("click", () => {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
      renderTable();
    });

    tbody.addEventListener("click", (e) => {
      const editLink = e.target.closest("a[data-edit-id]");
      const delLink = e.target.closest("a[data-delete-id]");

      if (editLink) {
        const id = editLink.getAttribute("data-edit-id");
        renderAddFeedback(id);
      }

      if (delLink) {
        const id = delLink.getAttribute("data-delete-id");
        if (confirm("Are you sure you want to delete this feedback?")) {
          const index = feedbackDB.findIndex((f) => String(f.id) === String(id));
          if (index !== -1) {
            feedbackDB.splice(index, 1);
            saveFeedbackDB();
            renderTable();
          }
        }
      }
    });

    function renderTable() {
      const list = applyFilters(searchDate);
      tbody.innerHTML = "";

      if (!list.length) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="5">No feedback found.</td>`;
        tbody.appendChild(row);
        return;
      }

      list.forEach((fb) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fb.date}</td>
          <td>${fb.title}</td>
          <td>${fb.time}</td>
          <td>${fb.description}</td>
          <td class="feedback-actions">
            <a href="#" data-edit-id="${fb.id}">edit</a> /
            <a href="#" data-delete-id="${fb.id}">delete</a>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    renderTable();
  }

  // ----------------------------- ADD / EDIT FEEDBACK PAGE -----------------------------

  function renderAddFeedback(editId = null) {
    setActiveTab();

    let editingFb = null;
    if (editId) editingFb = feedbackDB.find((f) => String(f.id) === String(editId));

    const now = new Date();
    const defaultDate = now.toISOString().split("T")[0];
    const defaultTime = now.toTimeString().split(":").slice(0, 2).join(":");

    panel.innerHTML = `
      <div class="add-task-container">
        <h2>${editingFb ? "edit feedback" : "add feedback"}</h2>

        <form class="add-task-form" id="fbForm">
          
          <div>
            <label>title :</label>
            <input type="text" id="fbTitle" value="${editingFb ? editingFb.title : ""}" required>
          </div>

          <div>
            <label>date :</label>
            <input type="date" id="fbDate" required
              value="${editingFb ? editingFb.date : defaultDate}">
          </div>

          <div>
            <label>time :</label>
            <input type="time" id="fbTime" required
              value="${editingFb ? editingFb.time : defaultTime}">
          </div>

          <div>
            <label>description :</label>
            <textarea id="fbDesc" required>${editingFb ? editingFb.description : ""}</textarea>
          </div>

          <div style="display:flex; gap:12px;">
            <button type="submit">${editingFb ? "Save changes" : "Add"}</button>
            <button type="button" id="cancelFb">Cancel</button>
          </div>

        </form>
      </div>
    `;

    const cancelBtn = document.getElementById("cancelFb");
    const form = document.getElementById("fbForm");

    cancelBtn.addEventListener("click", () => renderViewFeedbacks());

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const title = document.getElementById("fbTitle").value.trim();
      const date = document.getElementById("fbDate").value;
      const time = document.getElementById("fbTime").value;
      const desc = document.getElementById("fbDesc").value.trim();

      if (!title || !date || !time || !desc) {
        alert("Please fill in all fields.");
        return;
      }

      if (editingFb) {
        editingFb.title = title;
        editingFb.date = date;
        editingFb.time = time;
        editingFb.description = desc;

        saveFeedbackDB();
        alert("Feedback updated successfully.");
        renderViewFeedbacks();
        return;
      }

      feedbackDB.push({
        id: Date.now(),
        title,
        date,
        time,
        description: desc,
      });

      saveFeedbackDB();
      renderViewFeedbacks();
    });
  }

  // ----------------------------- DROPDOWN LISTENERS -----------------------------

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='viewFeedbacks']")) {
      renderViewFeedbacks();
    }
    if (e.target.closest("[data-action='addFeedback']")) {
      renderAddFeedback();
    }
  });

  const fbTab = document.querySelector(".tab[data-tab='feedbacks']");
  if (fbTab) fbTab.addEventListener("click", () => renderViewFeedbacks());
});
