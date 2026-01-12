"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginForm() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                username,
                password,
                redirect: false,
            });

            if (result?.error) {
                // Check if the error message contains account locked info
                if (result.error.includes("帳號已鎖定") || result.error.includes("密碼錯誤次數過多")) {
                    setError(result.error);
                } else {
                    setError("帳號或密碼錯誤");
                }
            } else {
                // Force full reload to ensure session is picked up
                window.location.href = "/";
            }
        } catch (err) {
            setError("發生未預期的錯誤");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass" style={{
            maxWidth: "420px",
            width: "100%",
            margin: "0 auto",
            padding: "2.5rem",
            borderRadius: "1.5rem",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
                <div style={{
                    padding: '1rem',
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '80px',
                    height: '80px'
                }}>
                    <Image src="/taipower_logo.png" alt="Taipower Logo" width={60} height={60} style={{ objectFit: 'contain' }} />
                </div>

                <h2 style={{
                    fontSize: "1.5rem",
                    fontWeight: 800,
                    color: "var(--color-primary-dark)",
                    marginBottom: "0.25rem",
                    textAlign: "center"
                }}>
                    低放射性廢棄物處置管理系統
                </h2>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
                    LLRWD Management System
                </p>
            </div>

            <h3 style={{ marginBottom: "1.5rem", textAlign: "center", fontSize: "1.25rem", color: "var(--color-text-main)", fontWeight: 700 }}>
                使用者登入
            </h3>

            <form onSubmit={handleSubmit} className="flex-col gap-md">
                {error && (
                    <div style={{
                        padding: "0.75rem",
                        backgroundColor: "#fee2e2",
                        border: "1px solid #fca5a5",
                        borderRadius: "0.5rem",
                        color: "#dc2626",
                        fontSize: "0.9rem",
                        textAlign: "center",
                        fontWeight: 500
                    }}>
                        {error}
                    </div>
                )}

                <div className="flex-col gap-sm">
                    <label htmlFor="username" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                        使用者名稱 (Username)
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="form-input"
                        placeholder="請輸入您的帳號"
                        style={{
                            padding: "0.875rem",
                            borderRadius: "0.75rem",
                            border: "1px solid var(--color-border)",
                            fontSize: "1rem",
                            width: "100%",
                            transition: "all 0.2s",
                            backgroundColor: "rgba(255,255,255,0.8)"
                        }}
                    />
                </div>

                <div className="flex-col gap-sm">
                    <label htmlFor="password" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                        密碼 (Password)
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="form-input"
                        placeholder="請輸入您的密碼"
                        style={{
                            padding: "0.875rem",
                            borderRadius: "0.75rem",
                            border: "1px solid var(--color-border)",
                            fontSize: "1rem",
                            width: "100%",
                            transition: "all 0.2s",
                            backgroundColor: "rgba(255,255,255,0.8)"
                        }}
                    />
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{
                        marginTop: "1.5rem",
                        padding: "1rem",
                        fontSize: "1rem",
                        fontWeight: 700,
                        borderRadius: "0.75rem",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                    }}
                >
                    {loading ? "登入中..." : "登入"}
                </button>
            </form>
        </div>
    );
}
