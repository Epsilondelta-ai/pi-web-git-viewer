import materialGitIconUrl from "./assets/material-account-tree.svg";
import type { AppElement, GitStatus } from "./types";

export const PANEL_ID = "git-viewer";
export const PAGE_SIZE = 30;
export const MAX_LIMIT = 180;

const MATERIAL_GIT_ICON_FALLBACK =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%2224%22%20viewBox%3D%220%20-960%20960%20960%22%20width%3D%2224%22%20fill%3D%22%23f05032%22%3E%3Cpath%20d%3D%22M600-120v-120H440v-400h-80v120H80v-320h280v120h240v-120h280v320H600v-120h-80v320h80v-120h280v320H600ZM160-600h120v-160H160v160Zm520%20400h120v-160H680v160Zm0-400h120v-160H680v160ZM160-600v-160%20160Zm520%20400v-160%20160Zm0-400v-160%20160Z%22%2F%3E%3C%2Fsvg%3E";
const MATERIAL_GIT_ICON_URL: string = materialGitIconUrl || MATERIAL_GIT_ICON_FALLBACK;

export function ensureToolbarButton(app: AppElement): HTMLButtonElement | undefined {
  const toolbar: Element | null = app.querySelector("[data-plugin-toolbar]") || app.querySelector(".topbar .actions");

  if (!toolbar) {
    return undefined;
  }

  const existing: HTMLButtonElement | null = toolbar.querySelector<HTMLButtonElement>(
    `[data-plugin-toolbar-button="${PANEL_ID}"]`,
  );

  if (existing) {
    delete existing.dataset.action;
    delete existing.dataset.pluginPanel;
    existing.dataset.gitViewerAction = "toggle-sidebar";
    return existing;
  }

  const button: HTMLButtonElement = document.createElement("button");
  button.type = "button";
  button.className = "iconbtn workspace-explorer-btn";
  button.dataset.gitViewerAction = "toggle-sidebar";
  button.dataset.pluginToolbarButton = PANEL_ID;
  button.title = "git viewer";
  button.hidden = app.dataset.route !== "workspace";
  button.setAttribute("aria-label", "toggle git viewer");
  button.append(materialIcon(16));
  toolbar.insertBefore(button, toolbar.querySelector(".statusbtn"));
  return button;
}

export function syncToolbarButton(app: AppElement): void {
  const button: HTMLButtonElement | null = app.querySelector<HTMLButtonElement>(
    `[data-plugin-toolbar-button="${PANEL_ID}"]`,
  );
  const sidebar: HTMLElement | null = app.querySelector<HTMLElement>("[data-git-viewer-sidebar]");
  button?.classList.toggle("on", isSidebarOpen(sidebar));

  if (button) {
    button.hidden = app.dataset.route !== "workspace";
  }

  if (sidebar) {
    sidebar.hidden = app.dataset.route !== "workspace";
  }
}

export function isSidebarOpen(sidebar: HTMLElement | null | undefined): boolean {
  return sidebar?.dataset.open === "true";
}

export function setSidebarOpen(app: AppElement, sidebar: HTMLElement, open: boolean): void {
  sidebar.dataset.open = String(open);
  sidebar.setAttribute("aria-hidden", open ? "false" : "true");
  sidebar.style.transform = open ? "translateX(0)" : "translateX(100%)";
  syncToolbarButton(app);
}

export function ensureSidebar(app: AppElement): HTMLElement {
  let sidebar: HTMLElement | null = app.querySelector<HTMLElement>("[data-git-viewer-sidebar]");

  if (sidebar) {
    return sidebar;
  }

  sidebar = document.createElement("aside");
  sidebar.className = "pi-git-viewer-sidebar";
  sidebar.dataset.gitViewerSidebar = "";
  sidebar.dataset.open = "false";
  sidebar.setAttribute("aria-hidden", "true");
  applyClosedSidebarFallback(sidebar);
  app.append(sidebar);
  return sidebar;
}

export function ensurePanel(sidebar: HTMLElement): HTMLElement {
  let panel: HTMLElement | null = sidebar.querySelector<HTMLElement>(`[data-plugin-panel="${PANEL_ID}"]`);

  if (panel) {
    return panel;
  }

  panel = document.createElement("section");
  panel.dataset.pluginPanel = PANEL_ID;
  panel.className = "pi-git-viewer-panel";
  panel.append(createStyle(), createHeader(), createBody());
  sidebar.append(panel);
  return panel;
}

export function actionButton(action: string, label: string, title: string): HTMLButtonElement {
  const button: HTMLButtonElement = document.createElement("button");
  button.type = "button";
  button.dataset.gitViewerAction = action;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.textContent = label;
  return button;
}

export function statNode(className: string, text: string): HTMLSpanElement {
  const node: HTMLSpanElement = document.createElement("span");

  if (className) {
    node.className = className;
  }

  node.textContent = text;
  return node;
}

export function setBody(panel: HTMLElement, nodes: HTMLElement[]): void {
  panel.querySelector<HTMLElement>("[data-git-viewer-body]")?.replaceChildren(...nodes);
}

export function emptyNode(message: string): HTMLDivElement {
  const node: HTMLDivElement = document.createElement("div");
  node.className = "git-empty";
  node.textContent = message;
  return node;
}

export function formatDate(value: string | undefined): string {
  const date: Date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return "unknown date";
  }

  return date.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function renderStatus(app: AppElement, panel: HTMLElement, status: GitStatus): void {
  const text: string = `${status.branch || "—"} · ${status.dirty || 0} ✱`;
  const statusNode: HTMLElement | null = panel.querySelector<HTMLElement>("[data-git-viewer-status]");
  statusNode?.replaceChildren(document.createTextNode(text));
  app.querySelector<HTMLElement>("[data-git-status]")?.replaceChildren(document.createTextNode(text));

  if (status.branch) {
    app.updatePromptMeta?.({ currentBranch: status.branch });
  }
}

function materialIcon(size: number = 16): HTMLImageElement {
  const img: HTMLImageElement = document.createElement("img");
  img.alt = "";
  img.width = size;
  img.height = size;
  img.src = MATERIAL_GIT_ICON_URL;
  img.onerror = (): void => {
    img.onerror = null;
    img.src = MATERIAL_GIT_ICON_FALLBACK;
  };
  return img;
}

function applyClosedSidebarFallback(sidebar: HTMLElement): void {
  sidebar.style.position = "fixed";
  sidebar.style.right = "0";
  sidebar.style.transform = "translateX(100%)";
}

function createStyle(): HTMLStyleElement {
  const style: HTMLStyleElement = document.createElement("style");
  style.textContent = [
    ".pi-git-viewer-sidebar { position: fixed; z-index: 40; top: var(--topbar-height, 40px); right: 0; bottom: 0; width: min(520px, 90vw); background: var(--bg, #101114); color: var(--fg, inherit); border-left: 1px solid var(--border, rgba(255,255,255,.12)); box-shadow: -16px 0 32px rgba(0,0,0,.28); transform: translateX(100%); transition: transform .16s ease; display: flex; min-height: 0; }",
    '.pi-git-viewer-sidebar[data-open="true"] { transform: translateX(0); }',
    ".pi-git-viewer-sidebar[hidden] { display: none; }",
    ".pi-git-viewer-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; }",
    ".pi-git-viewer-panel .git-panel { flex: 1 1 auto; min-height: 0; overflow: hidden; }",
    ".pi-git-viewer-panel .git-history-grid { height: 100%; min-height: 0; }",
    ".pi-git-viewer-panel .git-commit-scroll { min-height: 0; overflow-y: auto; scrollbar-gutter: stable; }",
    ".pi-git-viewer-panel .git-detail { min-height: 0; overflow: auto; }",
  ].join("\n");
  return style;
}

function createHeader(): HTMLDivElement {
  const header: HTMLDivElement = document.createElement("div");
  header.className = "tree-head";
  const tabs: HTMLSpanElement = document.createElement("span");
  tabs.className = "tree-tabs";
  const title: HTMLSpanElement = document.createElement("span");
  title.className = "tree-tab on";
  title.append(materialIcon(14), document.createTextNode(" git"));
  tabs.append(title);
  const actions: HTMLSpanElement = document.createElement("span");
  actions.className = "tree-head-actions";
  const status: HTMLSpanElement = document.createElement("span");
  status.className = "branch";
  status.dataset.gitViewerStatus = "";
  status.textContent = "—";
  actions.append(status, actionButton("close-sidebar", "×", "close git viewer"), actionButton("refresh", "↻", "refresh git"));
  header.append(tabs, actions);
  return header;
}

function createBody(): HTMLDivElement {
  const body: HTMLDivElement = document.createElement("div");
  body.className = "git-panel";
  body.dataset.gitViewerBody = "";
  body.append(emptyNode("git history loads when opened"));
  return body;
}
