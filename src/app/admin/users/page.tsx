"use client";

import { useState, useEffect } from "react";
import { createUser, updateUser, deleteUser, unlockUser, getUsersWithLockStatus } from "@/actions/users";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import BackupRestoreSection from "@/components/admin/BackupRestoreSection";

interface User {
    id: string;
    username: string;
    role: string;
    isQC: boolean;
    isPM: boolean;
    createdAt: Date;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
}

interface Project {
    id: number;
    title: string;
    codePrefix: string;
}

export default function UserManagementPage() {
    const { data: session } = useSession();
    const _router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    // Form States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'VIEWER',
        isQC: false,
        isPM: false,
    });
    const [formError, setFormError] = useState('');
    const [fetchError, setFetchError] = useState(''); // New state for fetch error
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (session?.user?.role !== "ADMIN") return;
        fetchUsers();
        fetchProjects();
    }, [session]);

    const fetchUsers = async () => {
        try {
            const data = await getUsersWithLockStatus();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
            setFetchError("無法獲取使用者資訊。請檢查權限或稍後再試。");
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                setProjects(data.map((p: { id: number; title: string; codePrefix: string }) => ({
                    id: p.id,
                    title: p.title,
                    codePrefix: p.codePrefix,
                })));
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setIsSubmitting(true);

        const form = new FormData();
        form.append('username', formData.username);
        form.append('password', formData.password);
        form.append('role', formData.role);
        form.append('isQC', String(formData.isQC));
        form.append('isPM', String(formData.isPM));
        try {
            const result = await createUser({}, form);
            if (result.error) {
                setFormError(result.error);
            } else {
                setIsCreateModalOpen(false);
                setFormData({ username: '', password: '', role: 'VIEWER', isQC: false, isPM: false });
                fetchUsers();
            }
        } catch {
            setFormError('發生錯誤');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            role: user.role,
            isQC: user.isQC,
            isPM: user.isPM,
        });
        setShowEditPassword(false);
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setFormError('');
        setIsSubmitting(true);

        // Prepare update data
        const updateData: { username?: string; password?: string; role?: string; isQC?: boolean; isPM?: boolean } = {};
        if (formData.username !== editingUser.username) updateData.username = formData.username;
        if (formData.password) updateData.password = formData.password;
        if (formData.role !== editingUser.role) updateData.role = formData.role;
        if (formData.isQC !== editingUser.isQC) updateData.isQC = formData.isQC;
        if (formData.isPM !== editingUser.isPM) updateData.isPM = formData.isPM;

        try {
            const result = await updateUser(editingUser.id, updateData);
            if (result.error) {
                setFormError(result.error);
            } else {
                setIsEditModalOpen(false);
                setEditingUser(null);
                setFormData({ username: '', password: '', role: 'VIEWER', isQC: false, isPM: false });
                fetchUsers();
            }
        } catch {
            setFormError('發生錯誤');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('您確定要刪除此使用者嗎？')) return;
        const result = await deleteUser(userId);
        if (result.error) {
            alert('刪除使用者失敗: ' + result.error);
        } else {
            fetchUsers();
        }
    };

    const handleUnlock = async (userId: string) => {
        try {
            const result = await unlockUser(userId);
            if (result.error) {
                alert(result.error);
            } else {
                fetchUsers();
            }
        } catch (err: unknown) {
            console.error('Unlock user error:', err);
            const message = err instanceof Error ? err.message : '未知錯誤';
            alert('解鎖失敗: ' + message);
        }
    };

    const isUserLocked = (user: User) => {
        return user.lockedUntil && new Date(user.lockedUntil) > new Date();
    };

    if (loading) return <div className="container" style={{ padding: '2rem' }}>載入中...</div>;

    if (session?.user?.role !== "ADMIN") {
        return <div className="container" style={{ padding: '2rem' }}>未經授權</div>;
    }

    return (
        <div className="container" style={{ padding: "2rem 0", maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-end",
                marginBottom: "2.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--color-border)"
            }}>
                <div>
                    <h1 style={{ marginBottom: "0.5rem", fontSize: "2.25rem", background: "linear-gradient(to right, var(--color-text-main), var(--color-primary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>使用者管理</h1>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "1rem" }}>配置系統存取權限、QC/PM 資歷及安全設定</p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{
                        padding: "0.85rem 1.75rem",
                        borderRadius: "12px",
                        gap: "0.8rem",
                        boxShadow: "0 4px 15px rgba(0, 131, 143, 0.25)",
                        fontSize: "1rem"
                    }}
                    onClick={() => {
                        setFormData({
                            username: '',
                            password: '',
                            role: 'VIEWER',
                            isQC: false,
                            isPM: false,
                        });
                        setIsCreateModalOpen(true);
                    }}
                >
                    <span style={{ fontSize: "1.2rem" }}>➕</span> 新增使用者
                </button>
            </div>

            {fetchError && (
                <div style={{ padding: "1rem", backgroundColor: "var(--color-danger-bg, #fee2e2)", color: "var(--color-danger, #ef4444)", marginBottom: "1rem", borderRadius: "var(--radius-sm)" }}>
                    {fetchError}
                </div>
            )}

            <div className="glass" style={{
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "var(--shadow-md)",
                border: "1px solid rgba(255, 255, 255, 0.2)"
            }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{
                            borderBottom: "1px solid var(--color-border)",
                            backgroundColor: "rgba(0,0,0,0.03)",
                            color: "var(--color-text-muted)"
                        }}>
                            <th style={{ padding: "1.25rem 1.5rem", textAlign: "left", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>使用者名稱</th>
                            <th style={{ padding: "1.25rem 1.5rem", textAlign: "left", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>權限與資歷</th>
                            <th style={{ padding: "1.25rem 1.5rem", textAlign: "left", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>帳號狀態</th>
                            <th style={{ padding: "1.25rem 1.5rem", textAlign: "left", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>加入日期</th>
                            <th style={{ padding: "1.25rem 1.5rem", textAlign: "right", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} style={{
                                borderBottom: "1px solid var(--color-border)",
                                backgroundColor: isUserLocked(user) ? "rgba(198, 40, 40, 0.03)" : "transparent",
                                transition: "background-color 0.2s"
                            }}>
                                <td style={{ padding: "1.25rem 1.5rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <div style={{
                                            width: "32px", height: "32px", borderRadius: "50%",
                                            backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "0.85rem", fontWeight: "bold"
                                        }}>
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>
                                                {user.username}
                                                {session.user.id === user.id && (
                                                    <span style={{
                                                        marginLeft: "0.5rem", fontSize: "0.7rem",
                                                        backgroundColor: "var(--color-primary-soft)",
                                                        color: "var(--color-primary)",
                                                        padding: "2px 8px", borderRadius: "999px",
                                                        fontWeight: "700"
                                                    }}>ME</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>ID: {user.id.slice(0, 8)}...</div>
                                        </div>
                                    </div>
                                </td>

                                <td style={{ padding: "1.25rem 1.5rem" }}>
                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: "2px 10px",
                                            borderRadius: "6px",
                                            backgroundColor: "rgba(0,0,0,0.05)",
                                            color: "var(--color-text-main)",
                                            fontSize: "0.8rem",
                                            fontWeight: "600",
                                            border: "1px solid var(--color-border)"
                                        }}>
                                            {user.role}
                                        </span>
                                        {user.isQC && (
                                            <span style={{
                                                padding: "2px 10px",
                                                borderRadius: "6px",
                                                backgroundColor: "#E8F5E9",
                                                color: "#2E7D32",
                                                fontSize: "0.8rem",
                                                fontWeight: "600"
                                            }}>QC</span>
                                        )}
                                        {user.isPM && (
                                            <span style={{
                                                padding: "2px 10px",
                                                borderRadius: "6px",
                                                backgroundColor: "#F3E5F5",
                                                color: "#7B1FA2",
                                                fontSize: "0.8rem",
                                                fontWeight: "600"
                                            }}>PM</span>
                                        )}
                                    </div>
                                </td>

                                <td style={{ padding: "1.25rem 1.5rem" }}>
                                    {isUserLocked(user) ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{
                                                display: "inline-block",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                backgroundColor: "rgba(198, 40, 40, 0.1)",
                                                color: "var(--color-danger)",
                                                fontSize: "0.8rem",
                                                fontWeight: "600"
                                            }}>已鎖定 🔒</span>
                                            <button
                                                onClick={() => handleUnlock(user.id)}
                                                style={{
                                                    fontSize: "0.75rem",
                                                    color: "var(--color-primary)",
                                                    background: "none",
                                                    border: "1px solid var(--color-primary)",
                                                    borderRadius: "4px",
                                                    padding: "2px 6px",
                                                    cursor: "pointer"
                                                }}
                                            >
                                                解鎖
                                            </button>
                                        </div>
                                    ) : (
                                        <span style={{
                                            display: "inline-block",
                                            padding: "4px 10px",
                                            borderRadius: "6px",
                                            backgroundColor: "rgba(46, 125, 50, 0.1)",
                                            color: "#2E7D32",
                                            fontSize: "0.8rem",
                                            fontWeight: "600"
                                        }}>正常運作 ✅</span>
                                    )}
                                </td>

                                <td style={{ padding: "1.25rem 1.5rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                                    {new Date(user.createdAt).toLocaleDateString('zh-TW')}
                                </td>

                                <td style={{ padding: "1.25rem 1.5rem", textAlign: "right" }}>
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.25rem" }}>
                                        <button
                                            onClick={() => {
                                                setEditingUser(user);
                                                setFormData({
                                                    username: user.username,
                                                    password: '',
                                                    role: user.role,
                                                    isQC: user.isQC,
                                                    isPM: user.isPM,
                                                });
                                                setIsEditModalOpen(true);
                                                setShowEditPassword(false);
                                            }}
                                            className="btn-icon"
                                            style={{
                                                padding: "8px 12px",
                                                borderRadius: "8px",
                                                color: "var(--color-primary)",
                                                backgroundColor: "transparent",
                                                border: "none",
                                                cursor: "pointer",
                                                fontSize: "0.9rem",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            }}
                                            title="編輯"
                                        >
                                            ✏️ 編輯
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            disabled={user.id === session.user.id}
                                            className="btn-icon"
                                            style={{
                                                padding: "8px 12px",
                                                borderRadius: "8px",
                                                color: "var(--color-danger)",
                                                backgroundColor: "transparent",
                                                border: "none",
                                                cursor: user.id === session.user.id ? "not-allowed" : "pointer",
                                                opacity: user.id === session.user.id ? 0.3 : 1,
                                                fontSize: "0.9rem",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            }}
                                            title="刪除"
                                        >
                                            🗑️ 刪除
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(16, 32, 39, 0.4)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    display: "flex", justifyContent: "center", alignItems: "center",
                    zIndex: 1000,
                    transition: "all 0.3s ease"
                }}>
                    <div className="glass" style={{
                        padding: "2.5rem",
                        borderRadius: "var(--radius-lg)",
                        width: "520px",
                        maxWidth: "92%",
                        maxHeight: "92vh",
                        overflowY: "auto",
                        boxShadow: "var(--shadow-lg), 0 0 20px rgba(0, 131, 143, 0.1)",
                        border: "1px solid rgba(255, 255, 255, 0.2)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "var(--color-primary-soft)", color: "var(--color-primary)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem"
                            }}>
                                ➕
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700" }}>建立新使用者</h2>
                                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>新增一個系統帳號並配置權限</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            <div style={{ display: "grid", gap: "1.25rem" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-main)" }}>使用者名稱</label>
                                    <input
                                        type="text"
                                        required
                                        minLength={2}
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="請輸入使用者名稱"
                                        style={{
                                            width: "100%", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                                            border: "1px solid var(--color-border)",
                                            backgroundColor: "var(--color-bg-base)",
                                            fontSize: "0.95rem",
                                            transition: "border-color 0.2s, box-shadow 0.2s"
                                        }}
                                        onFocus={e => {
                                            e.target.style.borderColor = "var(--color-primary)";
                                            e.target.style.boxShadow = "0 0 0 3px var(--color-primary-soft)";
                                        }}
                                        onBlur={e => {
                                            e.target.style.borderColor = "var(--color-border)";
                                            e.target.style.boxShadow = "none";
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-main)" }}>登入密碼</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="請輸入至少 6 位密碼"
                                        style={{
                                            width: "100%", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                                            border: "1px solid var(--color-border)",
                                            backgroundColor: "var(--color-bg-base)",
                                            fontSize: "0.95rem",
                                            transition: "border-color 0.2s, box-shadow 0.2s"
                                        }}
                                        onFocus={e => {
                                            e.target.style.borderColor = "var(--color-primary)";
                                            e.target.style.boxShadow = "0 0 0 3px var(--color-primary-soft)";
                                        }}
                                        onBlur={e => {
                                            e.target.style.borderColor = "var(--color-border)";
                                            e.target.style.boxShadow = "none";
                                        }}
                                    />
                                    <div style={{ marginTop: "0.5rem" }}>
                                        <PasswordStrengthIndicator password={formData.password} />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-main)" }}>系統角色</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        style={{
                                            width: "100%", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                                            border: "1px solid var(--color-border)",
                                            backgroundColor: "var(--color-bg-surface)",
                                            fontSize: "0.95rem",
                                            cursor: "pointer",
                                            appearance: "none",
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23546E7A'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                            backgroundRepeat: "no-repeat",
                                            backgroundPosition: "right 1rem center",
                                            backgroundSize: "1.25rem"
                                        }}
                                    >
                                        <option value="VIEWER">VIEWER (唯讀模式)</option>
                                        <option value="EDITOR">EDITOR (編輯權限)</option>
                                        <option value="INSPECTOR">INSPECTOR (審核權限)</option>
                                        <option value="ADMIN">ADMIN (系統管理員)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{
                                padding: "1.25rem",
                                borderRadius: "var(--radius-md)",
                                backgroundColor: "rgba(0,0,0,0.03)",
                                border: "1px solid var(--color-border)"
                            }}>
                                <label style={{ display: "block", marginBottom: "1rem", fontWeight: "700", fontSize: "0.9rem", color: "var(--color-text-main)", letterSpacing: "0.05em" }}>權限資歷認證</label>
                                <div style={{ display: "flex", gap: "2rem" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "0.95rem" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isQC}
                                            onChange={e => setFormData({ ...formData, isQC: e.target.checked })}
                                            style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                                        />
                                        <span style={{ fontWeight: "500" }}>品質管制 (QC)</span>
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "0.95rem" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isPM}
                                            onChange={e => setFormData({ ...formData, isPM: e.target.checked })}
                                            style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                                        />
                                        <span style={{ fontWeight: "500" }}>專案經理 (PM)</span>
                                    </label>
                                </div>
                            </div>

                            {formError && (
                                <div style={{
                                    padding: "0.75rem 1rem",
                                    borderRadius: "var(--radius-sm)",
                                    backgroundColor: "rgba(198, 40, 40, 0.1)",
                                    color: "var(--color-danger)",
                                    fontSize: "0.85rem",
                                    border: "1px solid rgba(198, 40, 40, 0.2)"
                                }}>
                                    ❌ {formError}
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="btn btn-outline"
                                    style={{ padding: "0.75rem 1.5rem", borderRadius: "10px" }}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting}
                                    style={{
                                        padding: "0.75rem 2.5rem",
                                        borderRadius: "10px",
                                        boxShadow: "0 4px 12px rgba(0, 131, 143, 0.3)"
                                    }}
                                >
                                    {isSubmitting ? '建立中...' : '建立使用者'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditModalOpen && editingUser && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(16, 32, 39, 0.4)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    display: "flex", justifyContent: "center", alignItems: "center",
                    zIndex: 1000,
                    transition: "all 0.3s ease"
                }}>
                    <div className="glass" style={{
                        padding: "2.5rem",
                        borderRadius: "var(--radius-lg)",
                        width: "520px",
                        maxWidth: "92%",
                        maxHeight: "92vh",
                        overflowY: "auto",
                        boxShadow: "var(--shadow-lg), 0 0 20px rgba(0, 131, 143, 0.1)",
                        border: "1px solid rgba(255, 255, 255, 0.2)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "var(--color-primary-soft)", color: "var(--color-primary)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem"
                            }}>
                                👤
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700" }}>編輯使用者</h2>
                                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>管理使用者帳號及權限設定</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            <div style={{ display: "grid", gap: "1.25rem" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-main)" }}>使用者名稱</label>
                                    <input
                                        type="text"
                                        required
                                        minLength={2}
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        style={{
                                            width: "100%", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                                            border: "1px solid var(--color-border)",
                                            backgroundColor: "var(--color-bg-base)",
                                            fontSize: "0.95rem",
                                            transition: "border-color 0.2s, box-shadow 0.2s"
                                        }}
                                        onFocus={e => {
                                            e.target.style.borderColor = "var(--color-primary)";
                                            e.target.style.boxShadow = "0 0 0 3px var(--color-primary-soft)";
                                        }}
                                        onBlur={e => {
                                            e.target.style.borderColor = "var(--color-border)";
                                            e.target.style.boxShadow = "none";
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-main)" }}>
                                        新密碼 <span style={{ fontWeight: "normal", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>(留白則保持不變)</span>
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showEditPassword ? "text" : "password"}
                                            minLength={6}
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="••••••"
                                            style={{
                                                width: "100%", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                                                border: "1px solid var(--color-border)",
                                                backgroundColor: "var(--color-bg-base)",
                                                fontSize: "0.95rem",
                                                paddingRight: "45px",
                                                transition: "border-color 0.2s, box-shadow 0.2s"
                                            }}
                                            onFocus={e => {
                                                e.target.style.borderColor = "var(--color-primary)";
                                                e.target.style.boxShadow = "0 0 0 3px var(--color-primary-soft)";
                                            }}
                                            onBlur={e => {
                                                e.target.style.borderColor = "var(--color-border)";
                                                e.target.style.boxShadow = "none";
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEditPassword(!showEditPassword)}
                                            style={{
                                                position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                                                background: "none", border: "none", cursor: "pointer",
                                                color: "var(--color-text-muted)", fontSize: "1.2rem", padding: "4px"
                                            }}
                                            title={showEditPassword ? "隱藏密碼" : "顯示密碼"}
                                        >
                                            {showEditPassword ? "👁️" : "👁️‍🗨️"}
                                        </button>
                                    </div>
                                    <div style={{ marginTop: "0.5rem" }}>
                                        <PasswordStrengthIndicator password={formData.password} />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-main)" }}>系統角色</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        disabled={editingUser.id === session?.user?.id}
                                        style={{
                                            width: "100%", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                                            border: "1px solid var(--color-border)",
                                            backgroundColor: editingUser.id === session?.user?.id ? "var(--color-bg-base)" : "var(--color-bg-surface)",
                                            fontSize: "0.95rem",
                                            cursor: editingUser.id === session?.user?.id ? "not-allowed" : "pointer",
                                            appearance: "none",
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23546E7A'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                            backgroundRepeat: "no-repeat",
                                            backgroundPosition: "right 1rem center",
                                            backgroundSize: "1.25rem"
                                        }}
                                    >
                                        <option value="VIEWER">VIEWER (唯讀模式)</option>
                                        <option value="EDITOR">EDITOR (編輯權限)</option>
                                        <option value="INSPECTOR">INSPECTOR (審核權限)</option>
                                        <option value="ADMIN">ADMIN (系統管理員)</option>
                                    </select>
                                    {editingUser.id === session?.user?.id && (
                                        <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>⚠️ 無法修改自己的角色權限</p>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                padding: "1.25rem",
                                borderRadius: "var(--radius-md)",
                                backgroundColor: "rgba(0,0,0,0.03)",
                                border: "1px solid var(--color-border)"
                            }}>
                                <label style={{ display: "block", marginBottom: "1rem", fontWeight: "700", fontSize: "0.9rem", color: "var(--color-text-main)", letterSpacing: "0.05em" }}>權限資歷認證</label>
                                <div style={{ display: "flex", gap: "2rem" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "0.95rem" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isQC}
                                            onChange={e => setFormData({ ...formData, isQC: e.target.checked })}
                                            style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                                        />
                                        <span style={{ fontWeight: "500" }}>品質管制 (QC)</span>
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "0.95rem" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isPM}
                                            onChange={e => setFormData({ ...formData, isPM: e.target.checked })}
                                            style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                                        />
                                        <span style={{ fontWeight: "500" }}>專案經理 (PM)</span>
                                    </label>
                                </div>
                            </div>

                            {formError && (
                                <div style={{
                                    padding: "0.75rem 1rem",
                                    borderRadius: "var(--radius-sm)",
                                    backgroundColor: "rgba(198, 40, 40, 0.1)",
                                    color: "var(--color-danger)",
                                    fontSize: "0.85rem",
                                    border: "1px solid rgba(198, 40, 40, 0.2)"
                                }}>
                                    ❌ {formError}
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="btn btn-outline"
                                    style={{ padding: "0.75rem 1.5rem", borderRadius: "10px" }}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting}
                                    style={{
                                        padding: "0.75rem 2rem",
                                        borderRadius: "10px",
                                        boxShadow: "0 4px 12px rgba(0, 131, 143, 0.3)"
                                    }}
                                >
                                    {isSubmitting ? '儲存中...' : '更新使用者資料'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 備份與復原區塊 */}
            <div style={{ marginTop: "3rem" }}>
                <BackupRestoreSection projects={projects} />
            </div>
        </div >
    );
}
