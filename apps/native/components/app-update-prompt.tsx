import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Application from "expo-application";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/app-theme-context";
import { trpc } from "@/utils/trpc";

const SKIPPED_BUILD_KEY = "tripshare.skipped-build-version";

function isNewerVersion(candidate: string, current: string) {
	const candidateParts = candidate.split(".").map((part) => Number(part));
	const currentParts = current.split(".").map((part) => Number(part));
	const length = Math.max(candidateParts.length, currentParts.length, 3);

	for (let index = 0; index < length; index += 1) {
		const candidatePart = candidateParts[index] ?? 0;
		const currentPart = currentParts[index] ?? 0;
		if (candidatePart !== currentPart) return candidatePart > currentPart;
	}
	return false;
}

export function AppUpdatePrompt() {
	const insets = useSafeAreaInsets();
	const { isDark } = useAppTheme();
	const [skippedBuild, setSkippedBuild] = useState<string | null>();
	const [otaAvailable, setOtaAvailable] = useState(false);
	const [otaDismissed, setOtaDismissed] = useState(false);
	const [updating, setUpdating] = useState(false);
	const releaseQuery = useQuery({
		...trpc.releases.latest.queryOptions({ platform: "android" }),
		enabled: Platform.OS === "android",
		retry: 1,
		staleTime: 15 * 60 * 1000,
	});

	useEffect(() => {
		SecureStore.getItemAsync(SKIPPED_BUILD_KEY)
			.then(setSkippedBuild)
			.catch(() => setSkippedBuild(null));
	}, []);

	useEffect(() => {
		if (__DEV__ || !Updates.isEnabled) return;
		Updates.checkForUpdateAsync()
			.then((result) => setOtaAvailable(result.isAvailable))
			.catch(() => undefined);
	}, []);

	const buildUpdate = useMemo(() => {
		if (Platform.OS !== "android" || skippedBuild === undefined) return null;
		const release = releaseQuery.data;
		const installedVersion = Application.nativeApplicationVersion ?? "0.0.0";
		if (
			!release ||
			!isNewerVersion(release.version, installedVersion) ||
			release.version === skippedBuild
		) {
			return null;
		}
		return release;
	}, [releaseQuery.data, skippedBuild]);

	if (!buildUpdate && (!otaAvailable || otaDismissed)) return null;

	const surface = isDark ? "#111714" : "#f6f4ed";
	const foreground = isDark ? "#fffaf0" : "#111714";
	const isBuild = Boolean(buildUpdate);

	async function installOtaUpdate() {
		setUpdating(true);
		try {
			await Updates.fetchUpdateAsync();
			await Updates.reloadAsync();
		} catch {
			setUpdating(false);
			Alert.alert(
				"Update could not be installed",
				"Check your connection and try again.",
			);
		}
	}

	async function skipBuild() {
		if (!buildUpdate) return;
		setSkippedBuild(buildUpdate.version);
		await SecureStore.setItemAsync(
			SKIPPED_BUILD_KEY,
			buildUpdate.version,
		).catch(() => undefined);
	}

	return (
		<View
			pointerEvents="box-none"
			style={{
				left: 14,
				position: "absolute",
				right: 14,
				top: insets.top + 10,
				zIndex: 1000,
			}}
		>
			<View
				style={{
					backgroundColor: surface,
					borderColor: foreground,
					borderWidth: 2,
					flexDirection: "row",
					gap: 12,
					padding: 14,
					shadowColor: foreground,
					shadowOffset: { width: 4, height: 4 },
					shadowOpacity: 1,
					shadowRadius: 0,
				}}
			>
				<View style={{ flex: 1 }}>
					<Text
						style={{
							color: foreground,
							fontFamily: "SpaceGrotesk_700Bold",
							fontSize: 17,
						}}
					>
						{isBuild ? "New app build available" : "TripShare update available"}
					</Text>
					<Text
						style={{
							color: foreground,
							fontFamily: "SpaceGrotesk_400Regular",
							marginTop: 3,
						}}
					>
						{isBuild
							? `Version ${buildUpdate?.version} is ready to install.`
							: "Get the latest fixes without reinstalling the app."}
					</Text>
					<View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
						<Pressable
							disabled={updating}
							onPress={() =>
								isBuild && buildUpdate
									? Linking.openURL(buildUpdate.downloadUrl)
									: installOtaUpdate()
							}
							style={{
								alignItems: "center",
								backgroundColor: "#c8f55a",
								borderColor: foreground,
								borderWidth: 2,
								flexDirection: "row",
								gap: 6,
								paddingHorizontal: 12,
								paddingVertical: 8,
							}}
						>
							<Ionicons
								name={isBuild ? "download-outline" : "refresh"}
								size={17}
								color="#111714"
							/>
							<Text
								style={{ color: "#111714", fontFamily: "SpaceGrotesk_700Bold" }}
							>
								{updating ? "Updating…" : isBuild ? "Download" : "Update"}
							</Text>
						</Pressable>
						<Pressable
							onPress={isBuild ? skipBuild : () => setOtaDismissed(true)}
							style={{ justifyContent: "center", paddingHorizontal: 6 }}
						>
							<Text
								style={{
									color: foreground,
									fontFamily: "SpaceGrotesk_700Bold",
								}}
							>
								{isBuild ? "Skip" : "Later"}
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</View>
	);
}
