import { Bell, BellOff, Check, CheckCheck, Package, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { formatRelativeTime } from "@/components/insights/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationRecord } from "@/types/api";

const filters = [
  { label: "All", value: "" },
  { label: "Unread", value: "unread" },
  { label: "Orders", value: "order" },
  { label: "Drivers", value: "driver" },
  { label: "Markets", value: "market" },
];

function iconForType(type: string): { icon: LucideIcon; className: string } {
  const t = type.toLowerCase();
  if (t.includes("order")) return { icon: Package, className: "bg-primary/10 text-primary" };
  if (t.includes("driver")) return { icon: Truck, className: "bg-info/15 text-info" };
  if (t.includes("market")) return { icon: Store, className: "bg-success/15 text-success" };
  return { icon: Bell, className: "bg-muted text-muted-foreground" };
}

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
  const unread = notifications.filter((n) => !n.read_at);
  const earlier = notifications.filter((n) => n.read_at);

  const renderItem = (notification: NotificationRecord) => {
    const { icon: Icon, className } = iconForType(notification.type);
    const isUnread = !notification.read_at;
    return (
      <div key={notification.id} className={cn("flex items-start gap-3 p-4", isUnread && "bg-primary/5")}>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", className)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {isUnread ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
              <span className={cn("truncate text-sm", isUnread ? "font-semibold" : "font-medium")}>{notification.title}</span>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(notification.created_at)}>
              {formatRelativeTime(notification.created_at)}
            </span>
          </div>
          <p className="mt-0.5 text-sm break-words text-muted-foreground">{notification.message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              {notification.type}
            </Badge>
            {isUnread && (
              <Button
                size="xs"
                variant="ghost"
                className="ml-auto"
                onClick={() => markReadM.mutate(notification.id)}
                disabled={markReadM.isPending}
              >
                <Check />
                Mark read
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, items: NotificationRecord[]) =>
    items.length ? (
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {title} <span className="tabular-nums">({items.length})</span>
        </h2>
        <Card className="gap-0 divide-y overflow-hidden py-0">{items.map(renderItem)}</Card>
      </section>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Updates about orders, drivers and markets. New items appear automatically."
        actions={
          <Button variant="outline" onClick={() => markAllM.mutate()} disabled={markAllM.isPending}>
            <CheckCheck />
            Mark all as read
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <Tabs value={filter || "all"} onValueChange={(value) => setFilter(value === "all" ? "" : value)}>
            <TabsList>
              {filters.map((item) => (
                <TabsTrigger key={item.value || "all"} value={item.value || "all"}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </PageHeader>

      {notificationsQ.isLoading ? (
        <LoadingState rows={4} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          description={filter ? "No notifications for this filter. Try another tab." : "There are no notifications right now."}
        />
      ) : (
        <div className="space-y-6">
          {renderGroup("Unread", unread)}
          {renderGroup("Earlier", earlier)}
        </div>
      )}
    </div>
  );
}
