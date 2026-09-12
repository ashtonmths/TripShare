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
		db,
		auth: null,
		indianApiKey: env.INDIAN_API_KEY || undefined,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
