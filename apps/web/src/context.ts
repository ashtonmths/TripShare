import type { Context as ApiContext } from "@TripShare/api/context";
import type { NextRequest } from "next/server";
import { env } from "./env.server";
import { auth, getDb } from "./services";

export async function createContext(req: NextRequest): Promise<ApiContext> {
	const db = await getDb();
	const session = await auth.api.getSession({
		headers: req.headers,
	});
	return {
		adminEmails: (env.ADMIN_EMAILS ?? "")
			.split(",")
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean),
		db,
		auth: null,
		clientIp:
			req.headers.get("x-real-ip") ??
			req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
			"unknown",
		fuelQuoteSecret: env.BETTER_AUTH_SECRET,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
