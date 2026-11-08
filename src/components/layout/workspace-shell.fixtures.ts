import type { WorkspaceShellProps } from "./workspace-shell";

export const ready = {
  title: "Fictional workspace",
  description: "Synthetic props for isolated view development.",
  period: "Q3 2026",
  asOf: "2026-09-30",
  loading: false,
  error: "",
  onRetry: () => {},
} satisfies WorkspaceShellProps;
export const loading = { ...ready, loading: true } satisfies WorkspaceShellProps;
export const unavailable = { ...ready, error: "The fictional server is unavailable." } satisfies WorkspaceShellProps;
