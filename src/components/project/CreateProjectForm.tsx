"use client";

import { useFormStatus, useFormState } from "react-dom";
import { createProject, ProjectState } from "@/actions/project";
import { useEffect, useState } from "react";

const initialState: ProjectState = {
    message: "",
    error: "",
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Creating..." : "Create Project"}
        </button>
    );
}

export default function CreateProjectForm() {
    const [state, formAction] = useFormState(createProject, initialState);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (state.message) {
            setIsOpen(false);
            // We could also reset the form here if we had a ref to it
        }
    }, [state.message]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="btn btn-primary"
            >
                + New Project
            </button>
        );
    }

    return (
        <div className="glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-md)", marginBottom: "2rem" }}>
            <div className="flex-center" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
                <h3>Create New Project</h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="btn btn-outline"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                >
                    Cancel
                </button>
            </div>

            <form action={formAction} className="flex-col gap-md">
                {state.error && (
                    <div style={{ color: "var(--color-danger)", padding: "0.5rem", background: "rgba(255,0,0,0.1)", borderRadius: "var(--radius-sm)" }}>
                        {state.error}
                    </div>
                )}

                <div className="flex-col gap-sm">
                    <label htmlFor="title" style={{ fontSize: "0.9rem", fontWeight: 500 }}>Project Title</label>
                    <input
                        id="title"
                        name="title"
                        type="text"
                        required
                        placeholder="e.g. Website Redesign"
                        className="input-field"
                        style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                    />
                </div>

                <div className="flex-col gap-sm">
                    <label htmlFor="codePrefix" style={{ fontSize: "0.9rem", fontWeight: 500 }}>Code Prefix (Uppercase, ID for items)</label>
                    <input
                        id="codePrefix"
                        name="codePrefix"
                        type="text"
                        required
                        pattern="[A-Z0-9]+"
                        placeholder="e.g. WEB, Q4"
                        className="input-field"
                        style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                    />
                </div>

                <div className="flex-col gap-sm">
                    <label htmlFor="description" style={{ fontSize: "0.9rem", fontWeight: 500 }}>Description</label>
                    <textarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="Brief description of the project..."
                        style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontFamily: "inherit" }}
                    />
                </div>

                <div style={{ alignSelf: "flex-end" }}>
                    <SubmitButton />
                </div>
            </form>
        </div>
    );
}
