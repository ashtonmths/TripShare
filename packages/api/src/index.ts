import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const rateLimit = t.middleware(({ ctx, path, type, next }) => {
	const now = Date.now();
	const key = `${ctx.session?.user.id ?? ctx.clientIp}:${path}`;
	const limit = path === "fuel.current" ? 10 : type === "mutation" ? 30 : 120;
	const current = rateBuckets.get(key);
	if (!current || current.resetAt <= now) {
		rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
	} else {
		current.count += 1;
		if (current.count > limit)
			throw new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: "Too many requests. Try again shortly.",
			});
	}
	if (rateBuckets.size > 10_000) {
		for (const [bucketKey, bucket] of rateBuckets) {
			if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
		}
	}
	return next();
});

export const publicProcedure = t.procedure.use(rateLimit);

export const protectedProcedure = t.procedure
	.use(rateLimit)
	.use(({ ctx, next }) => {
		if (!ctx.session) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "Authentication required",
			});
		}
		return next({
			ctx: {
				...ctx,
				session: ctx.session,
			},
		});
	});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	const email = ctx.session.user.email.trim().toLowerCase();
	if (!ctx.adminEmails.includes(email)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Administrator access required",
		});
	}
	return next({ ctx });
});
