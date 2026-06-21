import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type AuditLog = {
  id: number;
  action: string;
  auditable_type?: string | null;
  auditable_id?: number | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at?: string | null;
  user?: { name: string; email: string } | null;
};

export default function AuditLogsPage() {
  const auditQ = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => (await api.get("/api/audit-logs")).data as AuditLog[],
  });

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Audit logs</h1>
      </div>

      <Card className="rounded-[30px]">
        <CardHeader><CardTitle className="text-2xl">Recent actions</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {(auditQ.data ?? []).map((entry) => (
            <div key={entry.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-semibold">{entry.action}</div>
              <div className="mt-1 text-sm theme-copy">{entry.user?.name ?? "System"} - {entry.auditable_type ?? "n/a"} #{entry.auditable_id ?? "-"}</div>
              <div className="mt-1 text-xs theme-copy">{formatDateTime(entry.created_at)} - {entry.ip_address ?? "no ip"}</div>
            </div>
          ))}
          {!auditQ.isLoading && !(auditQ.data ?? []).length ? <div className="text-sm theme-copy">No audit logs yet.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
