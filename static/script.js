/* =========================================================
   SHARED HELPERS
   ========================================================= */

// Small helper to create an element with a class and text
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Read and write JSON in localStorage safely
function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Could not read ${key}:`, err);
    return fallback;
  }
}

// Returns true if saved, false if it failed (for example, storage is full)
function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Could not save ${key}:`, err);
    return false;
  }
}


/* =========================================================
   MOOD PICKER
   ========================================================= */

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

  saveData("mood", mood.label);
}

moods.forEach((mood) => {
  const btn = document.createElement("button");
  btn.textContent = mood.emoji;
  btn.title = mood.label;
  btn.dataset.label = mood.label;
  btn.addEventListener("click", () => setMood(mood));
  picker.appendChild(btn);
});

const savedMood = loadData("mood", null);
setMood(moods.find((m) => m.label === savedMood) || moods[0]);


/* =========================================================
   NOTES (saved in the database through the Flask API)
   ========================================================= */

const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("note-title");
const textInput = document.getElementById("note-text");
const notesList = document.getElementById("notes-list");

// A small message area under the form for errors
const notesError = el("p", "form-error");
notesError.setAttribute("role", "alert");
noteForm.after(notesError);

let notes = [];

// Talk to the Flask server
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function loadNotes() {
  try {
    const blocks = await api("/api/blocks");
    notes = blocks.filter((b) => b.type === "note");
    notesError.textContent = "";
  } catch (err) {
    console.error(err);
    notes = [];
    notesError.textContent = "Could not load notes. Is the server running?";
  }
  renderNotes();
}

function renderNotes() {
  notesList.innerHTML = "";

  if (notes.length === 0) {
    notesList.appendChild(el("li", "empty", "No notes yet. Write your first one above."));
    return;
  }

  notes.forEach((note) => {
    const li = el("li", "note");

    if (note.title) li.appendChild(el("h3", "", note.title));
    li.appendChild(el("p", "", note.content));
    li.appendChild(el("time", "", formatDate(note.created_at.replace(" ", "T") + "Z")));

    const actions = el("div", "note-actions");

    const deleteBtn = el("button", "btn ghost small", "Delete");
    deleteBtn.type = "button";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this note?")) return;
      try {
        await api(`/api/blocks/${note.id}`, { method: "DELETE" });
        notes = notes.filter((n) => n.id !== note.id);
        renderNotes();
      } catch (err) {
        notesError.textContent = err.message;
      }
    });

    actions.appendChild(deleteBtn);
    li.appendChild(actions);
    notesList.appendChild(li);
  });
}

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const content = textInput.value.trim();
  if (!content) return;

  try {
    const block = await api("/api/blocks", {
      method: "POST",
      body: JSON.stringify({
        type: "note",
        title: titleInput.value.trim(),
        content: content,
      }),
    });
    notesError.textContent = "";
    notes.unshift(block);
    renderNotes();
    noteForm.reset();
    titleInput.focus();
  } catch (err) {
    notesError.textContent = err.message;
  }
});

loadNotes();


/* =========================================================
   GALLERY (still saved in the browser for now)
   ========================================================= */

const photoInput = document.getElementById("photo-input");
const galleryError = document.getElementById("gallery-error");
const galleryGrid = document.getElementById("gallery-grid");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");

let photos = loadData("photos", []);

// Shrink a photo before saving. Browser storage is small (about 5MB),
// so we scale each image down and save it as a compressed JPEG.
function resizeImage(file, maxSize = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function openLightbox(photo, index) {
  lightboxImg.src = photo.src;
  lightboxImg.alt = `Gallery photo ${index + 1}`;
  lightbox.showModal(); // Esc closes it automatically
}

function renderGallery() {
  galleryGrid.innerHTML = "";

  if (photos.length === 0) {
    galleryGrid.appendChild(el("li", "empty", "No photos yet. Add your first one above."));
    return;
  }

  photos.forEach((photo, index) => {
    const li = el("li", "photo");

    const openBtn = el("button", "open-btn");
    openBtn.type = "button";
    openBtn.setAttribute("aria-label", `View photo ${index + 1}`);

    const img = el("img");
    img.src = photo.src;
    img.alt = `Gallery photo ${index + 1}`;
    openBtn.appendChild(img);
    openBtn.addEventListener("click", () => openLightbox(photo, index));

    const deleteBtn = el("button", "delete-btn", "✕");
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", `Delete photo ${index + 1}`);
    deleteBtn.addEventListener("click", () => {
      if (!confirm("Delete this photo?")) return;
      photos = photos.filter((p) => p.id !== photo.id);
      saveData("photos", photos);
      renderGallery();
    });

    li.append(openBtn, deleteBtn);
    galleryGrid.appendChild(li);
  });
}

photoInput.addEventListener("change", async () => {
  galleryError.textContent = "";
  const files = Array.from(photoInput.files);
  let skipped = 0;

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      skipped++;
      continue;
    }

    try {
      const src = await resizeImage(file);
      const photo = { id: Date.now() + Math.random(), src: src };
      photos.unshift(photo);

      // If storage is full, undo this photo and stop
      if (!saveData("photos", photos)) {
        photos.shift();
        galleryError.textContent = "Storage is full. Delete a few photos and try again.";
        break;
      }
    } catch (err) {
      console.error(err);
      skipped++;
    }
  }

  if (skipped > 0 && !galleryError.textContent) {
    galleryError.textContent = `${skipped} file(s) skipped because they weren't valid images.`;
  }

  photoInput.value = ""; // lets you pick the same file again later
  renderGallery();
});

// Close the viewer with the ✕ button or by clicking the dark background
lightboxClose.addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

renderGallery();


/* =========================================================
   SOCIALS (still saved in the browser for now)
   ========================================================= */

const socialForm = document.getElementById("social-form");
const platformSelect = document.getElementById("social-platform");
const urlInput = document.getElementById("social-url");
const socialError = document.getElementById("social-error");
const socialList = document.getElementById("social-list");


let socials = loadData("socials", []);

// Turn what the user typed into a safe URL, or return null if it's not valid.
// Only http and https links are allowed (this blocks things like "javascript:").
function cleanUrl(input) {
  let value = input.trim();
  if (!value) return null;

  // Allow "github.com/me" by adding https:// when no scheme is given
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    value = "https://" + value;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null; // needs a real domain
    return url.href;
  } catch (err) {
    return null;
  }
}

function renderSocials() {
  socialList.innerHTML = "";

  if (socials.length === 0) {
    socialList.appendChild(el("li", "empty", "No links yet. Add your first one above."));
    return;
  }

  socials.forEach((item) => {
    const li = el("li", "social-chip");

    const link = el("a", "", `${platformIcons[item.platform] || "🔗"} ${item.platform}`);
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const removeBtn = el("button", "", "✕");
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${item.platform} link`);
    removeBtn.addEventListener("click", () => {
      socials = socials.filter((s) => s.id !== item.id);
      saveData("socials", socials);
      renderSocials();
    });

    li.append(link, removeBtn);
    socialList.appendChild(li);
  });
}

socialForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const url = cleanUrl(urlInput.value);
  if (!url) {
    socialError.textContent = "That doesn't look like a valid link. Try something like github.com/yourname.";
    return;
  }

  socialError.textContent = "";
  socials.push({
    id: Date.now(),
    platform: platformSelect.value,
    url: url,
  });

  saveData("socials", socials);
  renderSocials();
  socialForm.reset();
  urlInput.focus();
});

renderSocials();