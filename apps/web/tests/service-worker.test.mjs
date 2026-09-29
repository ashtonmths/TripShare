import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const listeners = new Map();
const source = readFileSync(
	new URL("../public/sw.js", import.meta.url),
	"utf8",
);
runInNewContext(source, {
	self: { addEventListener: (name, callback) => listeners.set(name, callback) },
	URL,
	fetch: () => Promise.resolve({}),
});

function handled(url) {
	let response;
	listeners.get("fetch")({
		request: { mode: "navigate", method: "GET", url },
		respondWith: (value) => {
			response = value;
		},
	});
	if (response) response.catch(() => {});
	return response !== undefined;
}

test("OAuth and other API navigations bypass the offline fallback", () => {
	assert.equal(
		handled("https://tripshare.ashtonmths.dev/api/auth/callback/google"),
		false,
	);
	assert.equal(
		handled(
			"https://tripshare.ashtonmths.dev/api/auth/expo-authorization-proxy",
		),
		false,
	);
	assert.equal(
		handled("https://tripshare.ashtonmths.dev/api/trpc/healthCheck"),
		false,
	);
});

test("website pages still receive the offline fallback", () => {
	assert.equal(handled("https://tripshare.ashtonmths.dev/dashboard"), true);
});
