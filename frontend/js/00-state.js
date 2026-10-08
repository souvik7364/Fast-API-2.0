// Shared constants, DOM references, and application state. Load first.
const API_BASE = window.CHITTHI_API_BASE || "";
const APP_STORAGE_PREFIX = "chitthi_";
const TOKEN_KEY = `${APP_STORAGE_PREFIX}access_token`;
const EMAIL_KEY = `${APP_STORAGE_PREFIX}user_email`;
const THEME_KEY = `${APP_STORAGE_PREFIX}theme`;
const BACKGROUND_KEY = `${APP_STORAGE_PREFIX}background_image`;
const SAVED_POSTS_KEY = `${APP_STORAGE_PREFIX}saved_posts_`;
const DISLIKED_POSTS_KEY = `${APP_STORAGE_PREFIX}disliked_posts_`;
const PROFILE_PICTURE_KEY = `${APP_STORAGE_PREFIX}profile_picture_`;
const PROFILE_PICTURE_USERNAME_KEY = `${APP_STORAGE_PREFIX}profile_picture_username_`;
const PROFILE_COVER_KEY = `${APP_STORAGE_PREFIX}profile_cover_`;
const POST_IMAGE_MARKER = "\n\n[[CHITTHI_IMAGE:";
const REPLY_IMAGE_MARKER = "\n\n[[CHITTHI_REPLY_IMAGE:";
const LEGACY_POST_IMAGE_MARKER = "\n\n[[CHIRP_IMAGE:";
const LEGACY_REPLY_IMAGE_MARKER = "\n\n[[CHIRP_REPLY_IMAGE:";
const MAX_BACKGROUND_BYTES = 3 * 1024 * 1024;
const MAX_POST_IMAGE_DATA_URL_LENGTH = 450_000;

function migrateLegacyStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const oldKey = storage.key(index);
      if (!oldKey?.startsWith("chirp_")) continue;
      const newKey = `${APP_STORAGE_PREFIX}${oldKey.slice("chirp_".length)}`;
      if (storage.getItem(newKey) === null) storage.setItem(newKey, storage.getItem(oldKey));
      storage.removeItem(oldKey);
    }
  }
}

try { migrateLegacyStorage(); } catch { /* Keep the app usable if browser storage is blocked. */ }

const elements = {
  authView: document.querySelector("#auth-view"),
  appView: document.querySelector("#app-view"),
  accountArea: document.querySelector("#account-area"),
  accountUsername: document.querySelector("#account-username"),
  accountEmail: document.querySelector("#account-email"),
  profileSettingsButton: document.querySelector("#profile-settings-button"),
  sidebarSettingsButton: document.querySelector("#sidebar-settings-button"),
  sidebar: document.querySelector(".profile-sidebar"),
  composeForm: document.querySelector("#compose-form"),
  profileComposeColumn: document.querySelector("#profile-compose-column"),
  userSearchForm: document.querySelector("#user-search-form"),
  userSearchInput: document.querySelector("#user-search-input"),
  userSearchResults: document.querySelector("#user-search-results"),
  sidebarUsername: document.querySelector("#sidebar-username"),
  sidebarAvatar: document.querySelector("#sidebar-avatar"),
  sidebarEmail: document.querySelector("#sidebar-email"),
  sidebarAbout: document.querySelector("#sidebar-about"),
  connectionsList: document.querySelector("#connections-list"),
  connectionsStatus: document.querySelector("#connections-status"),
  feedTabs: document.querySelector("#feed-tabs"),
  allPostsTab: document.querySelector("#all-posts-tab"),
  followingFeedTab: document.querySelector("#following-feed-tab"),
  savedListButton: document.querySelector("#saved-list-button"),
  likedListButton: document.querySelector("#liked-list-button"),
  feedContent: document.querySelector("#feed-content"),
  publicProfileView: document.querySelector("#public-profile-view"),
  publicProfileCard: document.querySelector("#public-profile-card"),
  publicProfileStatus: document.querySelector("#public-profile-status"),
  publicProfilePosts: document.querySelector("#public-profile-posts"),
  publicProfileTabs: document.querySelector("#public-profile-tabs"),
  publicProfileConnections: document.querySelector("#public-profile-connections"),
  publicProfileMore: document.querySelector("#public-profile-more"),
  authTitle: document.querySelector("#auth-title"),
  authCopy: document.querySelector("#auth-copy"),
  loginTab: document.querySelector("#login-tab"),
  registerTab: document.querySelector("#register-tab"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  profileForm: document.querySelector("#profile-form"),
  authStatus: document.querySelector("#auth-status"),
  feedList: document.querySelector("#feed-list"),
  feedStatus: document.querySelector("#feed-status"),
  loadMore: document.querySelector("#load-more"),
  toast: document.querySelector("#toast"),
};

function readUserId(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return Number(JSON.parse(atob(payload)).user_id);
  } catch {
    return null;
  }
}

let accessToken = sessionStorage.getItem(TOKEN_KEY);
let currentUserId = accessToken ? readUserId(accessToken) : null;
let currentUsername = "";
let followedUsernames = new Set();
let followers = [];
let following = [];
let connectionsMode = "following";
let likedPostIds = new Set();
let currentSkip = 0;
let feedMode = "all";
let savedPostIds = new Set();
let dislikedPostIds = new Set();
let selectedPostImage = "";
let profilePictureDraft = null;
let profileCoverDraft = null;
let activeCropImage = null;
let activeCropKind = "avatar";
let resolveCropSelection = null;
let activePublicProfile = null;
let publicProfileUser = null;
let publicProfileMode = "posts";
let publicProfileFollowers = [];
let publicProfileFollowing = [];
let publicProfileSkip = 0;
let publicProfileHasMore = false;
let publicProfilePostViews = new Map();
let profileHistory = [];
const pageSize = 10;
let toastTimer;
let userSearchTimer;
let userSearchRequestId = 0;
