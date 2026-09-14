"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export function HomeActions() {
	const { data: session, isPending } = authClient.useSession();
	const release = useQuery(
		trpc.releases.latest.queryOptions({ platform: "android" }),
	);
	const [device, setDevice] = useState<"android" | "ios" | "other">("other");
	useEffect(() => {
		const agent = navigator.userAgent.toLowerCase();
		setDevice(
			agent.includes("android")
				? "android"
				: /iphone|ipad|ipod/.test(agent)
					? "ios"
					: "other",
		);
	}, []);
	return (
		<div className="hero-actions">
			<Link className="primary-button" href="/dashboard">
				Open your ledger <ArrowRight size={17} />
			</Link>
			{!isPending && !session && <Link href="/login">Sign in with Google</Link>}
			{device === "ios" ? (
				<button className="download-button" type="button" disabled>
					iOS coming soon
				</button>
			) : release.data ? (
				<a
					className="download-button"
					href={release.data.downloadUrl}
					target="_blank"
					rel="noreferrer"
				>
					<Download size={17} />{" "}
					{device === "android" ? "Download APK" : "Download app"}
				</a>
			) : null}
		</div>
	);
}
