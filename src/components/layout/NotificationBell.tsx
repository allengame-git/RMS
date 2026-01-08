"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
} from "@/actions/notifications";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    isRead: boolean;
    createdAt: Date;
}

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // 載入未讀數量
    useEffect(() => {
        const loadUnreadCount = async () => {
            const count = await getUnreadCount();
            setUnreadCount(count);
        };
        loadUnreadCount();

        // 每 30 秒更新一次
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    // 點擊外部關閉
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 載入通知列表
    const loadNotifications = async () => {
        setLoading(true);
        const data = await getNotifications(10);
        setNotifications(data as Notification[]);
        setLoading(false);
    };

    // 切換下拉選單
    const toggleDropdown = async () => {
        if (!isOpen) {
            await loadNotifications();
        }
        setIsOpen(!isOpen);
    };

    // 點擊通知
    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            await markAsRead(notification.id);
            setUnreadCount((prev) => Math.max(0, prev - 1));
            setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
            );
        }

        if (notification.link) {
            router.push(notification.link);
        }
        setIsOpen(false);
    };

    // 全部標記已讀
    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    };

    // 格式化時間
    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "剛剛";
        if (minutes < 60) return `${minutes} 分鐘前`;
        if (hours < 24) return `${hours} 小時前`;
        if (days < 7) return `${days} 天前`;
        return new Date(date).toLocaleDateString("zh-TW");
    };

    // 取得通知圖示
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

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button
                className="notification-bell-button"
                onClick={toggleDropdown}
                aria-label="通知"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notification-badge">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>通知</h3>
                        {unreadCount > 0 && (
                            <button
                                className="mark-all-read-btn"
                                onClick={handleMarkAllAsRead}
                            >
                                全部標記已讀
                            </button>
                        )}
                    </div>

                    <div className="notification-list">
                        {loading ? (
                            <div className="notification-loading">載入中...</div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty">沒有通知</div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${!notification.isRead ? "unread" : ""}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <span className="notification-icon">
                                        {getTypeIcon(notification.type)}
                                    </span>
                                    <div className="notification-content">
                                        <div className="notification-title">{notification.title}</div>
                                        <div className="notification-message">{notification.message}</div>
                                        <div className="notification-time">
                                            {formatTime(notification.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="notification-footer">
                        <button
                            className="view-all-btn"
                            onClick={() => {
                                router.push("/notifications");
                                setIsOpen(false);
                            }}
                        >
                            查看全部通知
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
        .notification-bell-container {
          position: relative;
        }

        .notification-bell-button {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          position: relative;
          border-radius: 8px;
          transition: background-color 0.2s;
        }

        .notification-bell-button:hover {
          background-color: var(--color-bg-base);
          color: var(--color-text-main);
        }

        .notification-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          background-color: var(--color-danger);
          color: white;
          font-size: 10px;
          font-weight: 600;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        .notification-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 360px;
          max-height: 480px;
          background-color: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          box-shadow: var(--shadow-lg);
          z-index: 1000;
          overflow: hidden;
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
        }

        .notification-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text-main);
        }

        .mark-all-read-btn {
          background: transparent;
          border: none;
          color: var(--color-primary);
          font-size: 13px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .mark-all-read-btn:hover {
          background-color: var(--color-primary-soft);
        }

        .notification-list {
          max-height: 360px;
          overflow-y: auto;
        }

        .notification-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--color-border);
          transition: background-color 0.15s;
        }

        .notification-item:hover {
          background-color: var(--color-bg-base);
        }

        .notification-item.unread {
          background-color: var(--color-primary-soft);
        }

        .notification-item.unread:hover {
          background-color: rgba(0, 131, 143, 0.2); /* Slightly darker soft teal */
        }

        .notification-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
          color: var(--color-text-main);
        }

        .notification-message {
          font-size: 13px;
          color: var(--color-text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notification-time {
          font-size: 11px;
          color: var(--color-text-muted);
          opacity: 0.8;
          margin-top: 4px;
        }

        .notification-loading,
        .notification-empty {
          padding: 32px;
          text-align: center;
          color: var(--color-text-muted);
        }

        .notification-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--color-border);
        }

        .view-all-btn {
          width: 100%;
          padding: 10px;
          background-color: var(--color-bg-base);
          border: none;
          border-radius: 8px;
          color: var(--color-text-main);
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .view-all-btn:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
      `}</style>
        </div>
    );
}
