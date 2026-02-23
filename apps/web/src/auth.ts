import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/lib/db"
import { eq } from "drizzle-orm"
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  authenticators,
  tdUsers,
} from "@/lib/db/schema"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: {
    strategy: "database",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Attach Auth.js user.id to the session
      if (session.user) {
        session.user.id = user.id

        // Fetch role from td_users and attach it
        const tdUser = await db
          .select({ role: tdUsers.role })
          .from(tdUsers)
          .where(eq(tdUsers.authUserId, user.id))
          .limit(1)

        session.user.role = tdUser[0]?.role ?? "member"
      }
      return session
    },
    async signIn({ user }) {
      if (!user.id) return true

      // Create td_users row if one doesn't exist for this auth user
      const existing = await db
        .select({ id: tdUsers.id })
        .from(tdUsers)
        .where(eq(tdUsers.authUserId, user.id))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(tdUsers).values({
          authUserId: user.id,
          role: "member",
        })
      }

      return true
    },
  },
})

// Extend the Session type to include role
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: "admin" | "member"
    }
  }
}
