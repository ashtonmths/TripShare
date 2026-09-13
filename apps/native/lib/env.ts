const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;

if (!serverUrl) {
	throw new Error(
		"EXPO_PUBLIC_SERVER_URL is missing. Add it to the selected EAS environment before publishing.",
	);
}

export const nativeEnv = {
	serverUrl: serverUrl.replace(/\/$/, ""),
} as const;
