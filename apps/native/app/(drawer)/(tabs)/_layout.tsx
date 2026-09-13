import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLoading } from "@/components/app-loading";
import { authClient } from "@/lib/auth-client";

const tabs = [
	{ name: "home", label: "Home", icon: "home" },
	{ name: "index", label: "Trips", icon: "people" },
	{ name: "two", label: "Add ride", icon: "add-circle" },
	{ name: "three", label: "Profile", icon: "person-circle" },
] as const;

type NativeTabBarProps = {
	state: { index: number; routes: Array<{ key: string; name: string }> };
	navigation: { navigate: (name: string) => void };
};

function NativeTabBar({ state, navigation }: NativeTabBarProps) {
	const foreground = useThemeColor("foreground");
	const background = useThemeColor("background");
	const insets = useSafeAreaInsets();
	return (
		<View
			style={{
				height: 68 + Math.max(insets.bottom, 10),
				paddingBottom: Math.max(insets.bottom, 10),
				backgroundColor: background,
				borderTopColor: foreground,
				borderTopWidth: 2,
				flexDirection: "row",
			}}
		>
			{state.routes.map((route, index) => {
				const item = tabs.find((tab) => tab.name === route.name);
				if (!item) return null;
				const active = state.index === index;
				return (
					<Pressable
						key={route.key}
						onPress={() => navigation.navigate(route.name)}
						accessibilityRole="tab"
						accessibilityState={{ selected: active }}
						style={{
							flex: 1,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: active ? "#c8f55a" : background,
							paddingTop: 7,
							paddingBottom: 5,
						}}
					>
						<Ionicons
							name={item.icon}
							size={25}
							color={active ? "#111" : foreground}
						/>
						<Text
							style={{
								color: active ? "#111" : foreground,
								fontFamily: "SpaceGrotesk_700Bold",
								fontSize: 12,
								marginTop: 2,
							}}
						>
							{item.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

export default function TabLayout() {
	const themeColorBackground = useThemeColor("background");
	const { data: session, isPending } = authClient.useSession();
	if (isPending) return <AppLoading />;
	if (!session) return <Redirect href="/(drawer)" />;

	return (
		<Tabs
			tabBar={(props) => <NativeTabBar {...props} />}
			screenOptions={{
				headerShown: false,
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
