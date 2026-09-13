import Image from "next/image";

export default function Loader() {
	return (
		<div className="app-loader" role="status" aria-live="polite">
			<div className="app-loader-mark">
				<Image
					src="/favicon/web-app-manifest-192x192.png"
					alt=""
					width={86}
					height={86}
					priority
				/>
			</div>
			<strong>TripShare</strong>
			<div className="app-loader-track" aria-hidden="true">
				<span />
			</div>
			<p>Getting your rides ready</p>
		</div>
	);
}
