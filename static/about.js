/* About me: name, tagline, bio and profile photo.
   Loads after script.js and reuses its helpers ($, el, api). */

const aboutView = $("about-view");
const aboutForm = $("about-form");
const aboutError = $("about-error");

let profile = { username: "", display_name: "", tagline: "", bio: "", avatar: "" };
let pendingAvatar; // undefined = keep, "" = remove, "data:..." = new photo

function renderAbout() {
  const name = profile.display_name || profile.username;
  $("about-name").textContent = name;
  $("about-tagline").textContent = profile.tagline;
  $("about-tagline").hidden = !profile.tagline;
  $("about-bio").textContent = profile.bio || "Add a short bio so people know who's here.";

  const portrait = $("about-portrait");
  portrait.textContent = "";
  if (profile.avatar.startsWith("data:image/jpeg;base64,")) {
    const img = el("img");
    img.src = profile.avatar;
    img.alt = "";
    portrait.appendChild(img);
  } else {
    portrait.textContent = (name[0] || "?").toUpperCase();
  }
}

// Crop the middle of the picture to a small square JPEG
function cropToSquare(file, size = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openEdit() {
  $("about-name-input").value = profile.display_name;
  $("about-tagline-input").value = profile.tagline;
  $("about-bio-input").value = profile.bio;
  $("about-photo").value = "";
  $("about-photo-note").textContent = "";
  aboutError.textContent = "";
  pendingAvatar = undefined;
  aboutView.hidden = true;
  aboutForm.hidden = false;
  $("about-name-input").focus();
}

function closeEdit() {
  aboutForm.hidden = true;
  aboutView.hidden = false;
}

$("about-edit").addEventListener("click", openEdit);
$("about-cancel").addEventListener("click", () => {
  aboutError.textContent = "";
  closeEdit();
});

$("about-photo").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  aboutError.textContent = "";
  if (!file.type.startsWith("image/")) {
    aboutError.textContent = "Please choose an image file.";
    event.target.value = "";
    return;
  }
  try {
    pendingAvatar = await cropToSquare(file);
    $("about-photo-note").textContent = "New photo ready. Click Save to keep it.";
  } catch (err) {
    aboutError.textContent = err.message;
  }
});

$("about-remove-photo").addEventListener("click", () => {
  pendingAvatar = "";
  $("about-photo").value = "";
  $("about-photo-note").textContent = "Photo will be removed when you click Save.";
});

aboutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = {
    display_name: $("about-name-input").value.trim(),
    tagline: $("about-tagline-input").value.trim(),
    bio: $("about-bio-input").value.trim(),
  };
  if (pendingAvatar !== undefined) body.avatar = pendingAvatar;

  try {
    profile = await api("/api/profile", { method: "PUT", body: JSON.stringify(body) });
    aboutError.textContent = "";
    renderAbout();
    closeEdit();
  } catch (err) {
    aboutError.textContent = err.message;
  }
});

async function loadAbout() {
  try {
    profile = await api("/api/profile");
  } catch (err) {
    console.error(err);
  }
  renderAbout();
}

loadAbout();