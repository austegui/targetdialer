import { auth } from "@/auth"

export default async function MeetingsPage() {
  const session = await auth()

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "700",
            color: "#111827",
            margin: 0,
          }}
        >
          Meetings
        </h1>
        <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          Signed in as {session?.user?.email}
        </span>
      </div>

      {/* Placeholder empty state */}
      <div
        style={{
          textAlign: "center",
          padding: "64px 24px",
          background: "#fff",
          borderRadius: "12px",
          border: "1px dashed #d1d5db",
        }}
      >
        <p
          style={{
            color: "#6b7280",
            fontSize: "1rem",
            marginBottom: "8px",
          }}
        >
          No meetings yet
        </p>
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          Meetings will appear here once the Calendar Watcher is configured.
        </p>
      </div>
    </div>
  )
}
