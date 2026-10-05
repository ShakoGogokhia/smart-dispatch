import { ArrowLeft, LifeBuoy, MessageSquarePlus, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, humanizeStatus, toneForStatus } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

type SupportTicket = {
  id: number;
  code: string;
  category: string;
  status: string;
  priority: string;
  subject: string;
  description?: string | null;
  created_at?: string | null;
  order?: { id: number; code: string; status?: string } | null;
  customer?: { id: number; name: string; email: string } | null;
  messages: Array<{ id: number; visibility: string; message: string; created_at?: string | null; user?: { name: string } | null }>;
};

function priorityTone(priority: string) {
  const p = priority.toLowerCase();
  if (p.includes("urgent") || p.includes("high")) return "destructive" as const;
  if (p.includes("medium") || p.includes("normal")) return "warning" as const;
  return "neutral" as const;
}

export default function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const meQ = useMe();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);

  const ticketsQ = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => (await api.get("/api/support-tickets")).data as SupportTicket[],
  });

  const createM = useMutation({
    mutationFn: async () => (await api.post("/api/support-tickets", { subject, description })).data,
    onSuccess: async () => {
      setSubject("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const messageM = useMutation({
    // Reply to the ticket on screen (the first one when none was clicked yet).
    mutationFn: async () => (await api.post(`/api/support-tickets/${selected?.id}/messages`, { message })).data,
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const tickets = ticketsQ.data ?? [];
  const selected = tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0];
  const myName: string | undefined = meQ.data?.name;

  const filteredTickets = useMemo(() => {
    const all = ticketsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((ticket) =>
      [ticket.code, ticket.subject, ticket.category, ticket.status, ticket.customer?.name, ticket.order?.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [search, ticketsQ.data]);

  const newTicketDialog = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button>
          <MessageSquarePlus />
          New ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create issue</DialogTitle>
          <DialogDescription>Describe the problem and our team will reply in the conversation.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short summary" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What happened?"
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createM.mutate(undefined, { onSuccess: () => setCreateOpen(false) })}
            disabled={!subject.trim() || createM.isPending}
          >
            <MessageSquarePlus />
            {createM.isPending ? "Creating..." : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Report a problem and follow the conversation with the support team."
        actions={newTicketDialog}
      />

      {ticketsQ.isLoading ? (
        <LoadingState rows={3} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No support tickets yet."
          description="Something not right with an order or your account? Open a ticket and we'll help."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <MessageSquarePlus />
              New ticket
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className={cn("gap-0 overflow-hidden py-0", mobileDetail && "hidden lg:flex")}>
            <div className="border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tickets"
                  className="pl-8"
                  aria-label="Search tickets"
                />
              </div>
            </div>
            <div className="max-h-[65vh] divide-y overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <EmptyState compact icon={Search} title="No matching tickets" />
              ) : (
                filteredTickets.map((ticket) => {
                  const isActive = selected?.id === ticket.id;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => {
                        setSelectedTicketId(ticket.id);
                        setMobileDetail(true);
                      }}
                      className={cn(
                        "grid w-full gap-1 p-3 text-left transition-colors hover:bg-accent/60",
                        isActive && "bg-accent",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">{ticket.code}</span>
                        <StatusBadge tone={toneForStatus(ticket.status)} dot>
                          {humanizeStatus(ticket.status)}
                        </StatusBadge>
                      </div>
                      <div className="truncate text-sm font-medium">{ticket.subject}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(ticket.created_at)}</div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          {selected ? (
            <Card className={cn("min-w-0", !mobileDetail && "hidden lg:flex")}>
              <CardHeader className="border-b">
                <div className="lg:hidden">
                  <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => setMobileDetail(false)}>
                    <ArrowLeft />
                    All tickets
                  </Button>
                </div>
                <CardTitle className="break-words">{selected.subject ?? "Ticket detail"}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="tabular-nums">{selected.code}</span>
                  <span>·</span>
                  <span>{humanizeStatus(selected.category)}</span>
                  {selected.order ? (
                    <>
                      <span>·</span>
                      <span>Order {selected.order.code}</span>
                    </>
                  ) : null}
                  {selected.customer ? (
                    <>
                      <span>·</span>
                      <span>{selected.customer.name}</span>
                    </>
                  ) : null}
                </CardDescription>
                <CardAction className="flex flex-col items-end gap-1.5">
                  <StatusBadge tone={priorityTone(selected.priority)}>{humanizeStatus(selected.priority)} priority</StatusBadge>
                  <StatusBadge tone={toneForStatus(selected.status)} dot>
                    {humanizeStatus(selected.status)}
                  </StatusBadge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid max-h-[55vh] gap-3 overflow-y-auto">
                {selected.description ? (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm break-words">{selected.description}</div>
                ) : null}
                {selected.messages.length === 0 ? (
                  <EmptyState compact title="No messages yet" description="Send a reply to start the conversation." />
                ) : (
                  selected.messages.map((entry) => {
                    const isOwn = Boolean(myName && entry.user?.name === myName);
                    return (
                      <div key={entry.id} className={cn("flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{entry.user?.name ?? "System"}</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                            {entry.visibility}
                          </Badge>
                        </div>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
                            isOwn ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                          )}
                        >
                          {entry.message}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{formatDateTime(entry.created_at)}</div>
                      </div>
                    );
                  })
                )}
              </CardContent>
              <CardFooter className="border-t">
                <form
                  className="flex w-full items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (message.trim() && !messageM.isPending) messageM.mutate();
                  }}
                >
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write a reply..."
                    rows={2}
                    className="min-h-10 flex-1 resize-none"
                    aria-label="Reply"
                  />
                  <Button type="submit" disabled={!message.trim() || messageM.isPending}>
                    <Send />
                    Send
                  </Button>
                </form>
              </CardFooter>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
