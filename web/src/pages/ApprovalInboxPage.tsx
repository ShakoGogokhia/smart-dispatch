import { CheckCircle2, ClipboardCheck, Clock3, Inbox, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge, humanizeStatus, toneForStatus } from "@/components/app/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { WorkflowApproval } from "@/types/api";

type ApprovalPayload = {
  summary: { pending: number; approved: number; rejected: number };
  data: WorkflowApproval[];
};

function approvalTarget(approval: WorkflowApproval) {
  return approval.market?.name || approval.order?.code || approval.promo_code?.code || "General";
}

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
  const approvals = payload?.data ?? [];

  const renderActions = (approval: WorkflowApproval) =>
    approval.status === "pending" ? (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => reviewM.mutate({ id: approval.id, status: "approved" })} disabled={reviewM.isPending}>
          <CheckCircle2 />
          Approve
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={reviewM.isPending}>
              <XCircle />
              Reject
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject this request?</AlertDialogTitle>
              <AlertDialogDescription>
                {humanizeStatus(approval.type)} request for {approvalTarget(approval)} from {approval.requester?.name ?? "the requester"} will be
                marked as rejected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => reviewM.mutate({ id: approval.id, status: "rejected" })}>
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Approval inbox" description="Review requests for new markets, promos, badges and refunds." />

      <StatGrid className="md:grid-cols-3 xl:grid-cols-3">
        <StatCard label="Pending" value={payload?.summary.pending ?? 0} icon={Clock3} tone="warning" />
        <StatCard label="Approved" value={payload?.summary.approved ?? 0} icon={CheckCircle2} tone="success" />
        <StatCard label="Rejected" value={payload?.summary.rejected ?? 0} icon={XCircle} tone="destructive" />
      </StatGrid>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Workflow requests</CardTitle>
          <CardDescription>Pending requests can be approved or rejected.</CardDescription>
        </CardHeader>

        {approvalsQ.isLoading ? (
          <div className="p-4">
            <LoadingState rows={3} />
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-4">
            <EmptyState compact icon={Inbox} title="No requests" description="New approval requests will show up here." />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell className="pl-6">
                        <Badge variant="secondary">{humanizeStatus(approval.type)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{approvalTarget(approval)}</TableCell>
                      <TableCell>{approval.requester?.name ?? "Requester"}</TableCell>
                      <TableCell className="max-w-64 truncate text-muted-foreground" title={approval.notes ?? undefined}>
                        {approval.notes || "No notes"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(approval.created_at)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={toneForStatus(approval.status)} dot>
                          {humanizeStatus(approval.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end">{renderActions(approval)}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y md:hidden">
              {approvals.map((approval) => (
                <div key={approval.id} className="grid gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {humanizeStatus(approval.type)} · {approvalTarget(approval)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {approval.requester?.name ?? "Requester"} · {formatDateTime(approval.created_at)}
                      </div>
                    </div>
                    <StatusBadge tone={toneForStatus(approval.status)} dot>
                      {humanizeStatus(approval.status)}
                    </StatusBadge>
                  </div>
                  <p className="text-sm break-words text-muted-foreground">{approval.notes || "No notes"}</p>
                  {renderActions(approval)}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
