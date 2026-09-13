import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { authClient } from "@/lib/auth-client";
import { hardShadow } from "@/lib/neobrutalism";

function SignIn() {
	const [pending, setPending] = useState(false);
	return (
		<View
			className="border-2 border-foreground bg-[#8dc8ff] p-5"
			style={hardShadow}
		>
			<Text className="font-black text-foreground text-xl">Secure sign in</Text>
			<Text className="mt-2 mb-5 text-foreground">
				Use the Google email an owner added to view a shared trip.
			</Text>
			<Pressable
				disabled={pending}
				className="border-2 border-black bg-white p-4 disabled:opacity-50"
				onPress={async () => {
					setPending(true);
					const result = await authClient.signIn.social({
						provider: "google",
						callbackURL: "/",
					});
					if (result.error)
						Alert.alert(
							"Couldn’t sign in",
							result.error.message ?? "Google sign-in could not start",
						);
					setPending(false);
				}}
			>
				<Text className="text-center font-black text-black">
					{pending ? "Opening Google…" : "Continue with Google"}
				</Text>
			</Pressable>
		</View>
	);
}

export { SignIn };
