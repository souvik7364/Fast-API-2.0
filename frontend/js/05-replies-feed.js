// Replies, feed loading, and feed selection.
async function loadReplies(postId, panel) {
  panel.replaceChildren(makeElement("p", "muted", "Loading replies…"));
  try {
    const replies = await request(`/posts/${postId}/replies`);
    panel.replaceChildren();
    const list = makeElement("div", "reply-list");
    if (!replies.length) list.append(makeElement("p", "muted", "No replies yet. Start the conversation."));
    for (const reply of replies) {
      const item = makeElement("article", "reply-item");
      const head = makeElement("div", "reply-head");
      head.append(
        makeElement("span", "", `@${reply.owner?.username || `user_${reply.owner_id}`}`),
        makeElement("time", "", formatDate(reply.created_at)),
      );
      if (Number(reply.owner_id) === Number(currentUserId)) {
        const deleteButton = makeElement("button", "reply-delete", "Delete");
        deleteButton.type = "button";
        deleteButton.addEventListener("click", async () => {
          try {
            await request(`/replies/${reply.id}`, { method: "DELETE" });
            await loadReplies(postId, panel);
          } catch (error) {
            showToast(error.message);
          }
        });
        head.append(deleteButton);
      }
      const parsedReply = readReplyContent(reply.content);
      item.append(head);
      if (parsedReply.text) item.append(makeElement("p", "reply-body", parsedReply.text));
      if (parsedReply.image) {
        const image = makeElement("img", "reply-image");
        image.src = parsedReply.image;
        image.alt = "Image attached to reply";
        item.append(image);
      }
      list.append(item);
    }

    const form = makeElement("form", "reply-form");
    const input = document.createElement("textarea");
    input.name = "content";
    input.maxLength = 280;
    input.rows = 2;
    input.placeholder = "Write a reply…";
    input.setAttribute("aria-label", "Reply text");
    const selectedPhoto = { data: "" };
    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.className = "visually-hidden";
    const photoLabel = makeElement("label", "reply-image-picker", "▧ Add picture");
    photoLabel.htmlFor = `reply-image-${postId}`;
    imageInput.id = `reply-image-${postId}`;
    const photoName = makeElement("span", "reply-image-name", "Text or one picture");
    const photoPreview = makeElement("div", "reply-image-preview");
    photoPreview.hidden = true;
    imageInput.addEventListener("change", async () => {
      const file = imageInput.files?.[0];
      if (!file) return;
      try {
        selectedPhoto.data = await resizeImage(file, 1000, 0.72);
        if (selectedPhoto.data.length > MAX_POST_IMAGE_DATA_URL_LENGTH) {
          selectedPhoto.data = await resizeImage(file, 720, 0.56);
        }
        if (selectedPhoto.data.length > MAX_POST_IMAGE_DATA_URL_LENGTH) {
          throw new Error("That picture is too large. Choose a smaller image.");
        }
        const image = makeElement("img");
        image.src = selectedPhoto.data;
        image.alt = "Reply image preview";
        photoPreview.replaceChildren(image);
        photoPreview.hidden = false;
        photoName.textContent = file.name;
      } catch (error) {
        selectedPhoto.data = "";
        imageInput.value = "";
        photoPreview.replaceChildren();
        photoPreview.hidden = true;
        photoName.textContent = "Text or one picture";
        showToast(error.message);
      }
    });
    const submit = makeElement("button", "button button-primary", "Reply");
    submit.type = "submit";
    const formRow = makeElement("div", "reply-form-row");
    formRow.append(input, submit);
    const imageRow = makeElement("div", "reply-image-row");
    imageRow.append(photoLabel, imageInput, photoName);
    form.append(formRow, imageRow, photoPreview);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) {
        showToast("Add reply text with your picture.");
        return;
      }
      submit.disabled = true;
      try {
        const content = `${text}${selectedPhoto.data ? `${REPLY_IMAGE_MARKER}${selectedPhoto.data}]]` : ""}`;
        await request(`/posts/${postId}/replies`, {
          method: "POST",
          body: { content },
        });
        await loadReplies(postId, panel);
      } catch (error) {
        showToast(error.message);
      } finally {
        submit.disabled = false;
      }
    });
    panel.append(list, form);
  } catch (error) {
    panel.replaceChildren(makeElement("p", "muted", `Could not load replies: ${error.message}`));
  }
}

async function loadFeed(reset = false) {
  if (activePublicProfile) return;
  if (reset) {
    currentSkip = 0;
    likedPostIds = new Set();
    elements.feedList.replaceChildren();
  }
  elements.feedStatus.textContent = feedMode === "following" ? "Loading posts from people you follow…" : "Loading posts…";
  elements.loadMore.disabled = true;
  try {
    if (feedMode === "saved") {
      const ids = [...savedPostIds].reverse();
      const selectedIds = ids.slice(currentSkip, currentSkip + pageSize);
      const responses = await Promise.all(selectedIds.map(async (id) => {
        try {
          return await request(`/posts/${id}`);
        } catch (error) {
          if (error.status === 404) return null;
          throw error;
        }
      }));
      const validRows = responses.filter(Boolean);
      const missingIds = selectedIds.filter((_, index) => !responses[index]);
      for (const id of missingIds) savedPostIds.delete(Number(id));
      if (missingIds.length) {
        try {
          localStorage.setItem(`${SAVED_POSTS_KEY}${currentUserId}`, JSON.stringify([...savedPostIds]));
        } catch { /* The in-memory saved list remains usable for this session. */ }
      }
      for (const row of validRows) elements.feedList.append(createPostCard(row));
      currentSkip += validRows.length;
      const hasMoreSaved = currentSkip < savedPostIds.size;
      elements.loadMore.hidden = !hasMoreSaved;
      if (reset && validRows.length === 0) {
        elements.feedList.append(makeElement("div", "empty-state", "No saved posts yet. Save a post from the feed or Following."));
      }
      elements.feedStatus.textContent = "Saved posts are stored only in this browser.";
      return;
    }

    if (feedMode === "following" && followedUsernames.size === 0) {
      if (reset) elements.feedList.append(makeElement("div", "empty-state", "Follow people to see their posts here."));
      elements.feedStatus.textContent = "";
      elements.loadMore.hidden = true;
      return;
    }

    const collected = [];
    let exhausted = false;
    const maxPagesPerLoad = feedMode === "following" || feedMode === "liked" ? 8 : 1;
    for (let page = 0; page < maxPagesPerLoad && collected.length < pageSize; page += 1) {
      const params = new URLSearchParams({ limit: String(pageSize), skip: String(currentSkip) });
      const rows = await request(`/posts/?${params.toString()}`);
      currentSkip += rows.length;
      if (rows.length < pageSize) exhausted = true;
      let matchingRows = rows;
      if (feedMode === "following") {
        matchingRows = rows.filter((row) => {
          const post = normalizePost(row);
          return followedUsernames.has(String(post.owner?.username || "").toLowerCase());
        });
      } else if (feedMode === "liked") {
        const statuses = await Promise.all(rows.map((row) => {
          const post = normalizePost(row);
          return request(`/posts/${post.id}/like`).catch(() => ({ liked: false }));
        }));
        matchingRows = rows.filter((row, index) => {
          const postId = Number(normalizePost(row).id);
          const liked = statuses[index]?.liked === true;
          if (liked) likedPostIds.add(postId);
          else likedPostIds.delete(postId);
          return liked;
        });
      }
      collected.push(...matchingRows);
      if (rows.length < pageSize || rows.length === 0) break;
    }

    if (collected.length) elements.feedList.querySelector(".empty-state")?.remove();
    for (const row of collected.slice(0, pageSize)) elements.feedList.append(createPostCard(row));
    if (reset && collected.length === 0) {
      const message = feedMode === "following"
        ? "No posts from people you follow yet. Follow someone or check back later."
        : feedMode === "liked"
          ? "You haven’t liked any posts yet."
          : "No posts yet. Share the first one!";
      elements.feedList.append(makeElement("div", "empty-state", message));
    }
    elements.loadMore.hidden = exhausted;
    if (feedMode === "liked") document.querySelector("#liked-count").textContent = `${likedPostIds.size}${exhausted ? "" : "+"}`;
    elements.feedStatus.textContent = collected.length ? "" : (exhausted ? "" : "No matching posts in this batch. Load more to keep looking.");
  } catch (error) {
    elements.feedStatus.textContent = `Could not load posts: ${error.message}`;
  } finally {
    elements.loadMore.disabled = false;
    requestAnimationFrame(checkInfiniteScroll);
  }
}

function selectFeed(mode) {
  if (activePublicProfile) {
    activePublicProfile = null;
    publicProfileUser = null;
    elements.publicProfileView.hidden = true;
    elements.appView.classList.remove("profile-open");
    elements.profileSettingsButton.hidden = true;
    elements.feedTabs.hidden = false;
    elements.feedContent.hidden = false;
  }
  feedMode = mode;
  for (const [tab, selected] of [
    [elements.allPostsTab, mode === "all"],
    [elements.followingFeedTab, mode === "following"],
  ]) {
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  }
  elements.savedListButton.classList.toggle("is-active", mode === "saved");
  elements.likedListButton.classList.toggle("is-active", mode === "liked");
  document.querySelector("#feed-heading-title").textContent = { all: "Feed", following: "Following", saved: "Saved posts", liked: "Liked posts" }[mode];
  loadFeed(true);
}
