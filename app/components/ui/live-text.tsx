// app/components/ui/live-text.tsx
//
// Text a screen reader reads out when it appears or changes (errors, status
// messages), without moving focus. Android follows the live region; iOS has
// none, so the message is announced explicitly.
import { useEffect } from "react";
import { AccessibilityInfo, Platform, Text, TextProps } from "react-native";

export function LiveText({ children, ...props }: TextProps & { children: string }) {
  useEffect(() => {
    if (Platform.OS === "ios" && children) {
      AccessibilityInfo.announceForAccessibility(children);
    }
  }, [children]);

  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" {...props}>
      {children}
    </Text>
  );
}

export default LiveText;
