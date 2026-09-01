import { Stack } from 'expo-router';

// Every screen under team/ renders its own heading/back-link inside a
// SafeAreaView with layout.screenTop padding (matching the rest of the app's
// no-native-header screens) — without headerShown:false here, expo-router's
// default native header stacked on top doubled up the vertical spacing.
//
// `[id]/index` (Team Home) briefly got a native header instead, but that
// pulled in the OS's own translucent/glass header material, which isn't
// this app's chrome — its collapsing header (kicker+title → compact bar on
// scroll) is now built entirely in-component instead, so this layout stays
// uniform across every team/ screen.
export default function TeamLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
