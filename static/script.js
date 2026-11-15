/* =========================================================
   HELPERS
   ========================================================= */
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Browser storage helpers (photos.js uses these to move older photos to the server)
function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Could not read ${key}:`, err);
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Could not save ${key}:`, err);
    return false;
  }
}

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

// The database stores UTC times like "2026-11-15 10:30:00"
function dbDate(text) {
  return formatDate(text.replace(" ", "T") + "Z");
}

async function removeBlock(id, errorEl) {
  try {
    await api(`/api/blocks/${id}`, { method: "DELETE" });
    return true;
  } catch (err) {
    errorEl.textContent = err.message;
    return false;
  }
}

/* =========================================================
   NOTES AND LINKS (both saved in the database)
   ========================================================= */
const notesList = $("notes-list");
const notesError = $("notes-error");
const linkGrid = $("link-grid");
const linksError = $("links-error");

let notes = [];
let links = [];

async function loadBlocks() {
  try {
    const blocks = await api("/api/blocks");
    notes = blocks.filter((b) => b.type === "note");
    links = blocks.filter((b) => b.type === "link");
  } catch (err) {
    console.error(err);
    notesError.textContent = "Could not load from the server. Is it running?";
  }
  renderNotes();
  renderLinks();
}

// ----- Notes -----
function renderNotes() {
  notesList.innerHTML = "";

  notes.forEach((note) => {
    const li = el("li", "note");

    if (note.title) li.appendChild(el("h3", "", note.title));
    li.appendChild(el("p", "", note.content));
    li.appendChild(el("time", "",