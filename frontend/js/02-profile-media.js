// Profile helpers and image parsing, resizing, and cropping.
function normalizePost(row) {
  const post = row.Post || row.post || row;
  return {
    ...post,
    likes: Number(row.likes ?? row.votes ?? post.likes ?? 0),
  };
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setAvatar(element, userId, username, pictureOverride = undefined) {
  if (!element) return;
  const fallback = String(username || "?").replace(/^@/, "").slice(0, 1).toUpperCase() || "?";
  let picture = pictureOverride;
  if (picture === undefined) {
    picture = "";
    try {
      if (userId != null) picture = localStorage.getItem(`${PROFILE_PICTURE_KEY}${userId}`) || "";
      if (!picture && username) picture = localStorage.getItem(`${PROFILE_PICTURE_USERNAME_KEY}${String(username).toLowerCase()}`) || "";
    } catch { /* Use initials if browser storage is unavailable. */ }
  }
  element.replaceChildren();
  element.classList.toggle("has-avatar-image", Boolean(picture));
  if (picture) {
    const image = document.createElement("img");
    image.src = picture;
    image.alt = "";
    image.addEventListener("error", () => {
      element.classList.remove("has-avatar-image");
      element.replaceChildren();
      element.textContent = fallback;
    }, { once: true });
    element.append(image);
  } else {
    element.textContent = fallback;
  }
}

function updateProfilePicturePreview(label = "Choose an image from your device") {
  const preview = document.querySelector("#profile-picture-preview");
  const storedPicture = localStorage.getItem(`${PROFILE_PICTURE_KEY}${currentUserId}`) || "";
  const picture = profilePictureDraft === null ? storedPicture : profilePictureDraft;
  setAvatar(preview, currentUserId, currentUsername, picture);
  const filename = document.querySelector("#profile-picture-filename");
  filename.textContent = profilePictureDraft === ""
    ? "Will remove when saved"
    : profilePictureDraft
      ? "Selected for saving"
      : storedPicture
        ? "Current picture saved"
        : label;
}

function updateProfileCover(userId = currentUserId) {
  const storedCover = localStorage.getItem(`${PROFILE_COVER_KEY}${userId}`) || "";
  const cover = profileCoverDraft === null ? storedCover : profileCoverDraft;
  const preview = document.querySelector("#profile-cover-preview");
  if (preview) {
    preview.style.backgroundImage = cover ? `url("${cover}")` : "";
    preview.textContent = profileCoverDraft === ""
      ? "Will remove when saved"
      : profileCoverDraft
        ? "Selected profile background"
        : cover
          ? "Current profile background"
          : "Default profile background";
  }
}

function openProfileEditor() {
  if (Number(publicProfileUser?.id) !== Number(currentUserId)) return;
  document.querySelector("#profile-username").value = currentUsername;
  document.querySelector("#profile-about").value = publicProfileUser.about || "";
  document.querySelector("#profile-status").textContent = "";
  document.querySelector("#profile-picture-input").value = "";
  document.querySelector("#profile-cover-input").value = "";
  profilePictureDraft = null;
  profileCoverDraft = null;
  updateProfilePicturePreview();
  updateProfileCover();
  document.querySelector("#profile-editor-dialog").showModal();
}

function refreshCurrentUserAvatars() {
  setAvatar(elements.sidebarAvatar, currentUserId, currentUsername);
  document.querySelectorAll(".post-card").forEach((card) => {
    const owner = card.querySelector(".author-email")?.textContent?.replace(/^@/, "");
    if (owner?.toLowerCase() === currentUsername.toLowerCase()) {
      setAvatar(card.querySelector(".author-avatar"), currentUserId, currentUsername);
    }
  });
  if (activePublicProfile === currentUsername.toLowerCase()) {
    setAvatar(elements.publicProfileCard.querySelector(".profile-large-avatar"), currentUserId, currentUsername);
  }
}

function saveProfileMediaDraft(previousUsername, username) {
  try {
    if (profilePictureDraft !== null) {
      localStorage.removeItem(`${PROFILE_PICTURE_USERNAME_KEY}${previousUsername.toLowerCase()}`);
      localStorage.removeItem(`${PROFILE_PICTURE_USERNAME_KEY}${username.toLowerCase()}`);
      if (profilePictureDraft) {
        localStorage.setItem(`${PROFILE_PICTURE_KEY}${currentUserId}`, profilePictureDraft);
        localStorage.setItem(`${PROFILE_PICTURE_USERNAME_KEY}${username.toLowerCase()}`, profilePictureDraft);
      } else {
        localStorage.removeItem(`${PROFILE_PICTURE_KEY}${currentUserId}`);
      }
    }
    if (profileCoverDraft !== null) {
      if (profileCoverDraft) localStorage.setItem(`${PROFILE_COVER_KEY}${currentUserId}`, profileCoverDraft);
      else localStorage.removeItem(`${PROFILE_COVER_KEY}${currentUserId}`);
    }
  } catch (error) {
    showToast(`Profile details saved, but browser storage could not save the image changes: ${error.message}`);
  }
  profilePictureDraft = null;
  profileCoverDraft = null;
  refreshCurrentUserAvatars();
}

function readPostContent(rawContent) {
  const content = String(rawContent || "");
  const marker = [POST_IMAGE_MARKER, LEGACY_POST_IMAGE_MARKER]
    .map((value) => ({ value, index: content.lastIndexOf(value) }))
    .sort((left, right) => right.index - left.index)[0];
  if (!marker || marker.index < 0) return { text: content, image: "" };
  const candidate = content.slice(marker.index + marker.value.length).replace(/\]\]$/, "");
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(candidate)) {
    return { text: content, image: "" };
  }
  return { text: content.slice(0, marker.index), image: candidate };
}

function readReplyContent(rawContent) {
  const content = String(rawContent || "");
  const marker = [REPLY_IMAGE_MARKER, LEGACY_REPLY_IMAGE_MARKER]
    .map((value) => ({ value, index: content.lastIndexOf(value) }))
    .sort((left, right) => right.index - left.index)[0];
  if (!marker || marker.index < 0) return { text: content, image: "" };
  const candidate = content.slice(marker.index + marker.value.length).replace(/\]\]$/, "");
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(candidate)) {
    return { text: content, image: "" };
  }
  return { text: content.slice(0, marker.index), image: candidate };
}

async function resizeImage(file, maxDimension = 1200, quality = 0.76) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file.");
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const loaded = new Image();
    loaded.onload = () => resolve(loaded);
    loaded.onerror = () => reject(new Error("That image could not be opened."));
    loaded.src = source;
  });
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function chooseImageCrop(file, kind) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file.");
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const loaded = new Image();
    loaded.onload = () => resolve(loaded);
    loaded.onerror = () => reject(new Error("That image could not be opened."));
    loaded.src = source;
  });
  activeCropImage = image;
  activeCropKind = kind;
  const preview = document.querySelector("#image-crop-preview");
  preview.classList.toggle("image-crop-preview-avatar", kind === "avatar");
  preview.classList.toggle("image-crop-preview-cover", kind === "cover");
  preview.style.backgroundImage = `url("${source}")`;
  document.querySelector("#image-crop-title").textContent = kind === "avatar" ? "Crop profile picture" : "Crop profile background";
  document.querySelector("#image-crop-horizontal").value = "50";
  document.querySelector("#image-crop-vertical").value = "50";
  document.querySelector("#image-crop-zoom").value = "100";
  const dialog = document.querySelector("#image-crop-dialog");
  return new Promise((resolve) => {
    resolveCropSelection = resolve;
    dialog.showModal();
    requestAnimationFrame(renderImageCropPreview);
  });
}

function renderImageCropPreview() {
  if (!activeCropImage) return;
  const preview = document.querySelector("#image-crop-preview");
  const width = preview.clientWidth;
  const height = preview.clientHeight;
  if (!width || !height) return;
  const zoom = Number(document.querySelector("#image-crop-zoom").value) / 100;
  const scale = Math.max(width / activeCropImage.naturalWidth, height / activeCropImage.naturalHeight) * zoom;
  preview.style.backgroundSize = `${activeCropImage.naturalWidth * scale}px ${activeCropImage.naturalHeight * scale}px`;
  preview.style.backgroundPosition = `${document.querySelector("#image-crop-horizontal").value}% ${document.querySelector("#image-crop-vertical").value}%`;
}

function createCroppedImage() {
  if (!activeCropImage) return null;
  const width = activeCropKind === "avatar" ? 640 : 1500;
  const height = activeCropKind === "avatar" ? 640 : 240;
  const zoom = Number(document.querySelector("#image-crop-zoom").value) / 100;
  const scale = Math.max(width / activeCropImage.naturalWidth, height / activeCropImage.naturalHeight) * zoom;
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const maxX = Math.max(0, activeCropImage.naturalWidth - cropWidth);
  const maxY = Math.max(0, activeCropImage.naturalHeight - cropHeight);
  const x = maxX * Number(document.querySelector("#image-crop-horizontal").value) / 100;
  const y = maxY * Number(document.querySelector("#image-crop-vertical").value) / 100;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(activeCropImage, x, y, cropWidth, cropHeight, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", activeCropKind === "avatar" ? 0.82 : 0.78);
}

function finishImageCrop(result = null) {
  const dialog = document.querySelector("#image-crop-dialog");
  const resolve = resolveCropSelection;
  resolveCropSelection = null;
  activeCropImage = null;
  if (dialog.open) dialog.close();
  resolve?.(result);
}

