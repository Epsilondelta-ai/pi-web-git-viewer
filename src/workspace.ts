import type { GitViewerState, PluginContext, SidebarApi, SidebarSnapshot } from "./types";
import { isSidebarOpen, PAGE_SIZE, syncToolbarButton } from "./ui";
import { refresh } from "./history";

export function bindSidebarBridge(context: PluginContext, state: GitViewerState, panel: HTMLElement): boolean {
  const sidebarApi: SidebarApi | undefined = context.app.piWebSidebar;

  if (!sidebarApi) {
    return false;
  }

  const hasSnapshot: boolean = typeof sidebarApi.getSnapshot === "function";
  const hasState: boolean = typeof sidebarApi.state$?.subscribe === "function";

  if (!hasSnapshot && !hasState) {
    return false;
  }

  if (state.sidebarSubscriptionSource !== sidebarApi) {
    state.sidebarSubscription?.unsubscribe();
    state.sidebarSubscription = undefined;
    state.sidebarSubscriptionSource = sidebarApi;
  }

  if (hasSnapshot && sidebarApi.getSnapshot) {
    syncWorkspace(context, state, panel, sidebarApi.getSnapshot().activeWorkspaceId);
  }

  if (!state.sidebarSubscription && hasState && sidebarApi.state$) {
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

