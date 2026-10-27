import { Pressable, StyleSheet, Text, View } from "react-native";
import { KAURIDORR_THEME } from "@/constants/colors";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

const KEYS = [
  { digit: "1" },
  { digit: "2" },
  { digit: "3" },
  { digit: "4" },
  { digit: "5" },
  { digit: "6" },
  { digit: "7" },
  { digit: "8" },
  { digit: "9" },
  { digit: "" }, // empty slot
  { digit: "0" },
  { digit: "⌫" },
];

interface NumpadProps {
  onPress: (digit: string) => void;
  onDelete: () => void;
  /** Accent color for press feedback. Defaults to orange. */
  accentColor?: string;
}

export function Numpad({
  onPress,
  onDelete,
  accentColor = T.orange,
}: NumpadProps) {
  const handleKey = (digit: string) => {
    if (digit === "⌫") onDelete();
    else if (digit) onPress(digit);
  };

  const rows: (typeof KEYS)[] = [];
  for (let i = 0; i < KEYS.length; i += 3) rows.push(KEYS.slice(i, i + 3));

  return (
    <View style={styles.numpad}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map(({ digit }, ci) => {
            if (!digit)
              return (
                <View
                  key={ci}
                  style={styles.empty}
                  importantForAccessibility="no"
                />
              );
            return (
              <Pressable
                key={ci}
                onPress={() => handleKey(digit)}
                accessibilityRole="button"
                accessibilityLabel={digit === "⌫" ? "Effacer" : digit}
                style={({ pressed }) => [
                  styles.key,
                  pressed && {
                    backgroundColor: accentColor + "22",
                    borderColor: accentColor,
                  },
                ]}
              >
                <Text style={digit === "⌫" ? styles.delete : styles.digit}>
                  {digit}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  numpad: {
    flexDirection: "column",
    alignSelf: "stretch",
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.lg,
    gap: SPACE.sm,
  },
  row: {
    flexDirection: "row",
    gap: SPACE.sm,
  },
  key: {
    flex: 1,
    height: 52,
    borderRadius: 13,
    backgroundColor: T.bg2,
    borderWidth: 0.5,
    borderColor: T.border,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: { flex: 1, height: 52, backgroundColor: "transparent" },
  digit: { fontSize: 20, fontWeight: "500", color: T.text1 },
  delete: { fontSize: 18, color: T.text2 },
});

export default Numpad;
