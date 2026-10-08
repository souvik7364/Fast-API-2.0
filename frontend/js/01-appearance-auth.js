// Appearance, API requests, authentication, and app startup.
function setAuthStatus(message, isError = true) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle("is-success", !isError);
}

function applyTheme(isDark, persist = true) {
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.querySelector("#dark-mode-toggle").checked = isDark;
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#17191d" : "#e9eaec";
  if (persist) localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

function applyBackground(imageData, persist = true) {
  if (persist) {
    if (imageData) localStorage.setItem(BACKGROUND_KEY, imageData);
    else localStorage.removeItem(BACKGROUND_KEY);
  }
  if (imageData) {
    document.body.style.setProperty("--wallpaper-image", `url("${imageData}")`);
    document.body.classList.add("has-wallpaper");
    document.querySelector("#clear-background-button").hidden = false;
  } else {
    document.body.style.removeProperty("--wallpaper-image");
    document.body.classList.remove("has-wallpaper");
    document.querySelector("#clear-background-button").hidden = true;
  }
}

function restoreAppearance() {
  try {
    applyTheme(localStorage.getItem(THEME_KEY) === "dark", false);
    applyBackground(localStorage.getItem(BACKGROUND_KEY), false);
  } catch {
    applyTheme(false, false);
    applyBackground(null, false);
  }
}

restoreAppearance();

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
}

async function request(path, options = {}) {
  if (!API_BASE) {
    throw new Error("Set the FastAPI Render URL in frontend/config.js before using the hosted app.");
  }
  const headers = new Headers(options.headers || {});
  if (options.auth !== false && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (options.body !== undefined && !(options.body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    logout("Your session expired. Please log in again.");
    throw new Error("Your session expired. Please log in again.");
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch { /* The response did not contain JSON. */ }
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : null;
}

function setAuthMode(mode) {
  const loginMode = mode === "login";
  elements.loginForm.hidden = !loginMode;
  elements.registerForm.hidden = loginMode;
  elements.loginTab.classList.toggle("is-active", loginMode);
  elements.registerTab.classList.toggle("is-active", !loginMode);
  elements.loginTab.setAttribute("aria-selected", String(loginMode));
  elements.registerTab.setAttribute("aria-selected", String(!loginMode));
  elements.authTitle.textContent = loginMode ? "Welcome back" : "Join the conversation";
  elements.authCopy.textContent = loginMode
    ? "Log in to catch up with your people."
    : "Create an account to start sharing.";
  setAuthStatus("");
}

async function login(email, password) {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  const result = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    auth: false,
  });
  accessToken = result.access_token;
  currentUserId = readUserId(accessToken);
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(EMAIL_KEY, email);
  await showApp(email);
}

async function showApp(email) {
  const profile = await request("/users/me");
  currentUserId = Number(profile.id);
  currentUsername = profile.username;
  try {
    const stored = JSON.parse(localStorage.getItem(`${SAVED_POSTS_KEY}${currentUserId}`) || "[]");
    savedPostIds = new Set(stored.map(Number).filter(Number.isFinite));
  } catch {
    savedPostIds = new Set();
  }
  try {
    const stored = JSON.parse(localStorage.getItem(`${DISLIKED_POSTS_KEY}${currentUserId}`) || "[]");
    dislikedPostIds = new Set(stored.map(Number).filter(Number.isFinite));
  } catch {
    dislikedPostIds = new Set();
  }
  document.querySelector("#saved-count").textContent = savedPostIds.size;
  elements.authView.hidden = true;
  elements.appView.hidden = false;
  elements.profileComposeColumn.hidden = true;
  document.querySelector("#profile-workspace").classList.remove("is-own-profile");
  elements.sidebar.insertBefore(elements.composeForm, document.querySelector(".library-card"));
  elements.accountArea.hidden = false;
  elements.profileSettingsButton.hidden = true;
  elements.accountUsername.textContent = `@${profile.username}`;
  elements.accountEmail.textContent = profile.email || email;
  elements.sidebarUsername.textContent = `@${profile.username}`;
  setAvatar(elements.sidebarAvatar, profile.id, profile.username);
  elements.sidebarEmail.textContent = profile.email || email;
  elements.sidebarAbout.textContent = profile.about || "No about text yet. Add a short introduction in your profile settings.";
  elements.userSearchForm.hidden = false;
  feedMode = "all";
  elements.allPostsTab.classList.add("is-active");
  elements.allPostsTab.setAttribute("aria-selected", "true");
  elements.followingFeedTab.classList.remove("is-active");
  elements.followingFeedTab.setAttribute("aria-selected", "false");
  elements.savedListButton.classList.remove("is-active");
  elements.likedListButton.classList.remove("is-active");
  document.querySelector("#feed-heading-title").textContent = "Feed";
  elements.feedTabs.hidden = false;
  elements.feedContent.hidden = false;
  elements.publicProfileView.hidden = true;
  elements.appView.classList.remove("profile-open");
  activePublicProfile = null;
  profileHistory = [];
  document.querySelector("#profile-username").value = profile.username;
  document.querySelector("#profile-about").value = profile.about || "";
  updateProfilePicturePreview();
  await loadFollowedUsers();
  await loadConnections();
  await loadFeed(true);
}

function logout(message = "") {
  accessToken = null;
  currentUserId = null;
  currentUsername = "";
  followedUsernames = new Set();
  followers = [];
  following = [];
  likedPostIds = new Set();
  savedPostIds = new Set();
  dislikedPostIds = new Set();
  selectedPostImage = "";
  resetComposer();
  setComposerExpanded(false);
  activePublicProfile = null;
  publicProfileUser = null;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  elements.authView.hidden = false;
  elements.appView.hidden = true;
  elements.accountArea.hidden = true;
  elements.profileSettingsButton.hidden = true;
  document.querySelector("#settings-dialog").close?.();
  elements.userSearchForm.hidden = true;
  elements.userSearchInput.value = "";
  elements.userSearchResults.hidden = true;
  elements.userSearchResults.replaceChildren();
  elements.connectionsList.replaceChildren();
  elements.connectionsStatus.textContent = "";
  elements.publicProfileCard.replaceChildren();
  elements.publicProfilePosts.replaceChildren();
  elements.publicProfileConnections.replaceChildren();
  elements.publicProfileView.hidden = true;
  elements.feedTabs.hidden = false;
  elements.feedContent.hidden = false;
  elements.feedList.replaceChildren();
  elements.feedStatus.textContent = "";
  if (message) {
    setAuthMode("login");
    setAuthStatus(message);
  } else {
    elements.authStatus.textContent = "";
  }
}
