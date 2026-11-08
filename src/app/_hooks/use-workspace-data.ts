"use client";

import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import type { Dashboard, SourceRow } from "@/lib/types";

// Page-layer orchestration. Display components receive props and never import this hook.
export default function useWorkspaceData() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [evidence, setEvidence] = useState<{ title: string; sources: SourceRow[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setDashboard(null);
    setEvidence(null);
    apiRequest<Dashboard>("/api/dashboard", "GET", undefined, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setDashboard(data); })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  return {
    dashboard,
    shell: { loading, error, period: dashboard?.state.period.label, asOf: dashboard?.state.asOf, onRetry: () => setAttempt((value) => value + 1) },
    evidence,
    onEvidence: (ids: string[], title: string) => {
      const selected = new Set(ids);
      setEvidence({ title, sources: dashboard?.state.sources.filter((source) => selected.has(source.id)) ?? [] });
    },
    onCloseEvidence: () => setEvidence(null),
  };
}
