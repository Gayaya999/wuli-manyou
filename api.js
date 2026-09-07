const PROFILE_KEY = "qo-visitor-profile";
const DISKS_KEY = "qo-visitor-disks";
const TALKS_KEY = "qo-visitor-talks";
const POSTS_KEY = "qo-community-posts";
const MIGRATED_KEY = "qo-migrated-v1";

export function apiRoot() {
  return (document.documentElement.dataset.scientistAgentApi || "").replace(/\/$/, "");
}

export function apiEnabled() {
  return Boolean(apiRoot());
}

export function mediaUrl(path) {
  if (!path) return "";
  if (
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }
  const root = apiRoot();
  if (root === "/api" && path.startsWith("/api/")) return path;
  return root ? `${root}${path}` : path;
}

export async function api(path, { method = "GET", json } = {}) {
  const root = apiRoot();
  if (!root) throw new Error("api offline");
  const headers = {};
  const options = { method, credentials: "include", headers };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(json);
  }
  const url = root === "/api" && path.startsWith("/api/") ? path : `${root}${path}`;
  const response = await fetch(url, options);
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item.msg || item).join("; ")
          : `api ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export async function migrateLocalIfNeeded() {
  if (!apiEnabled() || localStorage.getItem(MIGRATED_KEY)) return;
  const profile = readJson(PROFILE_KEY, {}) || {};
  const disks = Array.isArray(readJson(DISKS_KEY, [])) ? readJson(DISKS_KEY, []) : [];
  const talks = readJson(TALKS_KEY, {}) || {};
  const posts = Array.isArray(readJson(POSTS_KEY, [])) ? readJson(POSTS_KEY, []) : [];
  const hasProfile = Boolean(profile.name || profile.portrait);
  const hasTalks = talks && typeof talks === "object" && Object.values(talks).some((log) => Array.isArray(log) && log.length);
  const ownedPosts = posts.filter((item) => item?.owned && item?.name && item?.note);
  if (!hasProfile && !disks.length && !hasTalks && !ownedPosts.length) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }
  await api("/api/me/import", {
    method: "POST",
    json: {
      profile: {
        name: profile.name || "",
        latin: profile.latin || "",
        portrait: profile.portrait || "",
      },
      disks: disks
        .filter((item) => item?.name && item?.image)
        .map((item) => ({
          id: item.id,
          name: item.name,
          latin: item.latin || "",
          years: item.years || "",
          keywords: item.keywords || "",
          shellId: item.shellId || "graphite",
          archive: item.archive || "",
          image: item.image,
        })),
      talks,
      posts: ownedPosts.map((item) => ({
        name: item.name,
        note: item.note || "",
        latin: item.latin || "",
        years: item.years || "",
        keywords: item.keywords || "",
        shellId: item.shellId || "graphite",
        archive: item.archive || "",
        image: item.image || "",
      })),
    },
  });
  localStorage.setItem(MIGRATED_KEY, "1");
}

export function fromServerDisk(disk) {
  return {
    id: disk.id,
    name: disk.name,
    latin: disk.latin,
    years: disk.years,
    keywords: disk.keywords,
    shellId: disk.shellId,
    archive: disk.archive,
    image: mediaUrl(disk.imageUrl) || disk.image,
    owned: true,
    createdAt: disk.createdAt,
  };
}
