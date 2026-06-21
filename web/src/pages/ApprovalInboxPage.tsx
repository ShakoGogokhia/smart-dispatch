import { CheckCircle2, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { WorkflowApproval } from "@/types/api";

type ApprovalPayload = {
  summary: { pending: number; approved: number; rejected: number };
  data: WorkflowApproval[];
};

export default function ApprovalInboxPage() {
  const queryClient = useQueryClient();
  const approvalsQ = useQuery({
    queryKey: ["approval-inbox"],
    queryFn: async () => (await api.get("/api/workflow-approvals")).data as ApprovalPayload,
  });

  const reviewM = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      (await api.post(`/api/workflow-approvals/${id}/review`, { status })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approval-inbox"] }),
  });

  const payload = approvalsQ.data;

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Approval inbox</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Pending" value={payload?.summary.pending ?? 0} />
        <Metric label="Approved" value={payload?.summary.approved ?? 0} />
        <Metric label="Rejected" value={payload?.summary.rejected ?? 0} />
      </div>

      <Card className="rounded-[30px]">
        <CardHeader><CardTitle className="text-2xl">Workflow requests</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {(payload?.data ?? []).map((approval) => (
            <div key={approval.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-semibold">{approval.type} - {approval.market?.name || approval.order?.code || approval.promo_code?.code || "General"}</div>
                  <div className="mt-1 text-sm theme-copy">{approval.requester?.name ?? "Requester"} - {approval.notes || "No notes"}</div>
                  <div className="mt-1 text-xs theme-copy">{formatDateTime(approval.created_at)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="status-chip status-neutral">{approval.status}</Badge>
                  {approval.status === "pending" ? (
                    <>
                      <Button size="sm" onClick={() => reviewM.mutate({ id: approval.id, status: "approved" })}>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => reviewM.mutate({ id: approval.id, status: "rejected" })}>
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-[28px]">
      <CardContent className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
        <div className="mt-4 text-4xl font-semibold tracking-[-0.05em]">{value}</div>
      </CardContent>
    </Card>
  );
}
