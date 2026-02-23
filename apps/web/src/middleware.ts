// Next.js 15.x middleware — uses Auth.js v5 for session-based route protection
// Note: Next.js 16 will rename this to proxy.ts (see src/proxy.ts)
export { auth as middleware } from "@/auth"

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
}
