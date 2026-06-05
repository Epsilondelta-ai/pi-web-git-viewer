import type { GitViewerState, PluginContext, SidebarApi, SidebarSnapshot } from "./types";
import { isSidebarOpen, PAGE_SIZE, syncToolbarButton } from "./ui";
import { refresh } from "./history";

export function bindSidebarBridge(context: PluginContext, state: GitViewerState, panel: HTMLElement): boolean {
  const sidebarApi: SidebarApi | undefined = context.app.piWebSidebar;

  if (!sidebarApi || state.sidebarSubscriptionSource === sidebarApi) {
    return !!sidebarApi;
  }

  state.sidebarSubscription?.unsubscribe();
  state.sidebarSubscriptionSource = sidebarApi;

  if (typeof sidebarApi.getSnapshot === "function") {
    syncWorkspace(context, state, panel, sidebarApi.getSnapshot().activeWorkspaceId);
  }

  if (sidebarApi.state$ && typeof sidebarApi.state$.subscribe === "function") {
    state.sidebarSubscription = sidebarApi.state$.subscribe((snapshot: SidebarSnapshot): void => {
      syncWorkspace(context, state, panel, snapshot.activeWorkspaceId);
    });
  }

  return true;
}

export function syncWorkspace(
  context: PluginContext,
  state: GitViewerState,
  panel: HTMLElement,
  workspaceId: string,
): void {
  if (state.workspaceId === workspaceId) {
    return;
  }

  state.workspaceId = workspaceId;
  state.selectedHash = "";
  syncToolbarButton(context.app);

  if (isSidebarOpen(context.app.querySelector<HTMLElement>("[data-git-viewer-sidebar]"))) {
    void refresh(context, state, panel, PAGE_SIZE);
  }
}

