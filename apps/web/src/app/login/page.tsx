import { GoogleAuthButton } from "@/components/google-auth-button";

export default function LoginPage() {
	return (
		<main className="auth-page">
			<div className="auth-side">
				<span className="auth-badge">Private by default</span>
				<h2>One ledger. Clear costs. No awkward chasing.</h2>
				<p>
					Manage your carpool or securely view trips shared with your email.
				</p>
			</div>
			<div className="auth-card">
				<p className="auth-kicker">Secure access</p>
				<h1>Continue to TripShare</h1>
				<p className="auth-intro">
					Sign in with Google. No passwords are stored by TripShare.
				</p>
				<GoogleAuthButton />
			</div>
		</main>
	);
}
