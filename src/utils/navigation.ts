import type { NavigationProp } from "@react-navigation/native";

/**
 * Safe back navigation — only calls goBack() if there is actually a screen
 * to go back to. Prevents the "POP was not handled" dev warning when a
 * screen is the root of the stack.
 */
export const safeGoBack = (nav: NavigationProp<any> | any) => {
  try {
    if (nav?.canGoBack && nav.canGoBack()) {
      nav.goBack();
    }
  } catch (e) {
    console.log("[safeGoBack] error:", e);
  }
};