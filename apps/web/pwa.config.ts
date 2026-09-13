import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = `
	default-src 'self';
	script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
	style-src 'self' 'unsafe-inline';
	img-src 'self' blob: data:;
	font-src 'self' data:;
	connect-src 'self';
	worker-src 'self' blob:;
	manifest-src 'self';
	object-src 'none';
	base-uri 'self';
	form-action 'self';
	frame-ancestors 'none';
	upgrade-insecure-requests;
`
	.replace(/\s{2,}/g, " ")
	.trim();

const securityHeaders = [
	{ key: "Content-Security-Policy", value: contentSecurityPolicy },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
	{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
];

export function withPwa(config: NextConfig): NextConfig {
	// Static exports need these headers configured at the hosting layer.
	if (config.output === "export") return config;
	return {
		...config,
		async headers() {
			return [
				...((await config.headers?.()) ?? []),
				{
					source: "/(.*)",
					headers: securityHeaders,
				},
				{
					source: "/sw.js",
					headers: [
						{
							key: "Content-Type",
							value: "application/javascript; charset=utf-8",
						},
						{
							key: "Cache-Control",
							value: "no-cache, no-store, must-revalidate",
						},
						{
							key: "Content-Security-Policy",
							value: "default-src 'self'; script-src 'self'",
						},
					],
				},
			];
		},
	};
}
