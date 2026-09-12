"use client";

import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function GoogleAuthButton() {
	const [pending, setPending] = useState(false);
	return (
		<button
			type="button"
			className="oauth-button"
			disabled={pending}
			onClick={async () => {
				setPending(true);
				const result = await authClient.signIn.social({
					provider: "google",
					callbackURL: "/dashboard",
				});
				if (result.error) {
					toast.error(result.error.message ?? "Google sign-in could not start");
					setPending(false);
				}
			}}
		>
			<span className="google-mark" aria-hidden="true">
				G
			</span>
			{pending ? "Opening Google…" : "Continue with Google"}
		</button>
	);
}
