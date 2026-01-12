import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
    return (
        <div className="flex-center" style={{
            minHeight: "100vh",
            padding: "1rem",
            backgroundImage: "url('/bento_overview.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative"
        }}>
            {/* Dark Overlay */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                zIndex: 0
            }}></div>

            <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "center" }}>
                <LoginForm />
            </div>
        </div>
    );
}
