"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/date-utils";
import { markAsRead, markAllAsRead, deleteNotification, deleteAllReadNotifications } from "@/actions/notifications";

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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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
    // 僅允許相對路徑，防止開放重導向攻擊
    if (notification.link && notification.link.startsWith('/')) {
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

  const handleDeleteAllRead = () => {
    setIsConfirmOpen(true);
  };

  const confirmDeleteAllRead = async () => {
    setIsConfirmOpen(false);
    await deleteAllReadNotifications();
    setNotifications((prev) => prev.filter((n) => !n.isRead));
  };

  const formatTime = (date: Date) => {
    return formatDateTime(date);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "REJECTION":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case "REVISION_REQUEST":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        );
      case "APPROVAL":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case "COMPLETED":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        );
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
        <div style={{ display: "flex", gap: "10px" }}>
          {unreadCount > 0 && (
            <button className="mark-all-btn" onClick={handleMarkAllAsRead}>
              全部標記已讀
            </button>
          )}
          {notifications.length > unreadCount && (
            <button className="delete-all-read-btn" onClick={handleDeleteAllRead}>
              刪除所有已讀
            </button>
          )}
        </div>
      </div>

      <div className="notification-list">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{ marginBottom: "16px", opacity: 0.5 }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="刪除確認"
        message="確定要刪除所有已讀通知嗎？此操作無法復原。"
        onConfirm={confirmDeleteAllRead}
        onCancel={() => setIsConfirmOpen(false)}
      />

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

        .delete-all-read-btn {
          padding: 8px 16px;
          border: 1px solid var(--color-danger);
          background-color: transparent;
          color: var(--color-danger);
          font-size: 13px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .delete-all-read-btn:hover {
          background-color: var(--color-danger);
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
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background-color: var(--color-bg-elevated);
          border-radius: 8px;
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

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "確定",
  cancelText = "取消",
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="dialog-btn cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="dialog-btn confirm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
      <style jsx>{`
        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }

        .dialog-content {
          background-color: var(--color-bg-surface);
          padding: 24px;
          border-radius: 12px;
          min-width: 320px;
          max-width: 400px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          border: 1px solid var(--color-border);
          transform: translateY(0);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dialog-title {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text-main);
        }

        .dialog-message {
          margin: 0 0 24px 0;
          color: var(--color-text-muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .dialog-btn {
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel {
          background-color: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-main);
        }

        .cancel:hover {
          background-color: var(--color-bg-base);
        }

        .confirm {
          background-color: var(--color-danger);
          border: none;
          color: white;
        }

        .confirm:hover {
          background-color: #b71c1c;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .confirm:active {
          transform: translateY(0);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
