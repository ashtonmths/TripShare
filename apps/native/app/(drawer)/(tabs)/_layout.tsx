import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth-client";

export default function TabLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");
	const insets = useSafeAreaInsets();
	const { data: session, isPending } = authClient.useSession();
	if (isPending) return null;
	if (!session) return <Redirect href="/(drawer)" />;

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: "#111111",
				tabBarInactiveTintColor: themeColorForeground,
				tabBarLabelStyle: { fontSize: 12, fontWeight: "800", marginTop: 2 },
				tabBarItemStyle: { paddingVertical: 6 },
				tabBarStyle: {
					backgroundColor: themeColorBackground,
					borderTopColor: themeColorForeground,
					borderTopWidth: 2,
					height: 62 + insets.bottom,
					paddingBottom: Math.max(insets.bottom, 7),
				},
				tabBarActiveBackgroundColor: "#c8f55a",
				tabBarIconStyle: { marginBottom: 0 },
				tabBarLabelPosition: "below-icon",
				tabBarHideOnKeyboard: true,
				sceneStyle: {
					backgroundColor: themeColorBackground,
				},
			}}
		>
			<Tabs.Screen
				name="home"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="home" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="index"
				options={{
					title: "Trips",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="people" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="two"
				options={{
					title: "Add ride",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="add-circle" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="three"
				options={{
					title: "Profile",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="person-circle" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
