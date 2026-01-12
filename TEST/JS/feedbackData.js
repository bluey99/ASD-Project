//feedbackData.js
// ==========================================
// TEMP DATABASE FOR FEEDBACKS (with storage)
// ==========================================

const FEEDBACK_STORAGE_KEY = "moodiFeedbackDB";
//localStorage.clear();
let feedbackDB = [];

// Load from localStorage or default
function loadFeedbackDB() {
  const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
  if (stored) {
    feedbackDB = JSON.parse(stored);
    return;
  }

  // Default examples
  feedbackDB = [
    {
      id: Date.now(),
      title: "Breathing exercise update",
      date: "2025-12-09",
      time: "17:45",
      description:
        "He showed less anxiety after the 3-minute breathing break—keep this routine.",
    },
    {
      id: Date.now() + 1,
      title: "Improved participation",
      date: "2025-12-08",
      time: "10:20",
      description:
        "Emily participated more actively today and initiated two conversations.",
    },
    {
      id: Date.now() + 2,
      title: "Calming tools usage",
      date: "2025-12-07",
      time: "14:10",
      description:
        "She used the ‘color breathing’ calming tool without being asked.",
    },
    {
      id: Date.now() + 3,
      title: "Lower frustration level",
      date: "2025-12-06",
      time: "18:40",
      description:
        "He completed the activity with less frustration and good focus.",
    },
    {
      id: Date.now() + 4,
      title: "Positive social interaction",
      date: "2025-12-05",
      time: "09:50",
      description:
        "She initiated play with a peer and maintained positive interaction.",
    },
    {
      id: Date.now() + 5,
      title: "Task follow-through",
      date: "2025-12-04",
      time: "16:05",
      description: "Completed the weekly task independently.",
    }
  ];

  saveFeedbackDB();
}

// Save to localStorage
function saveFeedbackDB() {
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedbackDB));
}
