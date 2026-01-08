"use client";

import { useState, useEffect } from "react";
import { getUsers, createUser, updateUser, deleteUser } from "@/actions/users";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    username: string;
    role: string;
    isQC: boolean;
    isPM: boolean;
    signaturePath?: string | null;
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
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'VIEWER',
        isQC: false,
        isPM: false,
        signaturePath: ''
    });
    const [formError, setFormError] = useState('');
    const [fetchError, setFetchError] = useState(''); // New state for fetch error
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
            setFetchError("Failed to fetch users. Please check your permissions or try again.");
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
        form.append('isQC', String(formData.isQC));
        form.append('isPM', String(formData.isPM));
        if (formData.signaturePath) {
            form.append('signaturePath', formData.signaturePath);
        }

        try {
            const result = await createUser({}, form);
            if (result.error) {
                setFormError(result.error);
            } else {
                setIsCreateModalOpen(false);
                setFormData({ username: '', password: '', role: 'VIEWER', isQC: false, isPM: false, signaturePath: '' });
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
        setFormData({
            username: user.username,
            password: '',
            role: user.role,
            isQC: user.isQC,
            isPM: user.isPM,
            signaturePath: user.signaturePath || ''
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
        const updateData: any = {};
        if (formData.username !== editingUser.username) updateData.username = formData.username;
        if (formData.password) updateData.password = formData.password;
        if (formData.role !== editingUser.role) updateData.role = formData.role;
        if (formData.isQC !== editingUser.isQC) updateData.isQC = formData.isQC;
        if (formData.isPM !== editingUser.isPM) updateData.isPM = formData.isPM;
        if (formData.signaturePath !== editingUser.signaturePath) updateData.signaturePath = formData.signaturePath;

        try {
            const result = await updateUser(editingUser.id, updateData);
            if (result.error) {
                setFormError(result.error);
            } else {
                setIsEditModalOpen(false);
                setEditingUser(null);
                setFormData({ username: '', password: '', role: 'VIEWER', isQC: false, isPM: false, signaturePath: '' });
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
        } catch (err: any) {
            console.error('Delete user error:', err);
            alert('Failed to delete user: ' + (err?.message || 'Unknown error'));
        }
    };

    if (loading) return <div className="container" style={{ padding: '2rem' }}>Loading...</div>;

    if (session?.user?.role !== "ADMIN") {
        return <div className="container" style={{ padding: '2rem' }}>Unauthorized</div>;
    }

    const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, signaturePath: data.file.path }));
            } else {
                alert(`Upload failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed');
        }
    };

    return (
        <div className="container" style={{ padding: "2rem 0", maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <h1>User Management</h1>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setFormData({
                            username: '',
                            password: '',
                            role: 'VIEWER',
                            isQC: false,
                            isPM: false,
                            signaturePath: ''
                        });
                        setIsCreateModalOpen(true);
                    }}
                >
                    Add User
                </button>
            </div>

            {fetchError && (
                <div style={{ padding: "1rem", backgroundColor: "var(--color-danger-bg, #fee2e2)", color: "var(--color-danger, #ef4444)", marginBottom: "1rem", borderRadius: "var(--radius-sm)" }}>
                    {fetchError}
                </div>
            )}

            <div className="glass" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(0,0,0,0.02)" }}>
                            <th style={{ padding: "1rem", textAlign: "left" }}>Username</th>
                            <th style={{ padding: "1rem", textAlign: "left" }}>Role & Qualifications</th>
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
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: "4px 8px",
                                            borderRadius: "4px",
                                            backgroundColor: "var(--color-background)",
                                            fontSize: "0.9rem",
                                            border: "1px solid var(--color-border)"
                                        }}>
                                            {user.role}
                                        </span>
                                        {user.isQC && (
                                            <span style={{
                                                padding: "2px 6px",
                                                borderRadius: "4px",
                                                backgroundColor: "rgba(14, 165, 233, 0.1)",
                                                color: "rgb(14, 165, 233)",
                                                fontSize: "0.8rem",
                                                border: "1px solid rgba(14, 165, 233, 0.2)",
                                                fontWeight: "600"
                                            }}>
                                                QC
                                            </span>
                                        )}
                                        {user.isPM && (
                                            <span style={{
                                                padding: "2px 6px",
                                                borderRadius: "4px",
                                                backgroundColor: "rgba(245, 158, 11, 0.1)",
                                                color: "rgb(245, 158, 11)",
                                                fontSize: "0.8rem",
                                                border: "1px solid rgba(245, 158, 11, 0.2)",
                                                fontWeight: "600"
                                            }}>
                                                PM
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: "1rem", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "right" }}>
                                    <button
                                        onClick={() => openEditModal(user)}
                                        disabled={false}
                                        style={{
                                            marginRight: "1rem",
                                            color: "var(--color-primary)",
                                            background: "transparent",
                                            border: "none",
                                            cursor: "pointer",
                                            opacity: 1
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
                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", width: "500px", maxWidth: "90%", maxHeight: "90vh", overflowY: "auto" }}>
                        <h2 style={{ marginBottom: "1.5rem" }}>Create New User</h2>
                        <form onSubmit={handleCreateUser}>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Username</label>
                                <input
                                    type="text"
                                    required
                                    minLength={2}
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

                            <div style={{ marginBottom: "1.5rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Qualifications</label>
                                <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isQC}
                                            onChange={e => setFormData({ ...formData, isQC: e.target.checked })}
                                        />
                                        <span>Quality Control (QC)</span>
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isPM}
                                            onChange={e => setFormData({ ...formData, isPM: e.target.checked })}
                                        />
                                        <span>Project Manager (PM)</span>
                                    </label>
                                </div>
                            </div>

                            <div style={{ marginBottom: "1.5rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Digital Signature</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSignatureUpload}
                                    style={{ marginBottom: "0.5rem" }}
                                />
                                {formData.signaturePath && (
                                    <div style={{ marginTop: "0.5rem", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "4px", display: "inline-block" }}>
                                        <img
                                            src={formData.signaturePath}
                                            alt="Signature Preview"
                                            style={{ maxHeight: "60px", maxWidth: "100%", display: "block" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, signaturePath: '' })}
                                            style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                        >
                                            Remove Signature
                                        </button>
                                    </div>
                                )}
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
                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", width: "500px", maxWidth: "90%", maxHeight: "90vh", overflowY: "auto" }}>
                        <h2 style={{ marginBottom: "1.5rem" }}>Edit User</h2>
                        <form onSubmit={handleUpdateUser}>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Username</label>
                                <input
                                    type="text"
                                    required
                                    minLength={2}
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
                                    disabled={editingUser.id === session?.user?.id}
                                    style={{
                                        width: "100%",
                                        padding: "0.5rem",
                                        borderRadius: "4px",
                                        border: "1px solid var(--color-border)",
                                        backgroundColor: editingUser.id === session?.user?.id ? "var(--color-background-muted)" : "var(--color-background)",
                                        cursor: editingUser.id === session?.user?.id ? "not-allowed" : "default"
                                    }}
                                >
                                    <option value="VIEWER">VIEWER (Read Only)</option>
                                    <option value="EDITOR">EDITOR (Create/Edit)</option>
                                    <option value="INSPECTOR">INSPECTOR (Approve)</option>
                                    <option value="ADMIN">ADMIN (Full Access)</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: "1.5rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Qualifications</label>
                                <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isQC}
                                            onChange={e => setFormData({ ...formData, isQC: e.target.checked })}
                                        />
                                        <span>Quality Control (QC)</span>
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isPM}
                                            onChange={e => setFormData({ ...formData, isPM: e.target.checked })}
                                        />
                                        <span>Project Manager (PM)</span>
                                    </label>
                                </div>
                            </div>

                            <div style={{ marginBottom: "1.5rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>Digital Signature</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSignatureUpload}
                                    style={{ marginBottom: "0.5rem" }}
                                />
                                {formData.signaturePath && (
                                    <div style={{ marginTop: "0.5rem", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "4px", display: "inline-block" }}>
                                        <img
                                            src={formData.signaturePath}
                                            alt="Signature Preview"
                                            style={{ maxHeight: "60px", maxWidth: "100%", display: "block" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, signaturePath: '' })}
                                            style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                        >
                                            Remove Signature
                                        </button>
                                    </div>
                                )}
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
