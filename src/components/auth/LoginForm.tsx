"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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
                setError("Invalid username or password");
            } else {
                router.refresh();
                router.push("/");
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ maxWidth: "400px", width: "100%", margin: "0 auto" }}>
            <h2 style={{ marginBottom: "1.5rem", textAlign: "center" }}>Sign In</h2>
            <form onSubmit={handleSubmit} className="flex-col gap-md">
                {error && (
                    <div style={{ color: "var(--color-danger)", fontSize: "0.9rem", textAlign: "center" }}>
                        {error}
                    </div>
                )}

                <div className="flex-col gap-sm">
                    <label htmlFor="username" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                        Username
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        style={{
                            padding: "0.75rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            fontSize: "1rem",
                        }}
                    />
                </div>

                <div className="flex-col gap-sm">
                    <label htmlFor="password" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            padding: "0.75rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            fontSize: "1rem",
                        }}
                    />
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ marginTop: "1rem" }}
                >
                    {loading ? "Signing in..." : "Sign In"}
                </button>
            </form>
        </div>
    );
}
