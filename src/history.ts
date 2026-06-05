import type { CommitFile, CommitResponse, CommitSummary, GitViewerState, HistoryResponse, PluginContext } from "./types";
import {
  actionButton,
  emptyNode,
  formatDate,
  MAX_LIMIT,
  PAGE_SIZE,
  renderStatus,
  setBody,
  setSidebarOpen,
  statNode,
} from "./ui";
import { getActiveWorkspaceId } from "./active-workspace";

export async function refresh(
  context: PluginContext,
  state: GitViewerState,
  panel: HTMLElement,
  limit: number = state.limit,
): Promise<void> {
  const workspaceId: string = getActiveWorkspaceId(context.app);
  state.workspaceId = workspaceId;

  if (!workspaceId) {
    setBody(panel, [emptyNode("open a workspace first")]);
    return;
  }

  state.limit = limit;
  setBody(panel, [emptyNode("loading git history…")]);

  try {
    const history: HistoryResponse = asHistoryResponse(await context.backend("history", { workspaceId, data: { limit } }));

    if (history.status) {
      renderStatus(context.app, panel, history.status);
    }

    state.commits = history.commits || [];
    state.hasMore = state.commits.length >= limit && limit < MAX_LIMIT;
    renderHistory(context, state, panel);
  } catch (error: unknown) {
    const node: HTMLDivElement = emptyNode(errorMessage(error, "git history unavailable"));
    node.classList.add("err");
    setBody(panel, [node]);
  }
}

export function renderHistory(context: PluginContext, state: GitViewerState, panel: HTMLElement): void {
  if (state.commits.length === 0) {
    setBody(panel, [emptyNode("no commits found")]);
    return;
  }

  const grid: HTMLDivElement = document.createElement("div");
  grid.className = "git-history-grid";
  grid.dataset.gitHistoryGrid = "";
  const toolbar: HTMLDivElement = document.createElement("div");
  toolbar.className = "git-history-toolbar";
  const loadMore: HTMLButtonElement = actionButton("load-more", "load 30 more", "load 30 more");
  loadMore.disabled = !state.hasMore;
  toolbar.append(loadMore);
  const scroll: HTMLDivElement = document.createElement("div");
  scroll.className = "git-commit-scroll";
  const list: HTMLDivElement = document.createElement("div");
  list.className = "git-commit-list";
  list.append(...state.commits.map((commit: CommitSummary): HTMLButtonElement => commitRow(commit, state.selectedHash)));
  scroll.append(list);
  grid.append(toolbar, scroll);
  setBody(panel, [grid]);
}

export function handleAction(
  context: PluginContext,
  state: GitViewerState,
  sidebar: HTMLElement,
  panel: HTMLElement,
  target: HTMLElement,
): void {
  const action: string | undefined = target.dataset.gitViewerAction;

  if (action === "close-sidebar") {
    setSidebarOpen(context.app, sidebar, false);
    return;
  }

  if (action === "refresh") {
    void refresh(context, state, panel, PAGE_SIZE);
    return;
  }

  if (action === "load-more") {
    void refresh(context, state, panel, Math.min(state.limit + PAGE_SIZE, MAX_LIMIT));
    return;
  }

  if (action === "select") {
    void selectCommit(context, state, panel, target.dataset.hash || "");
    return;
  }

  if (action === "close-detail") {
    state.selectedHash = "";
    renderHistory(context, state, panel);
  }
}

async function selectCommit(
  context: PluginContext,
  state: GitViewerState,
  panel: HTMLElement,
  hash: string,
): Promise<void> {
  const workspaceId: string = getActiveWorkspaceId(context.app);

  if (!workspaceId || !hash) {
    return;
  }

  state.selectedHash = hash;
  renderHistory(context, state, panel);
  const grid: HTMLElement | null = panel.querySelector<HTMLElement>("[data-git-history-grid]");

  if (!grid) {
    return;
  }

  grid.classList.add("detail-open");
  const detail: HTMLDivElement = document.createElement("div");
  detail.className = "git-detail";
  detail.append(emptyNode("loading commit…"));
  grid.append(detail);

  try {
    const result: CommitResponse = asCommitResponse(await context.backend("commit", { workspaceId, data: { hash } }));
    detail.replaceChildren(...detailNodes(result));
  } catch (error: unknown) {
    const node: HTMLDivElement = emptyNode(errorMessage(error, "commit unavailable"));
    node.classList.add("err");
    detail.replaceChildren(node);
  }
}

function commitRow(commit: CommitSummary, selectedHash: string): HTMLButtonElement {
  const hash: string = commit.hash || commit.shortHash || "";
  const row: HTMLButtonElement = document.createElement("button");
  row.type = "button";
  row.className = ["git-commit-row", selectedHash === hash ? "selected" : ""].filter(Boolean).join(" ");
  row.dataset.gitViewerAction = "select";
  row.dataset.hash = hash;
  const main: HTMLSpanElement = document.createElement("span");
  main.className = "git-commit-main";
  const subject: HTMLSpanElement = document.createElement("span");
  subject.className = "git-subject";
  subject.textContent = commit.subject || commit.shortHash || hash;
  const meta: HTMLSpanElement = document.createElement("span");
  meta.className = "git-meta";
  const code: HTMLElement = document.createElement("code");
  code.textContent = commit.shortHash || hash.slice(0, 7);
  meta.append(code, document.createTextNode(` · ${commit.authorName || "unknown"} · ${formatDate(commit.date)}`));
  const stats: HTMLSpanElement = document.createElement("span");
  stats.className = "git-stats";
  stats.append(
    statNode("add", `+${commit.additions || 0}`),
    statNode("del", `-${commit.deletions || 0}`),
    statNode("", `${(commit.files || []).length} files`),
  );
  main.append(subject, meta, stats);
  row.append(main);
  return row;
}

function detailNodes(result: CommitResponse): HTMLElement[] {
  const commit: CommitSummary = result.commit || {};
  const files: CommitFile[] = commit.files || [];
  const head: HTMLDivElement = document.createElement("div");
  head.className = "git-detail-head";
  const close: HTMLButtonElement = actionButton("close-detail", "×", "close commit details");
  close.className = "git-detail-close";
  const subject: HTMLElement = document.createElement("strong");
  subject.textContent = commit.subject || commit.shortHash || "commit";
  const meta: HTMLElement = document.createElement("small");
  meta.textContent = `${commit.shortHash || ""} · ${commit.authorName || "unknown"} · ${formatDate(commit.date)}`;
  head.append(close, subject, meta);
  const fileList: HTMLDivElement = document.createElement("div");
  fileList.className = "git-file-list";

  if (files.length) {
    fileList.append(...files.map((file: CommitFile): HTMLDivElement => fileNode(file)));
  } else {
    fileList.append(statNode("git-empty-inline", "no file stats"));
  }

  const message: HTMLPreElement = document.createElement("pre");
  message.className = "git-message";
  message.textContent = result.body || commit.subject || "";
  const nodes: HTMLElement[] = [head, fileList, message];

  if (result.truncated) {
    nodes.push(statNode("git-truncated", "diff truncated for performance"));
  }

  const diff: HTMLPreElement = document.createElement("pre");
  diff.className = "git-diff";
  diff.textContent = result.diff || "no diff";
  nodes.push(diff);
  return nodes;
}

function fileNode(file: CommitFile): HTMLDivElement {
  const row: HTMLDivElement = document.createElement("div");
  row.className = "git-file";
  const status: HTMLSpanElement = document.createElement("span");
  status.className = `status ${file.status || "modified"}`;
  status.textContent = file.status || "modified";
  const path: HTMLSpanElement = document.createElement("span");
  path.className = "path";

  if (file.oldPath) {
    const old: HTMLElement = document.createElement("small");
    old.textContent = `${file.oldPath} →`;
    path.append(old);
  }

  path.append(document.createTextNode(file.path || ""));
  const nums: HTMLSpanElement = document.createElement("span");
  nums.className = "nums";
  nums.append(statNode("add", `+${file.additions || 0}`), statNode("del", `-${file.deletions || 0}`));
  row.append(status, path, nums);
  return row;
}

function asHistoryResponse(value: unknown): HistoryResponse {
  return isRecord(value) ? (value as HistoryResponse) : {};
}

function asCommitResponse(value: unknown): CommitResponse {
  return isRecord(value) ? (value as CommitResponse) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
