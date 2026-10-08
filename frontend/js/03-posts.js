// Post card rendering, votes, and browser-local saved/disliked state.
function createPostCard(row) {
  const post = normalizePost(row);
  const card = makeElement("article", "post-card");
  card.dataset.postId = post.id;

  const meta = makeElement("div", "post-meta");
  const author = makeElement("div", "author-block");
  const authorUsername = post.owner?.username || `user_${post.owner_id}`;
  const avatar = makeElement("span", "author-avatar");
  setAvatar(avatar, post.owner_id, authorUsername);
  avatar.setAttribute("aria-hidden", "true");
  const authorInfo = makeElement("div", "author-info");
  const authorLink = makeElement("button", "author-email profile-link", `@${authorUsername}`);
  authorLink.type = "button";
  authorLink.addEventListener("click", () => openPublicProfile(authorUsername));
  authorInfo.append(
    authorLink,
    makeElement("div", "post-time", formatDate(post.created_at)),
  );
  author.append(avatar, authorInfo);
  meta.append(author);
  if (Number(post.owner_id) === Number(currentUserId)) {
    const deleteButton = makeElement("button", "post-delete-button", "Delete");
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Delete this post");
    deleteButton.title = "Delete this post";
    deleteButton.addEventListener("click", () => deletePost(post.id, deleteButton));
    meta.append(deleteButton);
  }
  card.append(meta);

  const postBody = makeElement("div", "post-content");
  const parsedContent = readPostContent(post.content);
  if (parsedContent.text) postBody.append(makeElement("p", "post-text", parsedContent.text));
  if (parsedContent.image) {
    const image = document.createElement("img");
    image.className = "post-image";
    image.src = parsedContent.image;
    image.alt = `Picture shared by @${authorUsername}`;
    image.loading = "lazy";
    postBody.append(image);
  }
  card.append(postBody);

  const actions = makeElement("div", "post-actions");
  const likeButton = makeElement("button", "action-button vote-button vote-up");
  likeButton.type = "button";
  likeButton.disabled = true;
  likeButton.append(makeElement("span", "vote-arrow", "↑"), makeElement("span", "vote-label"), makeElement("span", "vote-count"));

  const dislikeButton = makeElement("button", "action-button vote-button vote-down");
  dislikeButton.type = "button";
  dislikeButton.disabled = true;
  dislikeButton.append(makeElement("span", "vote-arrow", "↓"), makeElement("span", "vote-label"));

  const saveButton = makeElement("button", "action-button save-button");
  saveButton.type = "button";
  updateSaveButton(saveButton, post.id);

  const replyToggle = makeElement("button", "action-button reply-toggle", "↩ Reply");
  replyToggle.type = "button";
  actions.append(likeButton, dislikeButton, saveButton, replyToggle);
  card.append(actions);

  const replyPanel = makeElement("section", "reply-panel");
  replyPanel.hidden = true;
  replyPanel.setAttribute("aria-label", `Replies to @${authorUsername}`);
  card.append(replyPanel);

  request(`/posts/${post.id}/like`).then((status) => {
    if (status?.liked) likedPostIds.add(Number(post.id));
    else likedPostIds.delete(Number(post.id));
    updateVoteButtons(likeButton, dislikeButton, post);
  }).catch(() => updateVoteButtons(likeButton, dislikeButton, post));
  likeButton.addEventListener("click", async () => {
    likeButton.disabled = true;
    const liked = likedPostIds.has(Number(post.id));
    try {
      await request(`/posts/${post.id}/like`, { method: liked ? "DELETE" : "POST" });
      if (liked) {
        likedPostIds.delete(Number(post.id));
        post.likes = Math.max(0, post.likes - 1);
      } else {
        likedPostIds.add(Number(post.id));
        dislikedPostIds.delete(Number(post.id));
        post.likes += 1;
      }
      persistDislikedPosts();
      updateVoteButtons(likeButton, dislikeButton, post);
    } catch (error) {
      showToast(error.message);
      updateVoteButtons(likeButton, dislikeButton, post);
    }
  });
  dislikeButton.addEventListener("click", async () => {
    const postId = Number(post.id);
    dislikeButton.disabled = true;
    try {
      if (dislikedPostIds.has(postId)) {
        dislikedPostIds.delete(postId);
      } else {
        if (likedPostIds.has(postId)) {
          await request(`/posts/${post.id}/like`, { method: "DELETE" });
          likedPostIds.delete(postId);
          post.likes = Math.max(0, post.likes - 1);
        }
        dislikedPostIds.add(postId);
      }
      persistDislikedPosts();
      updateVoteButtons(likeButton, dislikeButton, post);
    } catch (error) {
      showToast(error.message);
      updateVoteButtons(likeButton, dislikeButton, post);
    }
  });
  saveButton.addEventListener("click", () => toggleSavedPost(post.id));

  replyToggle.addEventListener("click", async () => {
    const opening = replyPanel.hidden;
    replyPanel.hidden = !opening;
    replyToggle.textContent = opening ? "⌃ Hide replies" : "↩ Reply";
    if (opening) await loadReplies(post.id, replyPanel);
  });

  return card;
}

async function deletePost(postId, button) {
  if (!window.confirm("Delete this post permanently? This cannot be undone.")) return;

  button.disabled = true;
  const numericPostId = Number(postId);
  try {
    await request(`/posts/${numericPostId}`, { method: "DELETE" });
    likedPostIds.delete(numericPostId);
    savedPostIds.delete(numericPostId);
    dislikedPostIds.delete(numericPostId);

    try {
      localStorage.setItem(`${SAVED_POSTS_KEY}${currentUserId}`, JSON.stringify([...savedPostIds]));
    } catch {
      showToast("Post deleted, but saved posts could not be updated in this browser.");
    }
    persistDislikedPosts();

    const selector = `.post-card[data-post-id="${numericPostId}"]`;
    document.querySelectorAll(selector).forEach((card) => card.remove());
    for (const view of publicProfilePostViews.values()) {
      view.content.querySelectorAll(selector).forEach((card) => card.remove());
    }
    document.querySelector("#saved-count").textContent = savedPostIds.size;
    showToast("Post deleted.");
  } catch (error) {
    button.disabled = false;
    showToast(error.message);
  }
}

function updateVoteButtons(likeButton, dislikeButton, post) {
  const postId = Number(post.id);
  const liked = likedPostIds.has(postId);
  const disliked = dislikedPostIds.has(postId);
  likeButton.querySelector(".vote-label").textContent = liked ? "Unlike" : "Like";
  likeButton.querySelector(".vote-count").textContent = post.likes;
  likeButton.classList.toggle("is-liked", liked);
  likeButton.setAttribute("aria-label", `${liked ? "Unlike" : "Like"} post; ${post.likes} likes`);
  likeButton.title = liked ? "Unlike this post" : "Like this post";
  likeButton.disabled = false;
  dislikeButton.classList.toggle("is-disliked", disliked);
  dislikeButton.querySelector(".vote-label").textContent = disliked ? "Disliked" : "Dislike";
  dislikeButton.setAttribute("aria-label", disliked ? "Remove dislike" : "Dislike this post");
  dislikeButton.title = disliked ? "Remove your dislike" : "Dislike this post";
  dislikeButton.disabled = false;
}

function updateSaveButton(button, postId) {
  const saved = savedPostIds.has(Number(postId));
  button.textContent = saved ? "▣ Saved" : "▣ Save";
  button.classList.toggle("is-saved", saved);
  button.title = saved ? "Remove from saved posts" : "Save this post on this device";
  button.setAttribute("aria-label", button.title);
}

function toggleSavedPost(postId) {
  const numericId = Number(postId);
  if (savedPostIds.has(numericId)) savedPostIds.delete(numericId);
  else savedPostIds.add(numericId);
  try {
    localStorage.setItem(`${SAVED_POSTS_KEY}${currentUserId}`, JSON.stringify([...savedPostIds]));
  } catch {
    showToast("Could not save this list in your browser storage.");
    return;
  }
  document.querySelectorAll(`.post-card[data-post-id="${numericId}"] .save-button`).forEach((button) => updateSaveButton(button, numericId));
  document.querySelector("#saved-count").textContent = savedPostIds.size;
  if (feedMode === "saved") loadFeed(true);
}

function persistDislikedPosts() {
  try {
    localStorage.setItem(`${DISLIKED_POSTS_KEY}${currentUserId}`, JSON.stringify([...dislikedPostIds]));
  } catch {
    showToast("Dislikes may not be retained because browser storage is unavailable.");
  }
}
