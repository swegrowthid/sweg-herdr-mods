// Pure decisions for the new-workspace dialog: paths, listing parsing and
// recents. No Herdr, no GPUI, no I/O, so the tests need no doubles.

const KEEP_RECENTS = 5;

function cleanHome(homeDir) {
  return String(homeDir ?? "").replace(/\/+$/, "") || "/";
}

export function normalize(path, homeDir) {
  const homePath = cleanHome(homeDir);
  let p = String(path ?? "").trim();
  if (!p || p === "~") return homePath;
  if (p.startsWith("~/")) p = homePath + p.slice(1);
  p = p.replace(/\/+$/, "");
  return p || "/";
}

export function parentOf(path) {
  if (path === "/") return null;
  const cut = path.lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
}

export function nameOf(path) {
  return path === "/" ? "/" : path.slice(path.lastIndexOf("/") + 1);
}

function under(path, base) {
  return path === base || path.startsWith(base + "/");
}

// The last three folders after ~ or /: a deep path keeps its tail, which is
// the part that names the workspace.
export function crumbs(path, homeDir) {
  const homePath = cleanHome(homeDir);
  const atHome = under(path, homePath);
  const out = atHome ? [{ name: "~", path: homePath }] : [{ name: "/", path: "/" }];
  const parts = (atHome ? path.slice(homePath.length) : path).split("/").filter(Boolean);
  const keep = parts.slice(-3);
  let at = atHome ? homePath : "";
  for (let i = 0; i < parts.length - keep.length; i++) at += "/" + parts[i];
  for (const part of keep) {
    at += "/" + part;
    out.push({ name: part, path: at });
  }
  return out;
}

export function places(homeDir) {
  const homePath = cleanHome(homeDir);
  return [
    { name: "Home", path: homePath, icon: "mods/files/folder.svg" },
    { name: "Desktop", path: homePath + "/Desktop", icon: "mods/workspace-chrome/monitor.svg" },
    { name: "Documents", path: homePath + "/Documents", icon: "mods/workspace-chrome/file-text.svg" },
    { name: "Downloads", path: homePath + "/Downloads", icon: "mods/workspace-chrome/archive.svg" },
  ];
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];
}

// Last opened first, then folders of the spaces already open on this machine.
export function recents(kept, spaces, homeDir, limit = KEEP_RECENTS) {
  const seen = new Set();
  const out = [];
  const add = (value) => {
    if (typeof value !== "string" || !value) return;
    const path = normalize(value, homeDir);
    if (seen.has(path)) return;
    seen.add(path);
    out.push(path);
  };
  stringList(kept).forEach(add);
  (Array.isArray(spaces) ? spaces : []).forEach((space) => {
    if (!space || space.machine || !space.folder) return;
    add(space.folder);
  });
  return out.slice(0, limit);
}

export function remember(folder, kept, limit = KEEP_RECENTS) {
  return [folder, ...stringList(kept).filter((path) => path !== folder)].slice(0, limit);
}

// The shell prints W or R for the folder itself, then one NUL-terminated name
// per writable subfolder. Parse it once, here, into the values the view uses.
export function parseListing(stdout) {
  const parts = String(stdout ?? "").split("\0");
  return {
    writable: parts[0] === "W",
    entries: parts.slice(1).filter(Boolean).sort((a, b) => a.localeCompare(b)),
  };
}

// Navigation history: one list, one index. `hi` is the folder on screen.
// recordNav drops the forward tail on a new jump, like a browser does.
export function recordNav(state, path) {
  if (state.list[state.hi] === path) return state;
  const list = state.list.slice(0, state.hi + 1);
  list.push(path);
  return { list, hi: list.length - 1 };
}

export function canBack(state) {
  return state.hi > 0;
}

export function canForward(state) {
  return state.hi < state.list.length - 1;
}

export function goBack(state) {
  return canBack(state) ? { list: state.list, hi: state.hi - 1 } : null;
}

export function goForward(state) {
  return canForward(state) ? { list: state.list, hi: state.hi + 1 } : null;
}
