import { Bell, CheckCheck, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { NotificationRecord } from "@/types/api";

const filters = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Orders", value: "order" },
  { label: "Drivers", value: "driver" },
  { label: "Markets", value: "market" },
];

export default function NotificationsPage() {
  const [filter, setFilter] = useState("");
  const queryClient = useQueryClient();
  const queryString = useMemo(() => {
    if (filter === "unread") return "?status=unread";
    if (filter) return `?type=${encodeURIComponent(filter)}`;
    return "";
  }, [filter]);

  const notificationsQ = useQuery({
    queryKey: ["notifications-page", filter],
    queryFn: async () => (await api.get(`/api/notifications${queryString}`)).data as NotificationRecord[],
    refetchInterval: 15000,
  });
  const markReadM = useMutation({
    mutationFn: async (id: number) => (await api.post(`/api/notifications/${id}/read`)).data,
    onSuccess: refresh,
  });
  const markAllM = useMutation({
    mutationFn: async () => (await api.post("/api/notifications/read-all")).data,
    onSuccess: refresh,
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  }

  const notifications = notificationsQ.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Notifications</h1>
      </div>

      <Card className="rounded-[30px]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-2xl">Notification center</CardTitle>
            <Button onClick={() => markAllM.mutate()} disabled={markAllM.isPending}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <Button key={item.value || "all"} variant={filter === item.value ? "default" : "secondary"} onClick={() => setFilter(item.value)}>
                <Filter className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3">
            {notificationsQ.isLoading ? (
              <div className="p-5 text-sm theme-copy">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="rounded-[22px] border border-slate-200 p-5 text-sm theme-copy dark:border-slate-800">No notifications for this filter.</div>
            ) : notifications.map((notification) => (
              <div key={notification.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-950 text-white dark:bg-cyan-500/15 dark:text-cyan-100">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold">{notification.title}</div>
                      <div className="mt-1 text-sm theme-copy">{notification.message}</div>
                      <div className="mt-2 text-xs theme-copy">{notification.type} - {formatDateTime(notification.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={`status-chip ${notification.read_at ? "status-neutral" : "status-good"}`}>{notification.read_at ? "Read" : "Unread"}</Badge>
                    {!notification.read_at && (
                      <Button size="sm" variant="secondary" onClick={() => markReadM.mutate(notification.id)} disabled={markReadM.isPending}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
