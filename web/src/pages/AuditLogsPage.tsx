import { Braces, ScrollText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function shortType(type?: string | null) {
  if (!type) return "n/a";
  return type.split("\\").pop() ?? type;
}

function MetadataPopover({ entry }: { entry: AuditLog }) {
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;
  if (!hasMetadata) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="xs" variant="outline">
          <Braces />
          Details
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(28rem,calc(100vw-2rem))]">
        <div className="mb-2 text-sm font-medium">Metadata</div>
        <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-all">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      </PopoverContent>
    </Popover>
  );
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const auditQ = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => (await api.get("/api/audit-logs")).data as AuditLog[],
  });

  const entries = useMemo(() => {
    const all = auditQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((entry) =>
      [entry.action, entry.user?.name, entry.user?.email, entry.auditable_type, entry.auditable_id, entry.ip_address]
        .filter((value) => value != null)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [auditQ.data, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit logs" description="A record of who did what in the system, and when.">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, user, target or IP"
            className="pl-8"
            aria-label="Search audit logs"
          />
        </div>
      </PageHeader>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Recent actions</CardTitle>
          <CardDescription>
            <span className="tabular-nums">{entries.length}</span> entries
          </CardDescription>
        </CardHeader>

        {auditQ.isLoading ? (
          <div className="p-4">
            <LoadingState rows={4} />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4">
            <EmptyState
              compact
              icon={ScrollText}
              title={search ? "No matching entries" : "No audit logs yet."}
              description={search ? "Try a different search term." : "Actions taken by users will be recorded here."}
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead className="pr-6 text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">{formatDateTime(entry.created_at)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.user?.name ?? "System"}</div>
                        {entry.user?.email ? <div className="text-xs text-muted-foreground">{entry.user.email}</div> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground" title={entry.auditable_type ?? undefined}>
                        {shortType(entry.auditable_type)} #{entry.auditable_id ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{entry.ip_address ?? "no ip"}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <MetadataPopover entry={entry} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y md:hidden">
              {entries.map((entry) => (
                <div key={entry.id} className="grid gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="secondary" className="max-w-full truncate font-mono text-xs">
                      {entry.action}
                    </Badge>
                    <MetadataPopover entry={entry} />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{entry.user?.name ?? "System"}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      on {shortType(entry.auditable_type)} #{entry.auditable_id ?? "-"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)} · {entry.ip_address ?? "no ip"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
