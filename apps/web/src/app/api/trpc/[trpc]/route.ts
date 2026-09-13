import { appRouter } from "@TripShare/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { createContext } from "../../../../context";
import { env } from "../../../../env.server";

const MAX_BODY_BYTES = 128 * 1024;

async function handler(req: NextRequest) {
	if (req.method === "POST") {
		const origin = req.headers.get("origin");
		const allowedOrigins = new Set([
			new URL(env.BETTER_AUTH_URL).origin,
			"tripshare://",
		]);
		if (origin && !allowedOrigins.has(origin))
			return new Response("Forbidden", { status: 403 });
		if (!req.headers.get("content-type")?.startsWith("application/json"))
			return new Response("Unsupported media type", { status: 415 });
		const contentLength = Number(req.headers.get("content-length") ?? 0);
		if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES)
			return new Response("Request too large", { status: 413 });
		if ((await req.clone().arrayBuffer()).byteLength > MAX_BODY_BYTES)
			return new Response("Request too large", { status: 413 });
	}

	const response = await fetchRequestHandler({
		endpoint: "/api/trpc",
		req,
		router: appRouter,
		createContext: () => createContext(req),
	});
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("X-Content-Type-Options", "nosniff");
	return response;
}

export { handler as GET, handler as POST };
