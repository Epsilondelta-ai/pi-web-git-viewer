export type BackendInput = {
  workspaceId?: string;
  data?: Record<string, unknown>;
};

export type BackendCall = (method: string, input: BackendInput) => Promise<unknown>;

export type PluginManifest = {
  id: string;
  name?: string;
};

export type SubscriptionLike = {
  unsubscribe(): void;
};

export type SubjectLike<T> = {
  subscribe(callback: (value: T) => void): SubscriptionLike;
};

export type SidebarWorkspace = {
  id: string;
  name?: string;
  path?: string;
};

export type SidebarSnapshot = {
  activeWorkspaceId: string;
  workspaces: SidebarWorkspace[];
};

export type SidebarApi = {
  state$?: SubjectLike<SidebarSnapshot>;
  getSnapshot?: () => SidebarSnapshot;
};

export type AppElement = HTMLElement & {
  dataset: DOMStringMap & {
    activeWorkspaceId?: string;
    route?: string;
  };
  piWebSidebar?: SidebarApi;
  updatePromptMeta?: (meta: { currentBranch: string }) => void;
};

export type PluginContext = {
  app: AppElement;
  backend: BackendCall;
  plugin?: PluginManifest;
  rxjs?: unknown;
};

export type GitViewerState = {
  commits: CommitSummary[];
  hasMore: boolean;
  limit: number;
  selectedHash: string;
  sidebarSubscription?: SubscriptionLike;
  sidebarSubscriptionSource?: SidebarApi;
  workspaceId: string;
};

export type GitStatus = {
  branch?: string;
  dirty?: number;
};

export type CommitFile = {
  additions?: number;
  deletions?: number;
  oldPath?: string;
  path?: string;
  status?: string;
};

export type CommitSummary = {
  additions?: number;
  authorName?: string;
  date?: string;
  deletions?: number;
  files?: CommitFile[];
  hash?: string;
  shortHash?: string;
  subject?: string;
};

export type HistoryResponse = {
  commits?: CommitSummary[];
  status?: GitStatus;
};

export type CommitResponse = {
  body?: string;
  commit?: CommitSummary;
  diff?: string;
  truncated?: boolean;
};
