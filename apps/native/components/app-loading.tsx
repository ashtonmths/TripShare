import { Image, Text, View } from "react-native";

export function AppLoading() {
	return (
		<View className="flex-1 items-center justify-center bg-background px-8">
			<View className="h-24 w-24 items-center justify-center border-2 border-foreground bg-[#c8f55a]">
				<Image
					source={require("../assets/images/tripshare-mark.png")}
					resizeMode="contain"
					className="h-20 w-20"
				/>
			</View>
			<Text className="mt-5 font-black text-3xl text-foreground">
				TripShare
			</Text>
			<View className="mt-5 h-2 w-28 overflow-hidden border border-foreground bg-background">
				<View className="h-full w-2/3 bg-[#c8f55a]" />
			</View>
			<Text className="mt-3 text-muted text-sm">Getting your rides ready</Text>
		</View>
	);
}
