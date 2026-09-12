import {
	ArrowRight,
	Fuel,
	ReceiptIndianRupee,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
	return (
		<main className="landing">
			<section className="hero">
				<p className="eyebrow">Built for the people in your car</p>
				<h1>
					Shared rides.
					<br />
					Fair fuel splits.
				</h1>
				<p>
					TripShare keeps a private record of every journey, live Udupi petrol
					prices, and what each person still owes.
				</p>
				<div className="hero-actions">
					<Link className="primary-button" href="/dashboard">
						Open your ledger <ArrowRight size={17} />
					</Link>
					<Link href="/login">Create an account</Link>
				</div>
			</section>
			<section className="feature-strip">
				<article>
					<Fuel />
					<h2>Price at the pump</h2>
					<p>
						Capture the current Udupi petrol price or enter it manually when the
						service is unavailable.
					</p>
				</article>
				<article>
					<ReceiptIndianRupee />
					<h2>Exact, lasting splits</h2>
					<p>
						Every ride stores its price and per-person share, so history never
						shifts underneath you.
					</p>
				</article>
				<article>
					<ShieldCheck />
					<h2>Private by design</h2>
					<p>
						Your passengers are contacts, not users. Only you sign in and manage
						the ledger.
					</p>
				</article>
			</section>
		</main>
	);
}
