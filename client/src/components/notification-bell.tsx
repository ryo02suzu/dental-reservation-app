import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, X, CheckCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  appointmentId?: string;
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

export function NotificationBell({ collapsed, onViewChange }: { collapsed: boolean; onViewChange?: (view: string, date?: string) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<AdminNotification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60000,
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });
  const unreadCount = countData?.count ?? 0;

  const markAllRead = useCallback(async () => {
    await apiRequest("PUT", "/api/notifications/read-all");
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  }, [queryClient]);

  // SSE: リアルタイム通知受信
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/notifications/stream");
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_booking" && data.notification) {
            const n: AdminNotification = data.notification;
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
            queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
            toast({
              title: n.title,
              description: n.body,
              duration: 8000,
            });
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    }
    connect();
    return () => { es?.close(); clearTimeout(retryTimeout); };
  }, [queryClient, toast]);

  // パネル外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unreadCount > 0) markAllRead();
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative w-8 h-8 text-sidebar-foreground hover:text-foreground"
        onClick={handleOpen}
        data-testid="button-notification-bell"
        title="通知"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none" data-testid="badge-notification-count">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute z-50 left-0 top-9 w-80 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">通知</span>
              {unreadCount > 0 && (
                <Badge className="h-4 px-1.5 text-[10px] bg-red-500 hover:bg-red-500">{unreadCount}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={markAllRead} data-testid="button-mark-all-read">
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  全既読
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">通知はありません</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-accent transition-colors ${!n.isRead ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    if (onViewChange && n.type === "new_booking") {
                      const dateMatch = (n.body || "").match(/(\d{4}-\d{2}-\d{2})/);
                      onViewChange("calendar", dateMatch?.[1]);
                    }
                  }}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="mt-0.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${n.type === "new_booking" ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"}`}>
                      <Calendar className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                      {!n.isRead && <span className="shrink-0 w-2 h-2 mt-1 rounded-full bg-red-500" />}
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
