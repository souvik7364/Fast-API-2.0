// Search-result rendering, profile navigation, and profile tabs.
function renderUserSearchResults(users) {
  const results = document.querySelector("#user-search-results");
  results.replaceChildren();
  results.hidden = false;
  if (!users.length) {
    const empty = makeElement("p", "user-search-empty", "No matching accounts.");
    results.append(empty);
    return;
  }

  for (const user of users) {
    const row = makeElement("button", "user-result", "");
    row.type = "button";
    row.setAttribute("aria-label", `Open @${user.username}'s profile`);
    row.addEventListener("click", () => openPublicProfile(user.username));
    const avatar = makeElement("span", "user-result-avatar");
    setAvatar(avatar, user.id, user.username);
    row.append(avatar, makeElement("span", "user-result-name", `@${user.username}`));
    results.append(row);
  }
}

function renderProfileTabs(isOwnProfile) {
  const tabs = [
    ["posts", isOwnProfile ? "My posts" : "Posts"],
    ...(isOwnProfile ? [["compose", "Share a post"], ["liked", "Liked posts"], ["saved", "Saved posts"]] : []),
    ["followers", "Followers"],
    ["following", "Following"],
  ];
  elements.publicProfileTabs.replaceChildren();
  for (const [mode, label] of tabs) {
    const button = makeElement("button", "public-profile-tab", label);
    button.type = "button";
    button.dataset.profileMode = mode;
    button.classList.toggle("is-active", mode === publicProfileMode);
    button.setAttribute("aria-selected", String(mode === publicProfileMode));
    button.addEventListener("click", () => setPublicProfileMode(mode));
    elements.publicProfileTabs.append(button);
  }
}

function renderProfileConnections(users) {
  elements.publicProfileConnections.replaceChildren();
  if (!users.length) {
    elements.publicProfileConnections.append(makeElement("div", "empty-state", `No ${publicProfileMode} yet.`));
    return;
  }
  for (const user of users) {
    const row = makeElement("article", "profile-connection-row");
    const avatar = makeElement("span", "connection-avatar");
    setAvatar(avatar, user.id, user.username);
    const identity = makeElement("button", "profile-connection-name", `@${user.username}`);
    identity.type = "button";
    identity.addEventListener("click", () => openPublicProfile(user.username));
    row.append(avatar, identity);
    elements.publicProfileConnections.append(row);
  }
}

function animateProfilePanel(panel) {
  panel.classList.remove("profile-panel-enter");
  void panel.offsetWidth;
  panel.classList.add("profile-panel-enter");
  panel.addEventListener("animationend", () => panel.classList.remove("profile-panel-enter"), { once: true });
}

function setPublicProfileMode(mode) {
  if (!publicProfileUser) return;
  const previousMode = publicProfileMode;
  if (["posts", "liked", "saved"].includes(previousMode) && previousMode !== mode) {
    const cachedContent = document.createElement("div");
    while (elements.publicProfilePosts.firstChild) cachedContent.append(elements.publicProfilePosts.firstChild);
    publicProfilePostViews.set(previousMode, {
      content: cachedContent,
      skip: publicProfileSkip,
      hasMore: !elements.publicProfileMore.hidden,
      status: elements.publicProfileStatus.textContent,
    });
  }
  publicProfileMode = mode;
  const isOwnProfile = Number(publicProfileUser.id) === Number(currentUserId);
  for (const tab of elements.publicProfileTabs.querySelectorAll(".public-profile-tab")) {
    const selected = tab.dataset.profileMode === mode;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  }
  const isConnections = mode === "followers" || mode === "following";
  const isCompose = mode === "compose" && isOwnProfile;
  elements.profileComposeColumn.hidden = !isCompose;
  elements.publicProfilePosts.hidden = isConnections || isCompose;
  elements.publicProfileConnections.hidden = !isConnections;
  elements.publicProfileMore.hidden = true;
  elements.publicProfileMore.textContent = mode === "liked" ? "Load more liked posts" : mode === "saved" ? "Load more saved posts" : "Load more posts";
  if (isCompose) {
    elements.publicProfileStatus.textContent = "";
    setComposerExpanded(true);
    animateProfilePanel(elements.profileComposeColumn);
    return;
  }
  if (mode === "followers") {
    elements.publicProfileStatus.textContent = "";
    renderProfileConnections(publicProfileFollowers);
    animateProfilePanel(elements.publicProfileConnections);
  } else if (mode === "following") {
    elements.publicProfileStatus.textContent = "";
    renderProfileConnections(publicProfileFollowing);
    animateProfilePanel(elements.publicProfileConnections);
  } else {
    elements.publicProfileConnections.replaceChildren();
    const cached = publicProfilePostViews.get(mode);
    if (cached) {
      elements.publicProfilePosts.replaceChildren();
      while (cached.content.firstChild) elements.publicProfilePosts.append(cached.content.firstChild);
      publicProfileSkip = cached.skip;
      publicProfileHasMore = cached.hasMore;
      elements.publicProfileMore.hidden = !cached.hasMore;
      elements.publicProfileStatus.textContent = cached.status;
      animateProfilePanel(elements.publicProfilePosts);
      return;
    }
    animateProfilePanel(elements.publicProfilePosts);
    loadPublicProfilePosts(true);
  }
}

async function openPublicProfile(username, trackHistory = true) {
  const normalized = String(username).trim().replace(/^@/, "");
  if (!normalized) return;
  if (trackHistory && activePublicProfile && activePublicProfile !== normalized.toLowerCase()) {
    profileHistory.push(publicProfileUser?.username || activePublicProfile);
  }
  const backLabel = profileHistory.length ? "Back to previous profile" : "Back to feed";
  document.querySelector("#profile-back-button").setAttribute("aria-label", backLabel);
  document.querySelector("#profile-back-button").title = backLabel;
  activePublicProfile = normalized.toLowerCase();
  publicProfileUser = null;
  publicProfileMode = "posts";
  publicProfileSkip = 0;
  publicProfileHasMore = true;
  publicProfilePostViews = new Map();
  setComposerExpanded(false);
  elements.appView.classList.add("profile-open");
  elements.profileSettingsButton.hidden = false;
  elements.profileComposeColumn.hidden = true;
  elements.sidebar.insertBefore(elements.composeForm, document.querySelector(".library-card"));
  elements.userSearchResults.hidden = true;
  elements.feedTabs.hidden = true;
  elements.feedContent.hidden = true;
  elements.publicProfileView.hidden = false;
  elements.publicProfileCard.replaceChildren();
  elements.publicProfilePosts.replaceChildren();
  elements.publicProfileConnections.replaceChildren();
  elements.publicProfileConnections.hidden = true;
  elements.publicProfilePosts.hidden = false;
  elements.publicProfileTabs.replaceChildren();
  elements.publicProfileStatus.textContent = "Loading profile…";
  elements.publicProfileMore.hidden = true;

  try {
    const [profile, followersList, followingList] = await Promise.all([
      request(`/users/${encodeURIComponent(normalized)}`),
      request(`/users/${encodeURIComponent(normalized)}/followers`),
      request(`/users/${encodeURIComponent(normalized)}/following`),
    ]);
    if (activePublicProfile !== profile.username.toLowerCase()) return;
    publicProfileUser = profile;
    publicProfileFollowers = followersList;
    publicProfileFollowing = followingList;
    const isOwnProfile = Number(profile.id) === Number(currentUserId);
    elements.profileComposeColumn.hidden = true;
    document.querySelector("#profile-workspace").classList.toggle("is-own-profile", isOwnProfile);
    if (isOwnProfile) document.querySelector("#profile-compose-slot").append(elements.composeForm);

    const hero = makeElement("div", "profile-hero");
    const banner = makeElement("div", "profile-hero-banner");
    const cover = localStorage.getItem(`${PROFILE_COVER_KEY}${profile.id}`) || "";
    banner.classList.toggle("has-profile-cover", Boolean(cover));
    if (cover) banner.style.backgroundImage = `linear-gradient(rgba(20, 25, 35, .16), rgba(20, 25, 35, .16)), url("${cover}")`;
    const avatar = makeElement("span", "profile-large-avatar");
    setAvatar(avatar, profile.id, profile.username);
    const identity = makeElement("div", "public-profile-identity");
    identity.append(
      makeElement("h1", "profile-display-name", profile.username),
      makeElement("p", "profile-handle", `@${profile.username}`),
    );
    if (profile.about) identity.append(makeElement("p", "profile-about-text", profile.about));
    const header = makeElement("div", "profile-hero-header");
    header.append(avatar, identity);
    if (Number(profile.id) === Number(currentUserId)) {
      const editButton = makeElement("button", "button button-outline profile-edit-button", "Edit profile");
      editButton.type = "button";
      editButton.addEventListener("click", openProfileEditor);
      header.append(editButton);
    } else {
      const followButton = makeElement("button", "button button-primary profile-follow-button", "＋ Follow");
      followButton.type = "button";
      followButton.dataset.followUsername = profile.username;
      updateFollowButton(followButton, profile.username);
      followButton.addEventListener("click", async () => {
        await toggleFollow(profile.username, followButton);
        if (activePublicProfile === profile.username.toLowerCase()) await openPublicProfile(profile.username);
      });
      header.append(followButton);
    }
    const stats = makeElement("div", "profile-hero-stats");
    const followerStat = makeElement("button", "profile-stat-button");
    followerStat.append(makeElement("strong", "", followersList.length), document.createTextNode(" Followers"));
    const followingStat = makeElement("button", "profile-stat-button");
    followingStat.append(makeElement("strong", "", followingList.length), document.createTextNode(" Following"));
    followerStat.type = "button";
    followingStat.type = "button";
    followerStat.addEventListener("click", () => setPublicProfileMode("followers"));
    followingStat.addEventListener("click", () => setPublicProfileMode("following"));
    stats.append(followerStat, followingStat);
    hero.append(banner, header, stats);
    elements.publicProfileCard.replaceChildren(hero);
    renderProfileTabs(Number(profile.id) === Number(currentUserId));
    await loadPublicProfilePosts(true);
  } catch (error) {
    elements.publicProfileStatus.textContent = `Could not load profile: ${error.message}`;
  }
}

async function loadPublicProfilePosts(reset = false) {
  const profile = publicProfileUser;
  if (!profile || activePublicProfile !== profile.username.toLowerCase()) return;
  const mode = publicProfileMode;
  if (reset) {
    publicProfileSkip = 0;
    publicProfileHasMore = true;
    elements.publicProfilePosts.replaceChildren();
  }
  elements.publicProfileStatus.textContent = mode === "liked" ? "Loading liked posts…" : mode === "saved" ? "Loading saved posts…" : "Loading posts…";
  elements.publicProfileMore.disabled = true;

  try {
    if (mode === "saved") {
      const ids = [...savedPostIds].reverse();
      const selected = ids.slice(publicProfileSkip, publicProfileSkip + pageSize);
      const rows = await Promise.all(selected.map((id) => request(`/posts/${id}`).catch((error) => error.status === 404 ? null : Promise.reject(error))));
      if (activePublicProfile !== profile.username.toLowerCase() || publicProfileMode !== mode) return;
      rows.filter(Boolean).forEach((row) => elements.publicProfilePosts.append(createPostCard(row)));
      publicProfileSkip += selected.length;
      const more = publicProfileSkip < savedPostIds.size;
      elements.publicProfileMore.hidden = !more;
      elements.publicProfileStatus.textContent = rows.some(Boolean) ? "Saved posts are stored in this browser." : "No saved posts yet.";
      animateProfilePanel(elements.publicProfilePosts);
      return;
    }

    let added = 0;
    let exhausted = false;
    for (let page = 0; page < 8 && added < pageSize; page += 1) {
      const rows = await request(`/posts/?limit=${pageSize}&skip=${publicProfileSkip}`);
      if (activePublicProfile !== profile.username.toLowerCase() || publicProfileMode !== mode) return;
      publicProfileSkip += rows.length;
      if (rows.length < pageSize) exhausted = true;
      for (const row of rows) {
        const post = normalizePost(row);
        let matches = Number(post.owner_id) === Number(profile.id);
        if (mode === "liked") {
          const status = await request(`/posts/${post.id}/like`).catch(() => ({ liked: false }));
          matches = status?.liked === true;
        }
        if (matches) {
          elements.publicProfilePosts.append(createPostCard(row));
          added += 1;
        }
      }
      if (rows.length < pageSize || rows.length === 0) break;
    }
    publicProfileHasMore = !exhausted;
    elements.publicProfileMore.hidden = exhausted;
    const hasPosts = elements.publicProfilePosts.childElementCount > 0;
    elements.publicProfileStatus.textContent = hasPosts
      ? (added === 0 ? (mode === "liked" ? "No more liked posts." : "No more posts from this profile.") : "")
      : (exhausted ? (mode === "liked" ? "No liked posts yet." : "This profile has no posts yet.") : "No recent posts found yet. Load more to keep looking.");
    animateProfilePanel(elements.publicProfilePosts);
  } catch (error) {
    elements.publicProfileStatus.textContent = `Could not load profile posts: ${error.message}`;
  } finally {
    elements.publicProfileMore.disabled = false;
    requestAnimationFrame(checkInfiniteScroll);
  }
}

function closePublicProfile() {
  if (profileHistory.length) {
    const previousProfile = profileHistory.pop();
    openPublicProfile(previousProfile, false);
    return;
  }
  activePublicProfile = null;
  publicProfileUser = null;
  profileHistory = [];
  elements.profileComposeColumn.hidden = true;
  setComposerExpanded(false);
  document.querySelector("#profile-workspace").classList.remove("is-own-profile");
  elements.sidebar.insertBefore(elements.composeForm, document.querySelector(".library-card"));
  elements.publicProfileView.hidden = true;
  elements.appView.classList.remove("profile-open");
  elements.profileSettingsButton.hidden = true;
  elements.feedTabs.hidden = false;
  elements.feedContent.hidden = false;
  document.querySelector("#feed-heading-title").textContent = { all: "Feed", following: "Following", saved: "Saved posts", liked: "Liked posts" }[feedMode];
  elements.publicProfilePosts.hidden = false;
  elements.feedList.focus?.();
}
