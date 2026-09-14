"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { trpc } from "@/utils/trpc";

export function DownloadAppLink({ mobile = false }: { mobile?: boolean }) {
	const release = useQuery({
		...trpc.releases.latest.queryOptions({ platform: "android" }),
		staleTime: 15 * 60 * 1000,
	});

	if (!release.data) {
		return (
			<button
				className={mobile ? "mobile-download-link" : "header-download-link"}
				type="button"
				disabled
				title="The APK link has not been published yet"
			>
				<Download size={17} aria-hidden="true" />
				<span>Download APK</span>
			</button>
		);
	}

	return (
		<a
			className={mobile ? "mobile-download-link" : "header-download-link"}
			href={release.data.downloadUrl}
			target="_blank"
			rel="noreferrer"
			download
		>
			<Download size={17} aria-hidden="true" />
			<span>Download APK</span>
		</a>
	);
}
