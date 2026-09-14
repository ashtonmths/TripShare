import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import { Container } from "@/components/container";
import { useObserveReady } from "@/hooks/use-observe-ready";
import { authClient } from "@/lib/auth-client";
import { hardShadow } from "@/lib/neobrutalism";
import { queryClient } from "@/utils/trpc";

export default function Profile() {
	const { data: session, isPending } = authClient.useSession();
	useObserveReady(!isPending && Boolean(session));
	const [name, setName] = useState(session?.user.name ?? "");
	const [saving, setSaving] = useState(false);
	if (!session) return null;
	const initials = session.user.name
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return (
		<Container className="px-4 pt-4">
			<Text className="font-black text-3xl text-foreground">Profile</Text>
			<Text className="mt-1 text-muted">
				Your Google photo stays in sync automatically.
			</Text>
			<View
				className="mt-6 items-center border-2 border-foreground bg-[#8dc8ff] p-6"
				style={hardShadow}
			>
				{session.user.image ? (
					<Image
						source={{ uri: session.user.image }}
						className="h-24 w-24 rounded-full border-2 border-black"
					/>
				) : (
					<View className="h-24 w-24 items-center justify-center rounded-full border-2 border-black bg-white">
						<Text className="font-black text-3xl text-black">{initials}</Text>
					</View>
				)}
				<Text className="mt-4 font-black text-2xl text-black">
					{session.user.name}
				</Text>
				<Text className="mt-1 text-black">{session.user.email}</Text>
			</View>
			<View className="mt-6 gap-2">
				<Text className="font-black text-foreground text-sm">Display name</Text>
				<TextInput
					value={name}
					onChangeText={setName}
					className="border-2 border-foreground bg-background px-4 py-4 text-foreground"
				/>
				<Text className="text-muted text-xs">
					Your email and profile photo come from Google and cannot be changed
					here.
				</Text>
				<Pressable
					disabled={
						saving ||
						name.trim().length < 2 ||
						name.trim() === session.user.name
					}
					onPress={async () => {
						setSaving(true);
						const result = await authClient.updateUser({ name: name.trim() });
						setSaving(false);
						if (result.error)
							Alert.alert(
								"Couldn’t save",
								result.error.message ?? "Profile update failed",
							);
						else Alert.alert("Saved", "Your display name was updated.");
					}}
					className="mt-3 border-2 border-foreground bg-[#c8f55a] p-4 disabled:opacity-40"
					style={hardShadow}
				>
					<Text className="text-center font-black text-black">
						{saving ? "Saving…" : "Save profile"}
					</Text>
				</Pressable>
			</View>
			<Pressable
				onPress={async () => {
					await authClient.signOut();
					queryClient.clear();
				}}
				className="mt-8 flex-row items-center justify-center gap-2 border-2 border-foreground bg-[#ff9fb2] p-4"
			>
				<Ionicons name="log-out-outline" size={20} color="#111" />
				<Text className="font-black text-black">Sign out</Text>
			</Pressable>
		</Container>
	);
}
