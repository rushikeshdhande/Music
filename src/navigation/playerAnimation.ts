import { Animated as RNAnimated } from "react-native";
import { makeMutable } from "react-native-reanimated";

export const playerExpansionProgress = new RNAnimated.Value(0);
export const playerExpansionShared = makeMutable(0);