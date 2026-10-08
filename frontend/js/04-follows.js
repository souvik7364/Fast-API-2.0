// Follow state and connection-list helpers.
function updateFollowButton(button, username) {
  const following = followedUsernames.has(String(username).toLowerCase());
  button.textContent = following ? "✓ Following" : "＋ Follow";
  button.classList.toggle("is-following", following);
}

function updateAllFollowButtons() {
  document.querySelectorAll("button[data-follow-username]").forEach((button) => {
    updateFollowButton(button, button.dataset.followUsername);
  });
}

async function loadFollowedUsers() {
  if (!currentUsername) return;
  try {
    const users = await request(`/users/${encodeURIComponent(currentUsername)}/following`);
    followedUsernames = new Set(users.map((user) => user.username.toLowerCase()));
    updateAllFollowButtons();
  } catch (error) {
    showToast(`Could not load following list: ${error.message}`);
  }
}

function renderConnections() {
  const users = connectionsMode === "following" ? following : followers;
  elements.connectionsList.replaceChildren();
  elements.connectionsStatus.textContent = users.length ? "" : `No ${connectionsMode} yet.`;
  for (const user of users) {
    const row = makeElement("div", "connection-row");
    const avatar = makeElement("span", "connection-avatar");
    setAvatar(avatar, user.id, user.username);
    const identity = makeElement("button", "connection-username profile-link", `@${user.username}`);
    identity.type = "button";
    identity.addEventListener("click", () => openPublicProfile(user.username));
    row.append(avatar, identity);
    elements.connectionsList.append(row);
  }
}

async function loadConnections() {
  if (!currentUsername) return;
  elements.connectionsStatus.textContent = "Loading connections…";
  try {
    const username = encodeURIComponent(currentUsername);
    [followers, following] = await Promise.all([
      request(`/users/${username}/followers`),
      request(`/users/${username}/following`),
    ]);
    document.querySelector("#followers-count").textContent = followers.length;
    document.querySelector("#following-count").textContent = following.length;
    renderConnections();
  } catch (error) {
    elements.connectionsStatus.textContent = `Could not load connections: ${error.message}`;
  }
}

async function toggleFollow(username, button) {
  const normalizedUsername = String(username).toLowerCase();
  const currentlyFollowing = followedUsernames.has(normalizedUsername);
  button.disabled = true;
  try {
    if (currentlyFollowing) {
      await request(`/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" });
      followedUsernames.delete(normalizedUsername);
      showToast(`You unfollowed @${username}.`);
    } else {
      await request(`/users/${encodeURIComponent(username)}/follow`, { method: "POST" });
      followedUsernames.add(normalizedUsername);
      showToast(`You are now following @${username}.`);
    }
    updateAllFollowButtons();
    await Promise.all([loadFollowedUsers(), loadConnections()]);
    if (feedMode === "following" && !activePublicProfile) await loadFeed(true);
  } catch (error) {
    await loadFollowedUsers();
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

