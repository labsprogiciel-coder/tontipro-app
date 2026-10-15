import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="login" />
      <Stack.Screen name="set-pin" />
      <Stack.Screen name="reg" />
      <Stack.Screen name="bind-device" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
