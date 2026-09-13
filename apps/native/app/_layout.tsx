import "@/global.css";
import {
	SpaceGrotesk_400Regular,
	SpaceGrotesk_700Bold,
	useFonts,
} from "@expo-google-fonts/space-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AppLoading } from "@/components/app-loading";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { queryClient } from "@/utils/trpc";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
	initialRouteName: "(drawer)",
};

function StackLayout() {
	return (
		<Stack screenOptions={{}}>
			<Stack.Screen name="(drawer)" options={{ headerShown: false }} />
		</Stack>
	);
}

export default function Layout() {
	const [fontsLoaded] = useFonts({
		SpaceGrotesk_400Regular,
		SpaceGrotesk_700Bold,
	});
	useEffect(() => {
		if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
	}, [fontsLoaded]);
	if (!fontsLoaded) return <AppLoading />;
	return (
		<QueryClientProvider client={queryClient}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<KeyboardProvider>
					<AppThemeProvider>
						<HeroUINativeProvider>
							<StackLayout />
						</HeroUINativeProvider>
					</AppThemeProvider>
				</KeyboardProvider>
			</GestureHandlerRootView>
		</QueryClientProvider>
	);
}
