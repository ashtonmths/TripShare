import Ionicons from "@expo/vector-icons/Ionicons";
import {
	type DrawerContentComponentProps,
	DrawerContentScrollView,
} from "expo-router/build/react-navigation/drawer";
import { Drawer } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";
import { Image, Pressable, Text, View } from "react-native";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

const destinations = [
	{ label: "Home", route: "home", icon: "home-outline" },
	{ label: "Trips", route: "index", icon: "car-outline" },
	{ label: "Add ride", route: "two", icon: "add-circle-outline" },
	{ label: "Profile", route: "three", icon: "person-circle-outline" },
] as const;

function DrawerMenu(props: DrawerContentComponentProps) {
	const background = useThemeColor("background");
	const foreground = useThemeColor("foreground");
	const muted = useThemeColor("muted");
	const { data: session } = authClient.useSession();
	const open = (screen: (typeof destinations)[number]["route"]) => {
		props.navigation.navigate("(tabs)", { screen });
		props.navigation.closeDrawer();
	};
	return (
		<DrawerContentScrollView
			{...props}
			contentContainerStyle={{ flexGrow: 1, backgroundColor: background }}
		>
			<View style={{ flex: 1, padding: 16 }}>
				<View
					style={{
						borderWidth: 2,
						borderColor: foreground,
						padding: 14,
						backgroundColor: "#8dc8ff",
					}}
				>
					{session?.user.image ? (
						<Image
							source={{ uri: session.user.image }}
							style={{
								width: 50,
								height: 50,
								borderRadius: 25,
								borderWidth: 2,
							}}
						/>
					) : (
						<Ionicons name="person-circle" size={50} color="#111" />
					)}
					<Text
						className="mt-3 font-black text-black text-lg"
						numberOfLines={2}
					>
						{session?.user.name ?? "TripShare"}
					</Text>
					{session?.user.email && (
						<Text className="mt-1 text-black text-xs" numberOfLines={2}>
							{session.user.email}
						</Text>
					)}
				</View>
				<View className="mt-5 gap-2">
					{destinations.map((item) => (
						<Pressable
							key={item.route}
							onPress={() => open(item.route)}
							style={{
								borderWidth: 2,
								borderColor: foreground,
								backgroundColor: background,
								padding: 13,
								flexDirection: "row",
								alignItems: "center",
								gap: 11,
							}}
						>
							<Ionicons name={item.icon} size={21} color={foreground} />
							<Text
								style={{
									color: foreground,
									fontFamily: "SpaceGrotesk_700Bold",
								}}
							>
								{item.label}
							</Text>
						</Pressable>
					))}
				</View>
				<View className="mt-5 flex-row items-center justify-between">
					<Text
						style={{ color: foreground, fontFamily: "SpaceGrotesk_700Bold" }}
					>
						Appearance
					</Text>
					<ThemeToggle />
				</View>
				<View style={{ flex: 1 }} />
				<Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>
					Your trip data stays private to its members.
				</Text>
				<Pressable
					onPress={async () => {
						await authClient.signOut();
						queryClient.clear();
						props.navigation.closeDrawer();
					}}
					className="flex-row items-center justify-center gap-2 border-2 border-black bg-[#ff9fb2] p-3"
				>
					<Ionicons name="log-out-outline" size={20} color="#111" />
					<Text className="font-black text-black">Sign out</Text>
				</Pressable>
			</View>
		</DrawerContentScrollView>
	);
}

export default function AppLayout() {
	const background = useThemeColor("background");
	const foreground = useThemeColor("foreground");
	return (
		<Drawer
			drawerContent={(props) => <DrawerMenu {...props} />}
			screenOptions={{
				drawerStyle: { width: "60%", backgroundColor: background },
				headerStyle: { backgroundColor: background },
				headerTintColor: foreground,
				headerTitleStyle: { fontFamily: "SpaceGrotesk_700Bold" },
				headerShadowVisible: false,
				overlayColor: "rgba(0,0,0,0.55)",
			}}
		>
			<Drawer.Screen
				name="index"
				options={{ headerShown: false, drawerItemStyle: { display: "none" } }}
			/>
			<Drawer.Screen
				name="(tabs)"
				options={{
					title: "TripShare",
					drawerLabel: "Home",
					headerRight: () => (
						<View className="mr-2">
							<ThemeToggle />
						</View>
					),
				}}
			/>
		</Drawer>
	);
}
