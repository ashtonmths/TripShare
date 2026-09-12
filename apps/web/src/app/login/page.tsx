"use client";

import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginPage() {
	const [showSignIn, setShowSignIn] = useState(false);

	return (
		<main className="auth-page">
			<div className="auth-side">
				<span className="auth-badge">Private by default</span>
				<h2>One owner. Every ride. Nothing awkward.</h2>
				<p>Keep fuel splits factual, payments visible, and your passengers out of another app signup.</p>
			</div>
			{showSignIn ? (
				<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
			) : (
				<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
			)}
		</main>
	);
}
