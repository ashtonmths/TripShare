import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function TabLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");

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
					height: 68,
					paddingBottom: 7,
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
					title: "Shared",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="eye-outline" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
