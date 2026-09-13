import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
	interpolateColor,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "@/contexts/app-theme-context";

export function ThemeToggle() {
	const { toggleTheme, isLight } = useAppTheme();
	const progress = useSharedValue(isLight ? 0 : 1);

	useEffect(() => {
		progress.value = withTiming(isLight ? 0 : 1, { duration: 280 });
	}, [isLight, progress]);

	const trackStyle = useAnimatedStyle(() => ({
		backgroundColor: interpolateColor(
			progress.value,
			[0, 1],
			["#8dc8ff", "#26314d"],
		),
	}));
	const thumbStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: progress.value * 24 }],
	}));

	return (
		<Pressable
			onPress={() => {
				if (Platform.OS === "ios") {
					Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
				}
				toggleTheme();
			}}
			accessibilityRole="switch"
			accessibilityLabel="Toggle color theme"
			accessibilityState={{ checked: !isLight }}
			style={styles.pressable}
		>
			<Animated.View style={[styles.track, trackStyle]}>
				<View style={styles.icons}>
					<Ionicons name="sunny" size={13} color="#171717" />
					<Ionicons name="moon" size={12} color="#fffaf0" />
				</View>
				<Animated.View style={[styles.thumb, thumbStyle]} />
			</Animated.View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	pressable: { paddingHorizontal: 10, paddingVertical: 5 },
	track: {
		width: 54,
		height: 30,
		borderWidth: 2,
		borderColor: "#171717",
		padding: 3,
		justifyContent: "center",
	},
	icons: {
		position: "absolute",
		left: 7,
		right: 7,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	thumb: {
		width: 20,
		height: 20,
		borderWidth: 2,
		borderColor: "#171717",
		backgroundColor: "#fffaf0",
	},
});
