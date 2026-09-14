"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { queryClient, trpc } from "@/utils/trpc";

export default function AdminPanel() {
	const overview = useQuery(trpc.admin.overview.queryOptions());
	const [version, setVersion] = useState("1.1.1");
	const [downloadUrl, setDownloadUrl] = useState("");
	const [notes, setNotes] = useState("");
	const publish = useMutation(
		trpc.admin.publishRelease.mutationOptions({
			onSuccess: async () => {
				toast.success("Android release published");
				setDownloadUrl("");
				setNotes("");
				await queryClient.invalidateQueries({
					queryKey: trpc.admin.overview.queryKey(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	if (overview.isLoading)
		return (
			<main className="app-shell">
				<div className="skeleton-block" />
			</main>
		);
	if (overview.error)
		return (
			<main className="app-shell">
				<div className="state-box">
					<h2>Admin data unavailable</h2>
					<p>{overview.error.message}</p>
				</div>
			</main>
		);
	const data = overview.data;
	return (
		<main className="app-shell admin-shell">
			<section className="dashboard-heading">
				<div>
					<p className="eyebrow">Restricted access</p>
					<h1>TripShare admin</h1>
					<p>Release management and account-owned trip visibility.</p>
				</div>
				<ShieldCheck size={38} />
			</section>
			<section className="admin-grid">
				<form
					className="admin-release-card"
					onSubmit={(event) => {
						event.preventDefault();
						publish.mutate({
							platform: "android",
							version,
							downloadUrl,
							notes: notes || undefined,
						});
					}}
				>
					<div className="section-title">
						<div>
							<p className="eyebrow">Android</p>
							<h2>Publish APK link</h2>
						</div>
						<Download />
					</div>
					<label className="field">
						<span>Version</span>
						<input
							required
							pattern="\d+\.\d+\.\d+"
							value={version}
							onChange={(event) => setVersion(event.target.value)}
						/>
					</label>
					<label className="field">
						<span>HTTPS download URL</span>
						<input
							required
							type="url"
							inputMode="url"
							placeholder="https://.../tripshare.apk"
							value={downloadUrl}
							onChange={(event) => setDownloadUrl(event.target.value)}
						/>
					</label>
					<label className="field">
						<span>Release notes (optional)</span>
						<input
							maxLength={500}
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
						/>
					</label>
					<button
						className="primary-button"
						type="submit"
						disabled={publish.isPending}
					>
						{publish.isPending ? "Publishing…" : "Publish release"}
					</button>
				</form>
				<section className="admin-release-card">
					<div className="section-title">
						<div>
							<p className="eyebrow">Release history</p>
							<h2>APK links</h2>
						</div>
					</div>
					{data?.releases.length ? (
						data.releases.map((release) => (
							<a
								className="admin-release-row"
								href={release.downloadUrl}
								target="_blank"
								rel="noreferrer"
								key={release.id}
							>
								<strong>Android {release.version}</strong>
								<small>{new Date(release.publishedAt).toLocaleString()}</small>
							</a>
						))
					) : (
						<p className="muted">No APK link published yet.</p>
					)}
				</section>
			</section>
			<section className="admin-users">
				<div className="section-title">
					<div>
						<p className="eyebrow">Accounts</p>
						<h2>Users and owned trips</h2>
					</div>
					<Users />
				</div>
				{data?.users.map((user) => {
					const trips = data.trips.filter((trip) => trip.ownerId === user.id);
					return (
						<article className="admin-user-card" key={user.id}>
							<div>
								<strong>{user.name}</strong>
								<small>{user.email}</small>
							</div>
							<span>
								{trips.length} {trips.length === 1 ? "trip" : "trips"}
							</span>
							<div className="admin-trip-list">
								{trips.length ? (
									trips.map((trip) => (
										<div key={trip.id}>
											<b>{trip.name}</b>
											<small>
												{trip.vehicleName} · {trip.fuelType} ·{" "}
												{trip.fuelDistrict}
											</small>
										</div>
									))
								) : (
									<small>No trips created.</small>
								)}
							</div>
						</article>
					);
				})}
			</section>
		</main>
	);
}
