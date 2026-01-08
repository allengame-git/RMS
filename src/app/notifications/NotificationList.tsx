"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAsRead, markAllAsRead, deleteNotification } from "@/actions/notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

interface NotificationListProps {
  initialNotifications: Notification[];
}

export default function NotificationList({ initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const router = useRouter();

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "REJECTION":
        return "❌";
      case "REVISION_REQUEST":
        return "📝";
      case "APPROVAL":
        return "✅";
      case "COMPLETED":
        return "🎉";
      default:
        return "📢";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "REJECTION":
        return "申請退回";
      case "REVISION_REQUEST":
        return "需要修改";
      case "APPROVAL":
        return "已核准";
      case "COMPLETED":
        return "審核完成";
      default:
        return "系統通知";
    }
  };

  return (
    <div className="notification-page">
      <div className="notification-controls">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            全部 ({notifications.length})
          </button>
          <button
            className={`filter-tab ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            未讀 ({unreadCount})
          </button>
        </div>
        {unreadCount > 0 && (
          <button className="mark-all-btn" onClick={handleMarkAllAsRead}>
            全部標記已讀
          </button>
        )}
      </div>

      <div className="notification-list">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>{filter === "unread" ? "沒有未讀通知" : "沒有通知"}</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-card ${!notification.isRead ? "unread" : ""}`}
            >
              <div className="notification-main" onClick={() => handleClick(notification)}>
                <span className="notification-icon">{getTypeIcon(notification.type)}</span>
                <div className="notification-body">
                  <div className="notification-header">
                    <span className="notification-type">{getTypeLabel(notification.type)}</span>
                    <span className="notification-time">{formatTime(notification.createdAt)}</span>
                  </div>
                  <h3 className="notification-title">{notification.title}</h3>
                  <p className="notification-message">{notification.message}</p>
                </div>
              </div>
              <button
                className="delete-btn"
                onClick={() => handleDelete(notification.id)}
                title="刪除通知"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .notification-page {
          background-color: var(--color-bg-surface);
          border-radius: 12px;
          border: 1px solid var(--color-border);
          overflow: hidden;
        }

        .notification-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
          background-color: var(--color-bg-base);
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
        }

        .filter-tab {
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          font-size: 14px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .filter-tab:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .filter-tab.active {
          background-color: var(--color-primary);
          color: white;
        }

        .mark-all-btn {
          padding: 8px 16px;
          border: none;
          background-color: var(--color-primary-soft);
          color: var(--color-primary);
          font-size: 13px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .mark-all-btn:hover {
          background-color: var(--color-primary);
          color: white;
        }

        .notification-list {
          padding: 8px;
        }

        .notification-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          margin: 8px;
          border-radius: 8px;
          background-color: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          transition: all 0.2s;
        }

        .notification-card:hover {
          background-color: var(--color-bg-base);
        }

        .notification-card.unread {
          background-color: var(--color-primary-soft);
          border-color: var(--color-primary);
        }

        .notification-main {
          flex: 1;
          display: flex;
          gap: 16px;
          cursor: pointer;
        }

        .notification-icon {
          font-size: 28px;
          flex-shrink: 0;
        }

        .notification-body {
          flex: 1;
          min-width: 0;
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .notification-type {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-primary);
          background-color: rgba(0, 131, 143, 0.1);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .notification-time {
          font-size: 12px;
          color: var(--color-text-muted);
          opacity: 0.8;
        }

        .notification-title {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: var(--color-text-main);
        }

        .notification-message {
          font-size: 14px;
          color: var(--color-text-muted);
          margin: 0;
          line-height: 1.5;
        }

        .delete-btn {
          padding: 4px 8px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          font-size: 14px;
          cursor: pointer;
          border-radius: 4px;
          opacity: 0;
          transition: all 0.2s;
        }

        .notification-card:hover .delete-btn {
          opacity: 1;
        }

        .delete-btn:hover {
          background-color: rgba(198, 40, 40, 0.1);
          color: var(--color-danger);
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--color-text-muted);
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
