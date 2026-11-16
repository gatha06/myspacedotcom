/* Share panel: make your page public or private.
   Loads after script.js and reuses its helpers ($, el, api). */

(async function () {
  const anchor = $("about-view");
  if (!anchor) return;

  const panel = el("div", "share");
  const status = el("p", "field-note");
  const linkLine = el("p", "field-note");
  const actions = el("div", "form-actions");

  const toggle = el("button", "btn ghost");
  toggle.type = "button";
  const copy = el("button", "btn ghost", "Copy link");
  copy.type = "button";

  actions.append(toggle, copy);
  panel.append(status, linkLine, actions);
  anchor.after(panel);

  let state = { is_public: false, username: "" };

  function pageUrl() {
    return `${location.origin}/u/${state.username}`;
  }

  function render() {
    status.textContent = state.is_public
      ? "Your page is public. Anyone with the link can view it."
      : "Your page is private. Only you can see it.";
    toggle.textContent = state.is_public ? "Make private" : "Make public";
    copy.hidden = !state.is_public;

    const a = el("a", "", pageUrl());
    a.href = pageUrl();
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    linkLine.textContent = "";
    linkLine.append(state.is_public ? "Share this link: " : "Preview: ", a);
  }

  toggle.addEventListener("click", async () => {
    try {
      const data = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ is_public: !state.is_public }),
      });
      state.is_public = data.is_public;
      render();
    } catch (err) {
      status.textContent = err.message;
    }
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pageUrl());
      copy.textContent = "Copied";
      setTimeout(() => { copy.textContent = "Copy link"; }, 1500);
    } catch (err) {
      status.textContent = "Couldn't copy automatically. Select the link below and copy it.";
    }
  });

  try {
    const data = await api("/api/profile");
    state = { is_public: data.is_public, username: data.username };
    render();
  } catch (err) {
    console.error(err);
  }
})();