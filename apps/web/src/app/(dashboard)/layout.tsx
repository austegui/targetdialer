import { redirect } from "next/navigation"
import { auth, signOut } from "@/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const { user } = session

  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Top navigation */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: "60px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {/* Left: Brand + nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <span style={{ fontWeight: "700", fontSize: "1.1rem", color: "#111827" }}>
            TargetDialer
          </span>
          <a
            href="/meetings"
            style={{
              color: "#374151",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            Meetings
          </a>
          {user.role === "admin" && (
            <a
              href="/settings/team"
              style={{
                color: "#374151",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Team Settings
            </a>
          )}
        </div>

        {/* Right: User info + sign out */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {user.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.image}
              alt={user.name ?? "User avatar"}
              width={32}
              height={32}
              style={{ borderRadius: "50%" }}
            />
          )}
          <div style={{ fontSize: "0.875rem" }}>
            <div style={{ fontWeight: "500", color: "#111827" }}>
              {user.name}
            </div>
            <div style={{ color: "#6b7280" }}>{user.email}</div>
          </div>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: "500",
              background: user.role === "admin" ? "#dbeafe" : "#f3f4f6",
              color: user.role === "admin" ? "#1d4ed8" : "#374151",
            }}
          >
            {user.role}
          </span>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              style={{
                padding: "6px 14px",
                background: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                color: "#374151",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ padding: "32px 24px" }}>{children}</main>
    </div>
  )
}
