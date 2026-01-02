"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Navbar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        // Load theme on mount
        const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        setTheme(savedTheme);
    }, []);

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
                <div className="flex-center gap-md">
                    <Link href="/" style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--color-primary)" }}>
                        RMS
                    </Link>

                    {session && (
                        <div className="flex-center gap-sm">
                            <Link
                                href="/projects"
                                className={`btn btn-outline ${isActive("/projects") ? "active-link" : ""}`}
                                style={{ border: "none", padding: "0.5rem 1rem" }}
                            >
                                Projects
                            </Link>
                            {(session.user.role === "ADMIN" || session.user.role === "INSPECTOR") && (
                                <Link
                                    href="/admin/approval"
                                    className={`btn btn-outline ${isActive("/admin/approval") ? "active-link" : ""}`}
                                    style={{ border: "none", padding: "0.5rem 1rem" }}
                                >
                                    Approvals
                                </Link>
                            )}
                            {session.user.role === "ADMIN" && (
                                <Link
                                    href="/admin/users"
                                    className={`btn btn-outline ${isActive("/admin/users") ? "active-link" : ""}`}
                                    style={{ border: "none", padding: "0.5rem 1rem" }}
                                >
                                    Users
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
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <Link href="/auth/login" className="btn btn-primary">
                            Login
                        </Link>
                    )}
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
