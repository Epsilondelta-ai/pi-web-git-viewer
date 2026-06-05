import type { AppElement } from "./types";

export function getActiveWorkspaceId(app: AppElement): string {
  return app.piWebSidebar?.getSnapshot?.().activeWorkspaceId || app.dataset.activeWorkspaceId || "";
}
