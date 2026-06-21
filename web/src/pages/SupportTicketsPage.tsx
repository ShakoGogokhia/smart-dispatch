import { MessageSquarePlus, Send } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

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

export default function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

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
    mutationFn: async () => (await api.post(`/api/support-tickets/${selectedTicketId}/messages`, { message })).data,
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const tickets = ticketsQ.data ?? [];
  const selected = tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0];

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Support</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="rounded-[30px]">
          <CardHeader><CardTitle className="text-2xl">Create issue</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
            <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happened?" />
            <Button onClick={() => createM.mutate()} disabled={!subject.trim() || createM.isPending}>
              <MessageSquarePlus className="h-4 w-4" />
              Create ticket
            </Button>

            <div className="mt-3 grid gap-2">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{ticket.code}</div>
                      <div className="mt-1 text-sm theme-copy">{ticket.subject}</div>
                    </div>
                    <Badge className="status-chip status-neutral">{ticket.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[30px]">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-2xl">{selected?.subject ?? "Ticket detail"}</CardTitle>
                {selected ? <div className="mt-2 text-sm theme-copy">{selected.code} - {selected.category}</div> : null}
              </div>
              {selected ? <Badge className="status-chip status-neutral">{selected.priority}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!selected ? (
              <div className="rounded-[22px] border border-slate-200 p-5 text-sm theme-copy dark:border-slate-800">No support tickets yet.</div>
            ) : (
              <>
                <div className="grid gap-3">
                  {selected.messages.map((entry) => (
                    <div key={entry.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{entry.user?.name ?? "System"}</div>
                        <Badge className="status-chip status-neutral">{entry.visibility}</Badge>
                      </div>
                      <div className="mt-2 text-sm theme-copy">{entry.message}</div>
                      <div className="mt-2 text-xs theme-copy">{formatDateTime(entry.created_at)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Reply" />
                  <Button onClick={() => messageM.mutate()} disabled={!message.trim() || messageM.isPending}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
