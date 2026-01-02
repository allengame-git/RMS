"use client";

import { useState, useEffect } from "react";
import { getUsers, createUser, updateUser, deleteUser } from "@/actions/users";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    username: string;
    role: string;
    createdAt: Date;
}

export default function UserManagementPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    // Form States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({ username: '', password: '', role: 'VIEWER' });
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (session?.user?.role !== "ADMIN") return;
        fetchUsers();
    }, [session]);

    const fetchUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
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

        try {
            const result = await createUser({}, form);
            if (result.error) {
                setFormError(result.error);
            } else {
                setIsCreateModalOpen(false);
                setFormData({ username: '', password: '', role: 'VIEWER' });
                fetchUsers();
            }
        } catch (err) {
            setFormError('An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({ username: user.username, password: '', role: user.role });
        setShowEditPassword(false);
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setFormError('');
        setIsSubmitting(true);

        // Prepare update data
        const updateData: any = {};
        if (formData.username !== editingUser.username) updateData.username = formData.username;
        if (formData.password) updateData.password = formData.password;
        if (formData.role !== editingUser.role) updateData.role = formData.role;

        try {
            const result = await updateUser(editingUser.id, updateData);
            if (result.error) {
                setFormError(result.error);
            } else {
                setIsEditModalOpen(false);
                setEditingUser(null);
                setFormData({ username: '', password: '', role: 'VIEWER' });
                fetchUsers();
            }
        } catch (err) {
            setFormError('An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await deleteUser(userId);
            fetchUsers();
        } catch (err) {
            alert('Failed to delete user');
        }
    };

    if (loading) return <div className="container" style={{ padding: '2rem' }}>Loading...</div>;

    if (session?.user?.role !== "ADMIN") {
        return <div className="container" style={{ padding: '2rem' }}>Unauthorized</div>;
    }

    return (
        <div className="container" style={{ padding: "2rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <h1>User Management</h1>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setFormData({ username: '', password: '', role: 'VIEWER' });
                        setIsCreateModalOpen(true);
                    }}
                >
                    Add User
                </button>
            </div>

            <div className="glass" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(0,0,0,0.02)" }}>
                            <th style={{ padding: "1rem", textAlign: "left" }}>Username</th>
                            <th style={{ padding: "1rem", textAlign: "left" }}>Role</th>
                            <th style={{ padding: "1rem", textAlign: "left" }}>Joined Info</th>
                            <th style={{ padding: "1rem", textAlign: "right" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                <td style={{ padding: "1rem", fontWeight: "bold" }}>
                                    {user.username}
                                    {session.user.id === user.id && <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "var(--color-primary)", border: "1px solid currentColor", padding: "2px 6px", borderRadius: "10px" }}>YOU</span>}
                                </td>
                                <td style={{ padding: "1rem" }}>
                                    <span style={{
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        backgroundColor: "var(--color-background)",
                                        fontSize: "0.9rem",
                                        border: "1px solid var(--color-border)"
                                    }}>
                                        {user.role}
                                    </span>
                                </td>
                                <td style={{ padding: "1rem", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "right" }}>
                                    <button
                                        onClick={() => openEditModal(user)}
                                        disabled={user.id === session.user.id}
                                        style={{
                                            marginRight: "1rem",
                                            color: "var(--color-primary)",
                                            background: "transparent",
                                            border: "none",
                                            cursor: user.id === session.user.id ? "not-allowed" : "pointer",
                                            opacity: user.id === session.user.id ? 0.5 : 1
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        disabled={user.id === session.user.id}
                                        style={{
                                            color: "var(--color-danger, #ef4444)",
                                            background: "transparent",
                                            border: "none",
                                            cursor: user.id === session.user.id ? "not-allowed" : "pointer",
                                            opacity: user.id === session.user.id ? 0.5 : 1
                                        }}
                                    >
                                        Delete
                                    </button>
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
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center",
                    zIndex: 1000
                }}>
                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", width: "400px", maxWidth: "90%" }}>
                        <h2 style={{ marginBottom: "1.5rem" }}>Create New User</h2>
                        <form onSubmit={handleCreateUser}>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Username</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                                />
                            </div>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                                />
                            </div>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Role</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                                >
                                    <option value="VIEWER">VIEWER (Read Only)</option>
                                    <option value="EDITOR">EDITOR (Create/Edit)</option>
                                    <option value="INSPECTOR">INSPECTOR (Approve)</option>
                                    <option value="ADMIN">ADMIN (Full Access)</option>
                                </select>
                            </div>
                            {formError && <p style={{ color: "red", marginBottom: "1rem" }}>{formError}</p>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="btn btn-outline"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Creating...' : 'Create User'}
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
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center",
                    zIndex: 1000
                }}>
                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", width: "400px", maxWidth: "90%" }}>
                        <h2 style={{ marginBottom: "1.5rem" }}>Edit User</h2>
                        <form onSubmit={handleUpdateUser}>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Username</label>
                                <input
                                    type="text"
                                    required
                                    minLength={3}
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                                />
                            </div>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                                    New Password <span style={{ fontWeight: "normal", fontSize: "0.85em", color: "var(--color-text-muted)" }}>(Leave blank to keep current)</span>
                                </label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type={showEditPassword ? "text" : "password"}
                                        minLength={6}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••"
                                        style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border)", paddingRight: "40px" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowEditPassword(!showEditPassword)}
                                        style={{
                                            position: "absolute",
                                            right: "8px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--color-text-muted)",
                                            fontSize: "1.2rem",
                                            lineHeight: "1",
                                            padding: 0
                                        }}
                                        title={showEditPassword ? "Hide password" : "Show password"}
                                    >
                                        {showEditPassword ? "👁️" : "👁️‍🗨️"}
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Role</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                                >
                                    <option value="VIEWER">VIEWER (Read Only)</option>
                                    <option value="EDITOR">EDITOR (Create/Edit)</option>
                                    <option value="INSPECTOR">INSPECTOR (Approve)</option>
                                    <option value="ADMIN">ADMIN (Full Access)</option>
                                </select>
                            </div>
                            {formError && <p style={{ color: "red", marginBottom: "1rem" }}>{formError}</p>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="btn btn-outline"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Save Changes' : 'Update User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
