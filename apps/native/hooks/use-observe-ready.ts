import { useObserve } from "expo-observe";
import { useEffect } from "react";

export function useObserveReady(ready: boolean) {
	const { markInteractive } = useObserve();
	useEffect(() => {
		if (ready) markInteractive();
	}, [markInteractive, ready]);
}
