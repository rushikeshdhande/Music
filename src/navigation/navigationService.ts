// src/navigation/navigationService.ts
//
// One shared navigation ref, so components that live OUTSIDE the tab stacks
// (like the MiniPlayer, which is mounted in <Tabs/>) can still open screens
// that live INSIDE the Home / Library stacks.
import {
  createNavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

/** Name of the tab that is currently visible ("Home" | "Library"). */
function getActiveTabName(): "Home" | "Library" {
  try {
    const root: any = navigationRef.getRootState();
    const tabsRoute = root?.routes?.find((r: any) => r.name === "Tabs");
    const tabState: any = tabsRoute?.state;
    const name = tabState?.routes?.[tabState?.index ?? 0]?.name;
    if (name === "Library") return "Library";
  } catch {
    // fall through
  }
  return "Home";
}

/**
 * Open the album details page inside the active tab's stack.
 * Returns false when navigation is not ready yet.
 */
export function openAlbumDetails(params: {
  albumName: string;
  songIds: any[];
}): boolean {
  if (!navigationRef.isReady()) return false;

  const tab = getActiveTabName();

  navigationRef.dispatch(
    CommonActions.navigate({
      name: "Tabs",
      params: {
        screen: tab,
        params: { screen: "AlbumDetails", params },
      },
    }),
  );
  return true;
}