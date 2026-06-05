import { getActiveWorkspaceId } from "./active-workspace";
import { handleAction, refresh } from "./history";
import type { GitViewerState, PluginContext } from "./types";
import {
  ensurePanel,
  ensureSidebar,
  ensureToolbarButton,
  isSidebarOpen,
  PAGE_SIZE,
  setSidebarOpen,
  syncToolbarButton,
} from "./ui";
import { bindSidebarBridge, syncWorkspace } from "./workspace";

export default function activate(context: PluginContext): () => void {
  const sidebar: HTMLElement = ensureSidebar(context.app);
  const panel: HTMLElement = ensurePanel(sidebar);
  const button: HTMLButtonElement | undefined = ensureToolbarButton(context.app);
  const state: GitViewerState = {
    commits: [],
    hasMore: false,
    limit: PAGE_SIZE,
    selectedHash: "",
    workspaceId: getActiveWorkspaceId(context.app),
  };

  const onButtonClick = (event: MouseEvent): void => {
    event.preventDefault();
    toggleSidebar(context, state, sidebar, panel);
  };

  if (button) {
    button.addEventListener("click", onButtonClick);
  }

  const onSidebarClick = (event: MouseEvent): void => {
    const target: HTMLElement | null = closestActionTarget(event.target);

    if (!target || !sidebar.contains(target)) {
      return;
    }

    event.preventDefault();
    handleAction(context, state, sidebar, panel, target);
  };

  sidebar.addEventListener("click", onSidebarClick);

  const onPointerDown = (event: PointerEvent): void => {
    const target: Node | null = event.target instanceof Node ? event.target : null;

    if (!isSidebarOpen(sidebar)) {
      return;
    }

    if (!target || sidebar.contains(target) || button?.contains(target)) {
      return;
    }

    setSidebarOpen(context.app, sidebar, false);
  };

  document.addEventListener("pointerdown", onPointerDown);

  const onWorkspaceActive = (): void => {
    bindSidebarBridge(context, state, panel);
    syncWorkspace(context, state, panel, getActiveWorkspaceId(context.app));
    syncToolbarButton(context.app);
  };

  window.addEventListener("pi-workspace:active", onWorkspaceActive);

  let initialRefreshDone: boolean = false;
  const refreshInitialWorkspace = (): void => {
    if (initialRefreshDone) {
      return;
    }

    initialRefreshDone = true;
    void refresh(context, state, panel, PAGE_SIZE);
  };
  const onSidebarBridgeReady = (): void => {
    window.clearTimeout(bridgeFallbackTimer);
    refreshInitialWorkspace();
  };
  const bridgeProbe: number = window.setInterval((): void => {
    if (bindSidebarBridge(context, state, panel)) {
      window.clearInterval(bridgeProbe);
      onSidebarBridgeReady();
    }
  }, 250);
  const bridgeFallbackTimer: number = window.setTimeout((): void => {
    if (!initialRefreshDone) {
      refreshInitialWorkspace();
    }
  }, 5000);
  const bridgeProbeStop: number = window.setTimeout((): void => window.clearInterval(bridgeProbe), 30000);

  if (bindSidebarBridge(context, state, panel)) {
    window.clearInterval(bridgeProbe);
    onSidebarBridgeReady();
  }

  syncToolbarButton(context.app);

  return (): void => {
    window.clearInterval(bridgeProbe);
    window.clearTimeout(bridgeFallbackTimer);
    window.clearTimeout(bridgeProbeStop);
    state.sidebarSubscription?.unsubscribe();
    button?.removeEventListener("click", onButtonClick);
    sidebar.removeEventListener("click", onSidebarClick);
    document.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pi-workspace:active", onWorkspaceActive);
    panel.remove();

    if (!sidebar.querySelector("[data-plugin-panel]")) {
      sidebar.remove();
    }
  };
}

function toggleSidebar(context: PluginContext, state: GitViewerState, sidebar: HTMLElement, panel: HTMLElement): void {
  setSidebarOpen(context.app, sidebar, !isSidebarOpen(sidebar));

  if (isSidebarOpen(sidebar)) {
    void refresh(context, state, panel, PAGE_SIZE);
  }
}

function closestActionTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>("[data-git-viewer-action]");
}
