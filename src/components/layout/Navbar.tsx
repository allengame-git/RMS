"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [pendingCount, setPendingCount] = useState(0);
    const [hasApprovalAccess, setHasApprovalAccess] = useState(false);

    useEffect(() => {
        // Load theme on mount
        const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        setTheme(savedTheme);
    }, []);

    // Fetch pending count for ADMIN/INSPECTOR/QC/PM
    useEffect(() => {
        if (session) {
            const fetchCount = async () => {
                try {
                    const res = await fetch('/api/pending-count');
                    const data = await res.json();
                    setPendingCount(data.count || 0);
                    // Show approval link if user has pending items or is ADMIN/INSPECTOR
                    const hasAccess = (data.count > 0) ||
                        ["ADMIN", "INSPECTOR"].includes(session.user.role);
                    setHasApprovalAccess(hasAccess || data.hasApprovalAccess);
                } catch (e) {
                    console.error('Failed to fetch pending count');
                }
            };
            fetchCount();
            // Refresh every 30 seconds
            const interval = setInterval(fetchCount, 30000);
            return () => clearInterval(interval);
        }
    }, [session]);

    // Fetch rejected requests count for all logged-in users
    const [rejectedCount, setRejectedCount] = useState(0);
    useEffect(() => {
        if (session) {
            const fetchRejectedCount = async () => {
                try {
                    const res = await fetch('/api/rejected-count');
                    const data = await res.json();
                    setRejectedCount(data.count || 0);
                } catch (e) {
                    console.error('Failed to fetch rejected count');
                }
            };
            fetchRejectedCount();
            const interval = setInterval(fetchRejectedCount, 30000);
            return () => clearInterval(interval);
        }
    }, [session]);

    const isActive = (path: string) => pathname === path ? "active" : "";

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    return (
        <nav className="glass" style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            marginBottom: "2rem",
            borderBottom: "1px solid var(--color-border)"
        }}>
            <div className="container" style={{
                height: "64px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
            }}>
                <div className="flex-center gap-md" style={{ flexShrink: 0 }}>
                    <Link href="/" className="flex-center" style={{ textDecoration: 'none', gap: '0.75rem', whiteSpace: 'nowrap' }}>
                        <Image src="/taipower_logo.png" alt="Taipower Logo" width={42} height={42} style={{ objectFit: 'contain' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <span style={{ fontSize: "0.95rem", fontWeight: "bold", color: "var(--color-primary)", letterSpacing: '0.2px' }}>
                                低放射性廢棄物處置管理系統
                            </span>
                            <span style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
                                LLRWD Management System
                            </span>
                        </div>
                    </Link>

                    {session && (
                        <div className="flex-center gap-sm">
                            <Link
                                href="/projects"
                                className={`btn btn-outline ${isActive("/projects") ? "active-link" : ""}`}
                                style={{ border: "none", padding: "0.5rem 0.75rem", whiteSpace: 'nowrap' }}
                            >
                                專案管理
                            </Link>
                            <Link
                                href="/datafiles"
                                className={`btn btn-outline ${isActive("/datafiles") ? "active-link" : ""}`}
                                style={{ border: "none", padding: "0.5rem 1rem" }}
                            >
                                檔案管理
                            </Link>
                            <Link
                                href="/admin/history"
                                className={`btn btn-outline ${isActive("/admin/history") ? "active-link" : ""}`}
                                style={{ border: "none", padding: "0.5rem 1rem" }}
                            >
                                歷史記錄
                            </Link>
                            <Link
                                href="/iso-docs"
                                className={`btn btn-outline ${isActive("/iso-docs") ? "active-link" : ""}`}
                                style={{ border: "none", padding: "0.5rem 1rem" }}
                            >
                                ISO文件
                            </Link>
                            <Link
                                href="/admin/rejected-requests"
                                className={`btn btn-outline ${isActive("/admin/rejected-requests") ? "active-link" : ""}`}
                                style={{ border: "none", padding: "0.5rem 1rem", position: "relative" }}
                            >
                                待修改
                                {rejectedCount > 0 && (
                                    <span style={{
                                        position: "absolute",
                                        top: "0",
                                        right: "0",
                                        transform: "translate(30%, -30%)",
                                        backgroundColor: "#f59e0b",
                                        color: "white",
                                        fontSize: "0.7rem",
                                        fontWeight: "bold",
                                        minWidth: "18px",
                                        height: "18px",
                                        borderRadius: "9px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "0 4px"
                                    }}>
                                        {rejectedCount > 99 ? '99+' : rejectedCount}
                                    </span>
                                )}
                            </Link>
                            {(hasApprovalAccess || ["ADMIN", "INSPECTOR"].includes(session.user.role)) && (
                                <Link
                                    href="/admin/approval"
                                    className={`btn btn-outline ${isActive("/admin/approval") ? "active-link" : ""}`}
                                    style={{ border: "none", padding: "0.5rem 1rem", position: "relative" }}
                                >
                                    審核作業
                                    {pendingCount > 0 && (
                                        <span style={{
                                            position: "absolute",
                                            top: "0",
                                            right: "0",
                                            transform: "translate(30%, -30%)",
                                            backgroundColor: "var(--color-danger, #ef4444)",
                                            color: "white",
                                            fontSize: "0.7rem",
                                            fontWeight: "bold",
                                            minWidth: "18px",
                                            height: "18px",
                                            borderRadius: "9px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: "0 4px"
                                        }}>
                                            {pendingCount > 99 ? '99+' : pendingCount}
                                        </span>
                                    )}
                                </Link>
                            )}
                            {session.user.role === "ADMIN" && (
                                <Link
                                    href="/admin/users"
                                    className={`btn btn-outline ${isActive("/admin/users") ? "active-link" : ""}`}
                                    style={{ border: "none", padding: "0.5rem 1rem" }}
                                >
                                    使用者管理
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-center gap-md">
                    {session && (
                        <button
                            onClick={toggleTheme}
                            className="btn btn-outline"
                            style={{ fontSize: "1.2rem", padding: "0.4rem 0.8rem", border: "none" }}
                            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                    )}
                    {session && <NotificationBell />}
                    {session ? (
                        <>
                            <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                                {session.user.username} ({session.user.role})
                            </span>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="btn btn-outline"
                                style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                            >
                                登出
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
            <style jsx>{`
        .active-link {
          color: var(--color-primary);
          background-color: var(--color-primary-soft);
        }
      `}</style>
        </nav>
    );
}
