// Event listeners, composer actions, search, settings, and startup. Load last.
elements.loginTab.addEventListener("click", () => setAuthMode("login"));
elements.registerTab.addEventListener("click", () => setAuthMode("register"));

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(elements.loginForm);
  const submit = elements.loginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  setAuthStatus("Logging in…", false);
  try {
    await login(String(data.get("email")).trim(), String(data.get("password")));
    elements.loginForm.reset();
  } catch (error) {
    setAuthStatus(error.message);
  } finally {
    submit.disabled = false;
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(elements.registerForm);
  const username = String(data.get("username")).trim();
  const email = String(data.get("email")).trim();
  const password = String(data.get("password"));
  const submit = elements.registerForm.querySelector("button[type=submit]");
  submit.disabled = true;
  setAuthStatus("Creating your account…", false);
  try {
    await request("/users/", {
      method: "POST",
      body: { username, email, password },
      auth: false,
    });
    setAuthStatus("Account created. Logging you in…", false);
    await login(email, password);
    elements.registerForm.reset();
  } catch (error) {
    setAuthStatus(error.message);
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", () => logout());
document.querySelector("#delete-account-button").addEventListener("click", async (event) => {
  const confirmed = window.confirm(
    "Delete your account permanently? Your posts, replies, likes, and follows will also be deleted."
  );
  if (!confirmed) return;

  const button = event.currentTarget;
  button.disabled = true;
  try {
    await request("/users/me", { method: "DELETE" });
    logout();
    setAuthMode("login");
    setAuthStatus("Your account was deleted.", false);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#refresh-button").addEventListener("click", () => {
  if (activePublicProfile) openPublicProfile(activePublicProfile);
  else loadFeed(true);
});
elements.loadMore.addEventListener("click", () => loadFeed(false));
elements.allPostsTab.addEventListener("click", () => selectFeed("all"));
elements.followingFeedTab.addEventListener("click", () => selectFeed("following"));
elements.savedListButton.addEventListener("click", () => selectFeed("saved"));
elements.likedListButton.addEventListener("click", () => selectFeed("liked"));
elements.publicProfileMore.addEventListener("click", () => loadPublicProfilePosts(false));
document.querySelector("#profile-back-button").addEventListener("click", closePublicProfile);
elements.profileSettingsButton.addEventListener("click", () => document.querySelector("#settings-dialog").showModal());
elements.sidebarSettingsButton.addEventListener("click", () => document.querySelector("#settings-dialog").showModal());
document.querySelector("#close-settings-dialog").addEventListener("click", () => document.querySelector("#settings-dialog").close());
document.querySelector("#settings-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector("#my-profile-button").addEventListener("click", () => openPublicProfile(currentUsername));

const composeForm = document.querySelector("#compose-form");
const composeFields = composeForm.querySelector(".compose-fields");

function setComposerExpanded(expanded) {
  composeForm.dataset.expanded = String(expanded);
  document.querySelector("#compose-trigger").hidden = expanded;
  document.querySelector("#compose-trigger").setAttribute("aria-expanded", String(expanded));
  composeFields.hidden = !expanded;
  if (expanded) document.querySelector("#post-content").focus();
}

function resetComposer() {
  composeForm.reset();
  selectedPostImage = "";
  document.querySelector("#post-image-preview").replaceChildren();
  document.querySelector("#post-image-preview").hidden = true;
  document.querySelector("#post-image-name").textContent = "Text or one picture";
  document.querySelector("#remove-post-image").hidden = true;
}

document.querySelector("#compose-trigger").addEventListener("click", () => setComposerExpanded(true));
document.querySelector("#compose-cancel").addEventListener("click", () => {
  resetComposer();
  setComposerExpanded(false);
});

composeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const text = document.querySelector("#post-content").value.trim();
  const content = `${text}${selectedPostImage ? `${POST_IMAGE_MARKER}${selectedPostImage}]]` : ""}`;
  const title = text.slice(0, 120) || "Image post";
  const submit = form.querySelector("button[type=submit]");
  if (!text && !selectedPostImage) return showToast("Write a post or add a picture first.");
  if (selectedPostImage.length > MAX_POST_IMAGE_DATA_URL_LENGTH) {
    return showToast("That picture is still too large. Choose a smaller one.");
  }
  submit.disabled = true;
  try {
    await request("/posts/", {
      method: "POST",
      body: { title, content, published: true },
    });
    resetComposer();
    setComposerExpanded(false);
    if (activePublicProfile) {
      if (publicProfileMode === "compose") {
        publicProfilePostViews.delete("posts");
        setPublicProfileMode("posts");
      } else if (publicProfileMode === "posts") {
        publicProfilePostViews.delete("posts");
        await loadPublicProfilePosts(true);
      }
    } else {
      if (feedMode !== "all") {
        feedMode = "all";
        elements.allPostsTab.classList.add("is-active");
        elements.allPostsTab.setAttribute("aria-selected", "true");
        elements.followingFeedTab.classList.remove("is-active");
        elements.followingFeedTab.setAttribute("aria-selected", "false");
        elements.savedListButton.classList.remove("is-active");
        elements.likedListButton.classList.remove("is-active");
        document.querySelector("#feed-heading-title").textContent = "Feed";
      }
      await loadFeed(true);
    }
    showToast("Your post is live.");
  } catch (error) {
    showToast(error.message);
  } finally {
    submit.disabled = false;
  }
});

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#profile-status");
  const username = document.querySelector("#profile-username").value.trim();
  const about = document.querySelector("#profile-about").value.trim();
  const submit = elements.profileForm.querySelector("button[type=submit]");
  status.textContent = "Saving profile…";
  submit.disabled = true;
  try {
    const profile = await request("/users/me", {
      method: "PATCH",
      body: { username, about },
    });
    const previousUsername = currentUsername;
    currentUsername = profile.username;
    saveProfileMediaDraft(previousUsername, profile.username);
    elements.accountUsername.textContent = `@${profile.username}`;
    elements.sidebarUsername.textContent = `@${profile.username}`;
    elements.sidebarEmail.textContent = profile.email || "";
    elements.sidebarAbout.textContent = profile.about || "No about text yet. Add a short introduction in your profile settings.";
    document.querySelector("#profile-username").value = profile.username;
    await loadFollowedUsers();
    await loadConnections();
    status.textContent = "Profile saved.";
    document.querySelector("#profile-editor-dialog").close();
    await openPublicProfile(profile.username, false);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#profile-picture-input").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    const cropped = await chooseImageCrop(file, "avatar");
    if (cropped) {
      profilePictureDraft = cropped;
      updateProfilePicturePreview();
      document.querySelector("#profile-picture-filename").textContent = file.name;
    }
  } catch (error) {
    showToast(error.message || "Could not prepare this profile picture.");
  } finally {
    event.currentTarget.value = "";
  }
});

document.querySelector("#remove-profile-picture").addEventListener("click", () => {
  profilePictureDraft = "";
  updateProfilePicturePreview();
});

document.querySelector("#close-profile-dialog").addEventListener("click", () => {
  document.querySelector("#profile-editor-dialog").close();
});
document.querySelector("#cancel-profile-edit").addEventListener("click", () => {
  document.querySelector("#profile-editor-dialog").close();
});
document.querySelector("#profile-editor-dialog").addEventListener("close", () => {
  profilePictureDraft = null;
  profileCoverDraft = null;
  document.querySelector("#profile-picture-input").value = "";
  document.querySelector("#profile-cover-input").value = "";
});

document.querySelector("#profile-cover-input").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    const cropped = await chooseImageCrop(file, "cover");
    if (cropped) {
      profileCoverDraft = cropped;
      updateProfileCover();
    }
  } catch (error) {
    showToast(error.message || "Could not prepare that profile background.");
  } finally {
    event.currentTarget.value = "";
  }
});

document.querySelector("#remove-profile-cover").addEventListener("click", () => {
  profileCoverDraft = "";
  updateProfileCover();
});

for (const id of ["image-crop-horizontal", "image-crop-vertical", "image-crop-zoom"]) {
  document.querySelector(`#${id}`).addEventListener("input", renderImageCropPreview);
}
document.querySelector("#apply-image-crop").addEventListener("click", () => {
  try {
    finishImageCrop(createCroppedImage());
  } catch (error) {
    showToast(error.message || "Could not crop that image.");
  }
});
document.querySelector("#cancel-image-crop").addEventListener("click", () => finishImageCrop());
document.querySelector("#close-image-crop").addEventListener("click", () => finishImageCrop());
document.querySelector("#image-crop-dialog").addEventListener("close", () => {
  const resolve = resolveCropSelection;
  resolveCropSelection = null;
  activeCropImage = null;
  resolve?.(null);
});

document.querySelector("#post-image-input").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const name = document.querySelector("#post-image-name");
  const preview = document.querySelector("#post-image-preview");
  try {
    selectedPostImage = await resizeImage(file, 1200, 0.76);
    if (selectedPostImage.length > MAX_POST_IMAGE_DATA_URL_LENGTH) {
      selectedPostImage = await resizeImage(file, 900, 0.62);
    }
    if (selectedPostImage.length > MAX_POST_IMAGE_DATA_URL_LENGTH) {
      selectedPostImage = "";
      throw new Error("This picture is too large to attach. Choose a smaller image.");
    }
    const image = document.createElement("img");
    image.src = selectedPostImage;
    image.alt = "Preview of the picture to attach";
    preview.replaceChildren(image);
    preview.hidden = false;
    name.textContent = file.name;
    document.querySelector("#remove-post-image").hidden = false;
  } catch (error) {
    showToast(error.message || "Could not prepare that picture.");
  } finally {
    event.currentTarget.value = "";
  }
});

document.querySelector("#remove-post-image").addEventListener("click", () => {
  selectedPostImage = "";
  document.querySelector("#post-image-preview").replaceChildren();
  document.querySelector("#post-image-preview").hidden = true;
  document.querySelector("#post-image-name").textContent = "Text or one picture";
  document.querySelector("#remove-post-image").hidden = true;
});

async function searchUsers(rawQuery) {
  const query = rawQuery.trim().replace(/^@/, "");
  const results = elements.userSearchResults;
  if (!query) {
    results.hidden = true;
    results.replaceChildren();
    return;
  }
  const requestId = ++userSearchRequestId;
  results.hidden = false;
  results.replaceChildren(makeElement("p", "user-search-loading", "Searching accounts…"));
  try {
    const users = await request(`/users/search?username=${encodeURIComponent(query)}`);
    if (requestId === userSearchRequestId && elements.userSearchInput.value.trim().replace(/^@/, "") === query) {
      renderUserSearchResults(users);
    }
  } catch (error) {
    if (requestId === userSearchRequestId) {
      results.replaceChildren(makeElement("p", "user-search-empty", error.message));
    }
  }
}

elements.userSearchInput.addEventListener("input", () => {
  window.clearTimeout(userSearchTimer);
  const query = elements.userSearchInput.value.trim();
  if (!query) {
    userSearchRequestId += 1;
    elements.userSearchResults.hidden = true;
    elements.userSearchResults.replaceChildren();
    return;
  }
  userSearchTimer = window.setTimeout(() => searchUsers(query), 250);
});

document.querySelector("#user-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  window.clearTimeout(userSearchTimer);
  searchUsers(elements.userSearchInput.value);
});

document.addEventListener("click", (event) => {
  if (!document.querySelector("#user-search-form").contains(event.target)) {
    elements.userSearchResults.hidden = true;
  }
});

document.querySelector("#following-tab").addEventListener("click", () => {
  connectionsMode = "following";
  document.querySelector("#following-tab").classList.add("is-active");
  document.querySelector("#following-tab").setAttribute("aria-selected", "true");
  document.querySelector("#followers-tab").classList.remove("is-active");
  document.querySelector("#followers-tab").setAttribute("aria-selected", "false");
  renderConnections();
});

document.querySelector("#followers-tab").addEventListener("click", () => {
  connectionsMode = "followers";
  document.querySelector("#followers-tab").classList.add("is-active");
  document.querySelector("#followers-tab").setAttribute("aria-selected", "true");
  document.querySelector("#following-tab").classList.remove("is-active");
  document.querySelector("#following-tab").setAttribute("aria-selected", "false");
  renderConnections();
});

document.querySelector("#dark-mode-toggle").addEventListener("change", (event) => {
  applyTheme(event.currentTarget.checked);
});

document.querySelector("#background-image-input").addEventListener("change", (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Choose an image file for your background.");
    event.currentTarget.value = "";
    return;
  }
  if (file.size > MAX_BACKGROUND_BYTES) {
    showToast("Choose an image smaller than 3 MB.");
    event.currentTarget.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      applyBackground(String(reader.result));
      showToast("Background updated.");
    } catch {
      showToast("This image could not be saved in your browser. Try a smaller image.");
    }
    event.currentTarget.value = "";
  });
  reader.addEventListener("error", () => {
    showToast("Could not read that image.");
    event.currentTarget.value = "";
  });
  reader.readAsDataURL(file);
});

document.querySelector("#clear-background-button").addEventListener("click", () => {
  try {
    applyBackground(null);
    document.querySelector("#background-image-input").value = "";
    showToast("Background reset to light grey.");
  } catch {
    showToast("Could not reset the background setting.");
  }
});

let infiniteScrollFrame = 0;
function checkInfiniteScroll() {
  if (infiniteScrollFrame) return;
  infiniteScrollFrame = requestAnimationFrame(() => {
    infiniteScrollFrame = 0;
    const scrollable = document.scrollingElement || document.documentElement;
    const nearPageEnd = window.scrollY + window.innerHeight >= scrollable.scrollHeight - 450;
    if (!nearPageEnd) return;

    if (activePublicProfile) {
      if (!elements.publicProfileView.hidden && !elements.publicProfileMore.hidden && !elements.publicProfileMore.disabled
        && !elements.publicProfileStatus.textContent.startsWith("Could not load")) {
        loadPublicProfilePosts(false);
      }
      return;
    }
    if (!elements.feedContent.hidden && !elements.loadMore.hidden && !elements.loadMore.disabled
      && !elements.feedStatus.textContent.startsWith("Could not load")) {
      loadFeed(false);
    }
  });
}

window.addEventListener("scroll", checkInfiniteScroll, { passive: true });
window.addEventListener("resize", checkInfiniteScroll);

if (accessToken && currentUserId) {
  showApp(sessionStorage.getItem(EMAIL_KEY) || "Signed in").catch((error) => logout(error.message));
} else {
  logout();
}
