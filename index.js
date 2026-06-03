const PANEL_ID = "git-viewer";
const PAGE_SIZE = 30;
const MAX_LIMIT = 180;

const icons = {
  git: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v9"/><path d="M8.6 7.4 15.4 16.6"/></svg>',
  refresh: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
};

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
  button.innerHTML = icons.git;
  toolbar.insertBefore(button, toolbar.querySelector(".statusbtn"));
  return button;
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
  panel.innerHTML = `
    <div class="tree-head">
      <span class="tree-tabs"><span class="tree-tab on">${icons.git} git</span></span>
      <span class="tree-head-actions"><span class="branch" data-git-viewer-status>—</span><button type="button" data-git-viewer-action="refresh" aria-label="refresh git" title="refresh git">${icons.refresh}</button></span>
    </div>
    <div class="git-panel" data-git-viewer-body><div class="git-empty">git history loads when opened</div></div>`;
  sidebar.append(panel);
  return panel;
}

async function refresh(context, state, panel, limit = state.limit) {
  const workspaceId = context.app.dataset.activeWorkspaceId;
  if (!workspaceId) {
    setBody(panel, '<div class="git-empty">open a workspace first</div>');
    return;
  }

  state.limit = limit;
  setBody(panel, '<div class="git-empty">loading git history…</div>');
  try {
    const [status, history] = await Promise.all([
      context.api.get(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/status`).catch(() => undefined),
      context.api.get(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/history?limit=${encodeURIComponent(limit)}`),
    ]);
    if (status) renderStatus(context.app, panel, status);
    state.commits = history.commits || [];
    state.hasMore = state.commits.length >= limit && limit < MAX_LIMIT;
    renderHistory(context, state, panel);
  } catch (error) {
    setBody(panel, `<div class="git-empty err">${escapeHtml(error.message || "git history unavailable")}</div>`);
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
    setBody(panel, '<div class="git-empty">no commits found</div>');
    return;
  }

  setBody(panel, [
    '<div class="git-history-grid" data-git-history-grid>',
    '<div class="git-history-toolbar">',
    `<button type="button" data-git-viewer-action="load-more" ${state.hasMore ? "" : "disabled"}>load 30 more</button>`,
    '</div><div class="git-commit-scroll"><div class="git-commit-list">',
    state.commits.map((commit) => commitRow(commit, state.selectedHash)).join(""),
    '</div></div></div>',
  ].join(""));
}

function commitRow(commit, selectedHash) {
  const hash = commit.hash || commit.shortHash || "";
  return `<button type="button" class="git-commit-row ${selectedHash === hash ? "selected" : ""}" data-git-viewer-action="select" data-hash="${escapeHtml(hash)}"><span class="git-commit-main"><span class="git-subject">${escapeHtml(commit.subject || commit.shortHash || hash)}</span><span class="git-meta"><code>${escapeHtml(commit.shortHash || hash.slice(0, 7))}</code> · ${escapeHtml(commit.authorName || "unknown")} · ${formatDate(commit.date)}</span><span class="git-stats"><span class="add">+${commit.additions || 0}</span><span class="del">-${commit.deletions || 0}</span><span>${(commit.files || []).length} files</span></span></span></button>`;
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
  detail.innerHTML = '<div class="git-empty">loading commit…</div>';
  grid.append(detail);
  try {
    const result = await context.api.get(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/commit?hash=${encodeURIComponent(hash)}`);
    detail.innerHTML = detailTemplate(result);
  } catch (error) {
    detail.innerHTML = `<div class="git-empty err">${escapeHtml(error.message || "commit unavailable")}</div>`;
  }
}

function detailTemplate(result) {
  const commit = result.commit || {};
  const files = commit.files || [];
  return [
    '<div class="git-detail-head">',
    '<button type="button" class="git-detail-close" data-git-viewer-action="close-detail" aria-label="close commit details">×</button>',
    `<strong>${escapeHtml(commit.subject || commit.shortHash || "commit")}</strong>`,
    `<small>${escapeHtml(commit.shortHash || "")} · ${escapeHtml(commit.authorName || "unknown")} · ${formatDate(commit.date)}</small>`,
    '</div>',
    `<div class="git-file-list">${files.map(fileTemplate).join("") || '<span class="git-empty-inline">no file stats</span>'}</div>`,
    `<pre class="git-message">${escapeHtml(result.body || commit.subject || "")}</pre>`,
    result.truncated ? '<div class="git-truncated">diff truncated for performance</div>' : "",
    `<pre class="git-diff">${escapeHtml(result.diff || "no diff")}</pre>`,
  ].join("");
}

function fileTemplate(file) {
  const oldPath = file.oldPath ? `<small>${escapeHtml(file.oldPath)} →</small>` : "";
  return `<div class="git-file"><span class="status ${escapeHtml(file.status || "modified")}">${escapeHtml(file.status || "modified")}</span><span class="path">${oldPath}${escapeHtml(file.path || "")}</span><span class="nums"><span class="add">+${file.additions || 0}</span><span class="del">-${file.deletions || 0}</span></span></div>`;
}

function setBody(panel, html) {
  panel.querySelector("[data-git-viewer-body]").innerHTML = html;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown date";
  return date.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
