import "@/global.css";
import {
	SpaceGrotesk_400Regular,
	SpaceGrotesk_700Bold,
	useFonts,
} from "@expo-google-fonts/space-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import { Observe, ObserveRoot } from "expo-observe";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AppLoading } from "@/components/app-loading";
import { AppUpdatePrompt } from "@/components/app-update-prompt";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { queryClient } from "@/utils/trpc";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

Observe.configure({
	integrations: {
		"expo-router": {
			filteredParams: [
				"id",
				"groupId",
				"personId",
				"journeyId",
				"correctionId",
				"claimId",
				"email",
			],
		},
	},
});

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

function RootLayout() {
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
							<View style={{ flex: 1 }}>
								<StackLayout />
								<AppUpdatePrompt />
							</View>
						</HeroUINativeProvider>
					</AppThemeProvider>
				</KeyboardProvider>
			</GestureHandlerRootView>
		</QueryClientProvider>
	);
}

function ObserveFallback({ resetError }: { resetError: () => void }) {
	return (
		<View className="flex-1 items-center justify-center bg-[#111714] px-7">
			<Text className="text-center font-black text-3xl text-white">
				TripShare hit a problem
			</Text>
			<Text className="mt-3 text-center text-[#d7d7d7]">
				The error was recorded. Try opening the app again.
			</Text>
			<Pressable
				onPress={resetError}
				className="mt-6 border-2 border-white bg-[#c8f55a] px-6 py-4"
			>
				<Text className="font-black text-black">Try again</Text>
			</Pressable>
		</View>
	);
}

export default function ObservedRootLayout() {
	return (
		<ObserveRoot
			errorBoundaryFallback={({ resetError }) => (
				<ObserveFallback resetError={resetError} />
			)}
		>
			<RootLayout />
		</ObserveRoot>
	);
}
