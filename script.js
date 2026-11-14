const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Could not read ${key}:`, err);
    return fallback;
  }
}

// Returns true if saved, false if it failed (for example, storage is full)
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Could not save ${key}:`, err);
    return false;
  }
}

/* =========================================================
   MOOD (recolors the whole page)
   ========================================================= */
const moods = [
  { emoji: "🔥", label: "hyped",  accent: "#e60023", soft: "#fde8ec" },
  { emoji: "😊", label: "happy",  accent: "#d97706", soft: "#fef3c7" },
  { emoji: "😴", label: "sleepy", accent: "#4f46e5", soft: "#e0e7ff" },
  { emoji: "🌧️", label: "moody",  accent: "#0284c7", soft: "#e0f2fe" },
  { emoji: "🌿", label: "calm",   accent: "#16a34a", soft: "#dcfce7" },
];

const picker = $("mood-picker");

function setMood(mood) {
  $("current-mood").textContent = `${mood.emoji} ${mood.label}`;
  const root = document.documentElement;
  root.style.setProperty("--accent", mood.accent);
  root.style.setProperty("--accent-soft", mood.soft);
  picker.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.label === mood.label);
  });
  save("mood", mood.label);
}

moods.forEach((mood) => {
  const btn = el("button", "", mood.emoji);
  btn.type = "button";
  btn.title = mood.label;
  btn.dataset.label = mood.label;
  btn.addEventListener("click", () => setMood(mood));
  picker.appendChild(btn);
});

const savedMood = load("mood", null);
setMood(moods.find((m) => m.label === savedMood) || moods[0]);

/* =========================================================
   PROFILE (click the name or bio to edit)
   ========================================================= */
const nameEl = $("name");
const bioEl = $("bio");
const profile = load("profile", { name: "Your Name", bio: "Click here to write your bio." });
nameEl.textContent = profile.name;
bioEl.textContent = profile.bio;

function syncAvatar() {
  $("avatar").textContent = (nameEl.textContent.trim()[0] || "?").toUpperCase();
}

function saveProfile() {
  save("profile", {
    name: nameEl.textContent.trim() || "Your Name",
    bio: bioEl.textContent.trim(),
  });
  syncAvatar();
}

nameEl.addEventListener("input", syncAvatar);
[nameEl, bioEl].forEach((node) => {
  node.addEventListener("blur", saveProfile);
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      node.blur();
    }
  });
});
syncAvatar();

/* =========================================================
   PINS: photos, notes and links, all in one list
   ========================================================= */
const platformIcons = {
  GitHub: "🐙", LinkedIn: "💼", Instagram: "📸", X: "🐦", YouTube: "▶️", Website: "🌐",
};

// Bring over anything saved by the earlier version of the app
function migrateOldData() {
  const photos = load("photos", []).map((p) => ({ id: p.id, type: "photo", src: p.src, created: Math.floor(p.id) }));
  const notes = load("notes", []).map((n) => ({ id: n.id, type: "note", title: n.title, text: n.text, created: n.created }));
  const links = load("socials", []).map((s) => ({ id: s.id, type: "link", platform: s.platform, url: s.url, created: s.id }));
  return [...photos, ...notes, ...links].sort((a, b) => b.created - a.created);
}

let pins = load("pins", null);
if (!pins) {
  pins = migrateOldData();
  save("pins", pins);
}

let filter = "all";
let query = "";
const feed = $("feed");
const viewer = $("viewer");

function matches(pin) {
  if (filter !== "all" && pin.type !== filter) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [pin.title, pin.text, pin.platform, pin.url].filter(Boolean).join(" ").toLowerCase().includes(q);
}

function buildPin(pin) {
  const li = el("li", `pin pin-${pin.type}`);
  let body;

  if (pin.type === "photo") {
    body = el("button", "pin-main");
    body.type = "button";
    body.setAttribute("aria-label", "View photo");
    const img = el("img");
    img.src = pin.src;
    img.alt = "Photo pin";
    img.loading = "lazy";
    body.appendChild(img);
    body.addEventListener("click", () => {
      $("viewer-img").src = pin.src;
      viewer.showModal();
    });
  } else if (pin.type === "note") {
    body = el("div", `pin-main note-body tint-${Math.floor(pin.id) % 5}`);
    if (pin.title) body.appendChild(el("h3", "", pin.title));
    body.appendChild(el("p", "", pin.text));
  } else {
    body = el("a", "pin-main link-body");
    body.href = pin.url;
    body.target = "_blank";
    body.rel = "noopener noreferrer";
    let host = pin.url;
    try { host = new URL(pin.url).hostname.replace(/^www\./, ""); } catch (err) { /* keep full url */ }
    body.append(el("span", "icon", platformIcons[pin.platform] || "🔗"), el("strong", "", pin.platform), el("small", "", host));
  }

  const del = el("button", "pin-del", "✕");
  del.type = "button";
  del.setAttribute("aria-label", "Delete pin");
  del.addEventListener("click", () => {
    if (!confirm("Delete this pin?")) return;
    pins = pins.filter((p) => p.id !== pin.id);
    save("pins", pins);
    renderFeed();
  });

  li.append(body, del);
  return li;
}

function renderFeed() {
  feed.innerHTML = "";
  const shown = pins.filter(matches);

  if (shown.length === 0) {
    const msg = pins.length === 0
      ? "Nothing here yet. Click + Create to add your first pin."
      : "No pins match. Try a different filter or search.";
    feed.appendChild(el("li", "empty", msg));
    return;
  }
  shown.forEach((pin) => feed.appendChild(buildPin(pin)));
}

$("filters").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  filter = btn.dataset.filter;
  document.querySelectorAll("#filters button").forEach((b) => b.setAttribute("aria-pressed", b === btn));
  renderFeed();
});

$("search").addEventListener("input", (e) => {
  query = e.target.value;
  renderFeed();
});

viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
$("viewer-close").addEventListener("click", () => viewer.close());

/* =========================================================
   CREATE DIALOG
   ========================================================= */
const dialog = $("create-dialog");
const form = $("create-form");
const errorEl = $("create-error");

function setType(type) {
  form.querySelectorAll(".fields").forEach((f) => { f.hidden = f.dataset.type !== type; });
  errorEl.textContent = "";
}

form.querySelectorAll('input[name="type"]').forEach((radio) => {
  radio.addEventListener("change", () => setType(radio.value));
});

$("create-btn").addEventListener("click", () => {
  form.reset();
  setType("photo");
  dialog.showModal();
});
$("create-cancel").addEventListener("click", () => dialog.close());

// Shrink photos before saving: browser storage is only about 5MB
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
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Only http and https links are allowed (blocks things like "javascript:")
function cleanUrl(input) {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = "https://" + value;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch (err) {
    return null;
  }
}

function fail(message) {
  errorEl.textContent = message;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const type = form.elements.type.value;
  const now = Date.now();
  const added = [];

  try {
    if (type === "photo") {
      const files = [...$("photo-input").files].filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return fail("Choose at least one image.");
      for (const file of files) {
        added.push({ id: now + Math.random(), type: "photo", src: await resizeImage(file), created: now });
      }
    } else if (type === "note") {
      const text = $("note-text").value.trim();
      if (!text) return fail("Write something first.");
      added.push({ id: now, type: "note", title: $("note-title").value.trim(), text, created: now });
    } else {
      const url = cleanUrl($("link-url").value);
      if (!url) return fail("That doesn't look like a valid link. Try github.com/yourname.");
      added.push({ id: now, type: "link", platform: $("link-platform").value, url, created: now });
    }
  } catch (err) {
    return fail(err.message);
  }

  pins.unshift(...added);
  if (!save("pins", pins)) {
    pins.splice(0, added.length); // undo, storage is full
    return fail("Storage is full. Delete a few photos and try again.");
  }

  dialog.close();
  renderFeed();
});

renderFeed();