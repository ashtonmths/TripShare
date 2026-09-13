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
				headerStyle: {
					backgroundColor: themeColorBackground,
				},
				headerTintColor: themeColorForeground,
				headerTitleStyle: {
					color: themeColorForeground,
					fontWeight: "600",
				},
				tabBarStyle: {
					backgroundColor: themeColorBackground,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Groups",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="people" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="two"
				options={{
					title: "Add journey",
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
