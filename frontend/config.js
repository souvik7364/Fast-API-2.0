// Keep the local API URL for Live Server. Set the deployed API URL before publishing.
(() => {
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  const productionApiUrl = "https://fast-api-lxcx.onrender.com";
  const apiUrl = localHosts.has(window.location.hostname)
    ? "http://localhost:8000"
    : productionApiUrl;
  window.CHITTHI_API_BASE = apiUrl.replace(/\/+$/, "");
})();
