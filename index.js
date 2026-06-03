const PANEL_ID = "git-viewer";
const PAGE_SIZE = 30;
const MAX_LIMIT = 180;

export default function activate(context) {
  ensureToolbarButton(context.app);
  const panel = ensurePanel(context.app);
  const state = { commits: [], limit: PAGE_SIZE, hasMore: false, selectedHash: "" };

  panel.addEventListener("click", (event) => {
    const target = event.target.closest("[data-git-viewer-action]");
    if (!target || !panel.contains(target)) return;
    event.preventDefault();
    handleAction(context, state, panel, target);
  });

  window.addEventListener("pi-plugin-sidebar:open", (event) => {
    syncToolbarButton(context.app);
    if (event.detail?.panel === PANEL_ID) refresh(context, state, panel, PAGE_SIZE);
  });
  window.addEventListener("pi-workspace:active", () => refresh(context, state, panel, PAGE_SIZE));

  context.app.syncPluginSidebarPanels?.();
  syncToolbarButton(context.app);
  refresh(context, state, panel, PAGE_SIZE);
}

function ensureToolbarButton(app) {
  const toolbar = app.querySelector("[data-plugin-toolbar]") || app.querySelector(".topbar .actions");
  if (!toolbar) return undefined;
  const existing = toolbar.querySelector(`[data-plugin-toolbar-button="${PANEL_ID}"]`);
  if (existing) return existing;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "iconbtn workspace-explorer-btn";
  button.dataset.action = "toggle-plugin-sidebar";
  button.dataset.pluginPanel = PANEL_ID;
  button.dataset.pluginToolbarButton = PANEL_ID;
  button.title = "git viewer";
  button.hidden = app.dataset.route !== "workspace";
  button.setAttribute("aria-label", "toggle git viewer");
  button.append(materialThemeIcon("git"));
  toolbar.insertBefore(button, toolbar.querySelector(".statusbtn"));
  return button;
}

function materialThemeIcon(name, size = 16) {
  const img = document.createElement("img");
  img.alt = "";
  img.width = size;
  img.height = size;
  img.src = `/node_modules/material-icon-theme/icons/${name}.svg`;
  return img;
}

function syncToolbarButton(app) {
  const button = app.querySelector(`[data-plugin-toolbar-button="${PANEL_ID}"]`);
  const sidebar = app.querySelector("[data-plugin-sidebar]");
  button?.classList.toggle("on", app.dataset.tree === "on" && sidebar?.dataset.activePluginPanel === PANEL_ID);
}

function ensurePanel(app) {
  const sidebar = app.querySelector("[data-plugin-sidebar]");
  let panel = sidebar.querySelector(`[data-plugin-panel="${PANEL_ID}"]`);
  if (panel) return panel;

  panel = document.createElement("section");
  panel.dataset.pluginPanel = PANEL_ID;
  panel.className = "pi-git-viewer-panel";
  panel.append(createStyle(), createHeader(), createBody());
  sidebar.append(panel);
  return panel;
}

function createStyle() {
  const style = document.createElement("style");
  style.textContent = [
    ".pi-git-viewer-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }",
    ".pi-git-viewer-panel .git-panel { flex: 1 1 auto; min-height: 0; overflow: hidden; }",
    ".pi-git-viewer-panel .git-history-grid { height: 100%; min-height: 0; }",
    ".pi-git-viewer-panel .git-commit-scroll { min-height: 0; overflow-y: auto; scrollbar-gutter: stable; }",
    ".pi-git-viewer-panel .git-detail { min-height: 0; overflow: auto; }",
  ].join("\n");
  return style;
}

function createHeader() {
  const header = document.createElement("div");
  header.className = "tree-head";
  const tabs = document.createElement("span");
  tabs.className = "tree-tabs";
  const title = document.createElement("span");
  title.className = "tree-tab on";
  title.append(materialThemeIcon("git", 14), document.createTextNode(" git"));
  tabs.append(title);
  const actions = document.createElement("span");
  actions.className = "tree-head-actions";
  const status = document.createElement("span");
  status.className = "branch";
  status.dataset.gitViewerStatus = "";
  status.textContent = "—";
  actions.append(status, actionButton("refresh", "↻", "refresh git"));
  header.append(tabs, actions);
  return header;
}

function createBody() {
  const body = document.createElement("div");
  body.className = "git-panel";
  body.dataset.gitViewerBody = "";
  body.append(emptyNode("git history loads when opened"));
  return body;
}

function actionButton(action, label, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.gitViewerAction = action;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.textContent = label;
  return button;
}

async function refresh(context, state, panel, limit = state.limit) {
  const workspaceId = context.app.dataset.activeWorkspaceId;
  if (!workspaceId) {
    setBody(panel, [emptyNode("open a workspace first")]);
    return;
  }

  state.limit = limit;
  setBody(panel, [emptyNode("loading git history…")]);
  try {
    const history = await context.backend("history", { workspaceId, data: { limit } });
    if (history.status) renderStatus(context.app, panel, history.status);
    state.commits = history.commits || [];
    state.hasMore = state.commits.length >= limit && limit < MAX_LIMIT;
    renderHistory(context, state, panel);
  } catch (error) {
    const node = emptyNode(error.message || "git history unavailable");
    node.classList.add("err");
    setBody(panel, [node]);
  }
}

function renderStatus(app, panel, status) {
  const text = `${status.branch || "—"} · ${status.dirty || 0} ✱`;
  panel.querySelector("[data-git-viewer-status]").textContent = text;
  app.querySelector("[data-git-status]")?.replaceChildren(document.createTextNode(text));
  if (status.branch) app.updatePromptMeta?.({ currentBranch: status.branch });
}

function renderHistory(context, state, panel) {
  if (state.commits.length === 0) {
    setBody(panel, [emptyNode("no commits found")]);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "git-history-grid";
  grid.dataset.gitHistoryGrid = "";
  const toolbar = document.createElement("div");
  toolbar.className = "git-history-toolbar";
  const loadMore = actionButton("load-more", "load 30 more", "load 30 more");
  loadMore.disabled = !state.hasMore;
  toolbar.append(loadMore);
  const scroll = document.createElement("div");
  scroll.className = "git-commit-scroll";
  const list = document.createElement("div");
  list.className = "git-commit-list";
  list.append(...state.commits.map((commit) => commitRow(commit, state.selectedHash)));
  scroll.append(list);
  grid.append(toolbar, scroll);
  setBody(panel, [grid]);
}

function commitRow(commit, selectedHash) {
  const hash = commit.hash || commit.shortHash || "";
  const row = document.createElement("button");
  row.type = "button";
  row.className = ["git-commit-row", selectedHash === hash ? "selected" : ""].filter(Boolean).join(" ");
  row.dataset.gitViewerAction = "select";
  row.dataset.hash = hash;
  const main = document.createElement("span");
  main.className = "git-commit-main";
  const subject = document.createElement("span");
  subject.className = "git-subject";
  subject.textContent = commit.subject || commit.shortHash || hash;
  const meta = document.createElement("span");
  meta.className = "git-meta";
  const code = document.createElement("code");
  code.textContent = commit.shortHash || hash.slice(0, 7);
  meta.append(code, document.createTextNode(` · ${commit.authorName || "unknown"} · ${formatDate(commit.date)}`));
  const stats = document.createElement("span");
  stats.className = "git-stats";
  stats.append(statNode("add", `+${commit.additions || 0}`), statNode("del", `-${commit.deletions || 0}`), statNode("", `${(commit.files || []).length} files`));
  main.append(subject, meta, stats);
  row.append(main);
  return row;
}

function statNode(className, text) {
  const node = document.createElement("span");
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function handleAction(context, state, panel, target) {
  const action = target.dataset.gitViewerAction;
  if (action === "refresh") return refresh(context, state, panel, PAGE_SIZE);
  if (action === "load-more") return refresh(context, state, panel, Math.min(state.limit + PAGE_SIZE, MAX_LIMIT));
  if (action === "select") return selectCommit(context, state, panel, target.dataset.hash || "");
  if (action === "close-detail") {
    state.selectedHash = "";
    renderHistory(context, state, panel);
  }
  return undefined;
}

async function selectCommit(context, state, panel, hash) {
  const workspaceId = context.app.dataset.activeWorkspaceId;
  if (!workspaceId || !hash) return;
  state.selectedHash = hash;
  renderHistory(context, state, panel);
  const grid = panel.querySelector("[data-git-history-grid]");
  grid.classList.add("detail-open");
  const detail = document.createElement("div");
  detail.className = "git-detail";
  detail.append(emptyNode("loading commit…"));
  grid.append(detail);
  try {
    const result = await context.backend("commit", { workspaceId, data: { hash } });
    detail.replaceChildren(...detailNodes(result));
  } catch (error) {
    const node = emptyNode(error.message || "commit unavailable");
    node.classList.add("err");
    detail.replaceChildren(node);
  }
}

function detailNodes(result) {
  const commit = result.commit || {};
  const files = commit.files || [];
  const head = document.createElement("div");
  head.className = "git-detail-head";
  const close = actionButton("close-detail", "×", "close commit details");
  close.className = "git-detail-close";
  const subject = document.createElement("strong");
  subject.textContent = commit.subject || commit.shortHash || "commit";
  const meta = document.createElement("small");
  meta.textContent = `${commit.shortHash || ""} · ${commit.authorName || "unknown"} · ${formatDate(commit.date)}`;
  head.append(close, subject, meta);
  const fileList = document.createElement("div");
  fileList.className = "git-file-list";
  if (files.length) fileList.append(...files.map(fileNode));
  else fileList.append(statNode("git-empty-inline", "no file stats"));
  const message = document.createElement("pre");
  message.className = "git-message";
  message.textContent = result.body || commit.subject || "";
  const nodes = [head, fileList, message];
  if (result.truncated) nodes.push(statNode("git-truncated", "diff truncated for performance"));
  const diff = document.createElement("pre");
  diff.className = "git-diff";
  diff.textContent = result.diff || "no diff";
  nodes.push(diff);
  return nodes;
}

function fileNode(file) {
  const row = document.createElement("div");
  row.className = "git-file";
  const status = document.createElement("span");
  status.className = `status ${file.status || "modified"}`;
  status.textContent = file.status || "modified";
  const path = document.createElement("span");
  path.className = "path";
  if (file.oldPath) {
    const old = document.createElement("small");
    old.textContent = `${file.oldPath} →`;
    path.append(old);
  }
  path.append(document.createTextNode(file.path || ""));
  const nums = document.createElement("span");
  nums.className = "nums";
  nums.append(statNode("add", `+${file.additions || 0}`), statNode("del", `-${file.deletions || 0}`));
  row.append(status, path, nums);
  return row;
}

function setBody(panel, nodes) {
  panel.querySelector("[data-git-viewer-body]").replaceChildren(...nodes);
}

function emptyNode(message) {
  const node = document.createElement("div");
  node.className = "git-empty";
  node.textContent = message;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown date";
  return date.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
