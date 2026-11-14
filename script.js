/* =========================================================
   MOOD PICKER
   ========================================================= */

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
  moodDisplay.textContent = `${mood.emoji} ${mood.label}`;

  const root = document.documentElement;
  root.style.setProperty("--accent", mood.accent);
  root.style.setProperty("--accent-soft", mood.soft);

  picker.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.label === mood.label);
  });

  try {
    localStorage.setItem("mood", mood.label);
  } catch (err) {
    console.error("Could not save mood:", err);
  }
}

moods.forEach((mood) => {
  const btn = document.createElement("button");
  btn.textContent = mood.emoji;
  btn.title = mood.label;
  btn.dataset.label = mood.label;
  btn.addEventListener("click", () => setMood(mood));
  picker.appendChild(btn);
});

let savedMood = null;
try {
  savedMood = localStorage.getItem("mood");
} catch (err) {
  console.error("Could not read mood:", err);
}
setMood(moods.find((m) => m.label === savedMood) || moods[0]);


/* =========================================================
   NOTES
   ========================================================= */

const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("note-title");
const textInput = document.getElementById("note-text");
const notesList = document.getElementById("notes-list");

let notes = loadNotes();
let editingId = null; // id of the note currently being edited

function loadNotes() {
  try {
    const raw = localStorage.getItem("notes");
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Could not read notes:", err);
    return [];
  }
}

function saveNotes() {
  try {
    localStorage.setItem("notes", JSON.stringify(notes));
  } catch (err) {
    console.error("Could not save notes:", err);
  }
}

// Small helper to create an element with a class and text
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function renderNotes() {
  notesList.innerHTML = "";

  // Empty state
  if (notes.length === 0) {
    notesList.appendChild(el("li", "empty", "No notes yet. Write your first one above."));
    return;
  }

  notes.forEach((note) => {
    const li = el("li", "note");

    if (note.id === editingId) {
      // ----- Edit mode -----
      const titleEdit = el("input");
      titleEdit.type = "text";
      titleEdit.value = note.title;
      titleEdit.placeholder = "Title (optional)";
      titleEdit.maxLength = 60;

      const textEdit = el("textarea");
      textEdit.rows = 3;
      textEdit.value = note.text;

      const actions = el("div", "note-actions");

      const saveBtn = el("button", "btn small", "Save changes");
      saveBtn.type = "button";
      saveBtn.addEventListener("click", () => {
        const newText = textEdit.value.trim();
        if (!newText) return; // don't allow an empty note
        note.title = titleEdit.value.trim();
        note.text = newText;
        editingId = null;
        saveNotes();
        renderNotes();
      });

      const cancelBtn = el("button", "btn ghost small", "Cancel");
      cancelBtn.type = "button";
      cancelBtn.addEventListener("click", () => {
        editingId = null;
        renderNotes();
      });

      actions.append(saveBtn, cancelBtn);
      li.append(titleEdit, textEdit, actions);
    } else {
      // ----- Normal mode -----
      if (note.title) li.appendChild(el("h3", "", note.title));
      li.appendChild(el("p", "", note.text));
      li.appendChild(el("time", "", formatDate(note.created)));

      const actions = el("div", "note-actions");

      const editBtn = el("button", "btn ghost small", "Edit");
      editBtn.type = "button";
      editBtn.addEventListener("click", () => {
        editingId = note.id;
        renderNotes();
      });

      const deleteBtn = el("button", "btn ghost small", "Delete");
      deleteBtn.type = "button";
      deleteBtn.addEventListener("click", () => {
        if (!confirm("Delete this note?")) return;
        notes = notes.filter((n) => n.id !== note.id);
        saveNotes();
        renderNotes();
      });

      actions.append(editBtn, deleteBtn);
      li.appendChild(actions);
    }

    notesList.appendChild(li);
  });
}

// Add a new note
noteForm.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the page from reloading

  const text = textInput.value.trim();
  if (!text) return;

  notes.unshift({
    id: Date.now(),
    title: titleInput.value.trim(),
    text: text,
    created: Date.now(),
  });

  saveNotes();
  renderNotes();
  noteForm.reset();
  titleInput.focus();
});

renderNotes();