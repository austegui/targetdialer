export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>TargetDialer &mdash; Meeting Intelligence</h1>
      <p style={{ color: "#666" }}>
        AI-powered meeting transcription and summarization
      </p>
      <p style={{ color: "#999", fontSize: "0.875rem", marginTop: "2rem" }}>
        Foundation scaffold — Phase 1 in progress
      </p>
    </main>
  )
}
