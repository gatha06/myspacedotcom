// Each mood has an emoji, a label, and colors that restyle the page
const moods = [
  { emoji: "😊", label: "happy",  accent: "#f59e0b", soft: "#fef3c7" },
  { emoji: "😴", label: "sleepy", accent: "#6366f1", soft: "#e0e7ff" },
  { emoji: "🔥", label: "hyped",  accent: "#ef4444", soft: "#fee2e2" },
  { emoji: "🌧️", label: "moody",  accent: "#0ea5e9", soft: "#e0f2fe" },
  { emoji: "🌿", label: "calm",   accent: "#22c55e", soft: "#dcfce7" },
];

const moodDisplay = document.getElementById("current-mood");
const picker = document.getElementById("mood-picker");

function setMood(mood) {
  // Update the text on the profile
  moodDisplay.textContent = `${mood.emoji} ${mood.label}`;

  // Change the theme colors via CSS variables
  const root = document.documentElement;
  root.style.setProperty("--accent", mood.accent);
  root.style.setProperty("--accent-soft", mood.soft);

  // Highlight the active button
  picker.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.label === mood.label);
  });

  // Remember the choice after refresh
  try {
    localStorage.setItem("mood", mood.label);
  } catch (err) {
    console.error("Could not save mood:", err);
  }
}

// Build one button per mood
moods.forEach((mood) => {
  const btn = document.createElement("button");
  btn.textContent = mood.emoji;
  btn.title = mood.label;
  btn.dataset.label = mood.label;
  btn.addEventListener("click", () => setMood(mood));
  picker.appendChild(btn);
});

// On page load, restore the saved mood (or default to the first one)
let saved = null;
try {
  saved = localStorage.getItem("mood");
} catch (err) {
  console.error("Could not read mood:", err);
}
setMood(moods.find((m) => m.label === saved) || moods[0]);