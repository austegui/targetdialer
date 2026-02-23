import { signIn } from "@/auth"

export default function LoginPage() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "48px 40px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: "700",
            marginBottom: "8px",
            color: "#111827",
          }}
        >
          TargetDialer
        </h1>
        <p
          style={{
            color: "#6b7280",
            marginBottom: "32px",
            fontSize: "0.95rem",
          }}
        >
          Meeting Intelligence for your team
        </p>

        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/meetings" })
          }}
        >
          <button
            type="submit"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
              padding: "12px 24px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "0.95rem",
              fontWeight: "500",
              color: "#374151",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.25-.164-1.84H9v3.48h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  )
}
