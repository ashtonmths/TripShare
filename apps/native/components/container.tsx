import { cn } from "heroui-native";
import type { PropsWithChildren } from "react";
import {
	ScrollView,
	type ScrollViewProps,
	View,
	type ViewProps,
} from "react-native";
import Animated, { type AnimatedProps } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedView = Animated.createAnimatedComponent(View);

type Props = AnimatedProps<ViewProps> & {
	className?: string;
	isScrollable?: boolean;
	safeTop?: boolean;
	scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle">;
};

export function Container({
	children,
	className,
	isScrollable = true,
	safeTop = false,
	scrollViewProps,
	...props
}: PropsWithChildren<Props>) {
	const insets = useSafeAreaInsets();

	return (
		<AnimatedView
			className={cn("flex-1 bg-background", className)}
			style={{
				...(safeTop ? { paddingTop: insets.top + 24 } : {}),
				paddingBottom: insets.bottom,
			}}
			{...props}
		>
			{isScrollable ? (
				<ScrollView
					contentContainerStyle={{ flexGrow: 1 }}
					keyboardShouldPersistTaps="handled"
					contentInsetAdjustmentBehavior="automatic"
					{...scrollViewProps}
				>
					{children}
				</ScrollView>
			) : (
				<View className="flex-1">{children}</View>
			)}
		</AnimatedView>
	);
}
