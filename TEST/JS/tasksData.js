// Load from storage OR use defaults



var tasks = JSON.parse(localStorage.getItem("tasks")) || [
  {
    date: "22/6/2025",
    title: "Talking to a stranger",
    assignedBy: "me",
    status: "pending",
    mood: "--",
    intensity: "--",
    note: "--"
  },
  {
    date: "15/6/2025",
    title: "Neighborhood Walk",
    assignedBy: "parent",
    status: "done",
    mood: "happy",
    intensity: "4/5",
    note: "It was quiet and I liked the breeze"
  },
  {
    date: "10/6/2025",
    title: "Draw your feelings",
    assignedBy: "me",
    status: "pending",
    mood: "--",
    intensity: "--",
    note: "--"
  },
  {
    date: "5/6/2025",
    title: "Playtime with a friend",
    assignedBy: "parent",
    status: "done",
    mood: "excited",
    intensity: "5/5",
    note: "Had a great time"
  }
];
