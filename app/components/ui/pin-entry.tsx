// app/components/ui/pin-entry.tsx
//
// Code / PIN entry with the app's own numpad instead of the system keyboard:
// same look on every device, no autofill/keyboard switching, no hidden
// TextInput focus juggling. Used for unlock codes, first-login codes,
// password changes and device PINs.
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { KAURIDORR_THEME } from "@/constants/colors";
import { Numpad } from "./numpad";

import { SPACE } from "@/constants/spacing";
const T = KAURIDORR_THEME;

interface PinCellsProps {
  length: number;
  value: string;
  /** Dots instead of digits. */
  masked?: boolean;
  /** Error styling; the row shakes each time this becomes truthy. */
  error?: boolean | string | null;
  /** Highlight the next cell to fill (the pad is "focused" on this field). */
  active?: boolean;
  /** Makes the row tappable, e.g. to show the pad for this field. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** The row of digit cells, without the pad. */
export function PinCells({
  length,
  value,
  masked = true,
  error,
  active = true,
  onPress,
  accessibilityLabel = "Code",
}: PinCellsProps) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {},
    );
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((toValue) =>
        Animated.timing(shake, {
          toValue,
          duration: 45,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [error, shake]);

  const cells = (
    <Animated.View
      style={[styles.row, { transform: [{ translateX: shake }] }]}
      accessible
      accessibilityLabel={`${accessibilityLabel}, ${value.length} chiffre${value.length > 1 ? "s" : ""} sur ${length}`}
    >
      {Array.from({ length }, (_, i) => {
        const digit = value[i];
        const isNext = active && i === value.length;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              length > 4 && styles.cellCompact,
              digit !== undefined && styles.cellFilled,
              isNext && styles.cellNext,
              !!error && styles.cellError,
            ]}
          >
            {digit !== undefined &&
              (masked ? (
                <View style={styles.dot} />
              ) : (
                <Text style={styles.digit}>{digit}</Text>
              ))}
          </View>
        );
      })}
    </Animated.View>
  );

  return onPress ? (
    <Pressable onPress={onPress} hitSlop={8}>
      {cells}
    </Pressable>
  ) : (
    cells
  );
}

interface PinPadProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Called once the last digit is entered (auto-submit). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
}

/** Just the numpad, bound to a code value — for forms that place it apart from the cells. */
export function PinPad({
  length,
  value,
  onChange,
  onComplete,
  disabled = false,
}: PinPadProps) {
  // Keys can be tapped faster than the parent re-renders with the new
  // `value`; building on the prop would drop digits. Track the latest value
  // ourselves and resync whenever the parent changes it (e.g. clears it).
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const press = (digit: string) => {
    const current = latest.current;
    if (disabled || current.length >= length) return;
    Haptics.selectionAsync().catch(() => {});
    const next = current + digit;
    latest.current = next;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const remove = () => {
    const current = latest.current;
    if (disabled || current.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    const next = current.slice(0, -1);
    latest.current = next;
    onChange(next);
  };

  return (
    <View
      style={[styles.pad, disabled && styles.padDisabled]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <Numpad onPress={press} onDelete={remove} />
    </View>
  );
}

interface PinEntryProps extends Omit<PinCellsProps, "onPress">, PinPadProps {
  /** Hide the pad (e.g. while another field of the form is being edited). */
  showPad?: boolean;
  onCellsPress?: () => void;
}

/** Cells + numpad. The parent owns `value`, so it can clear it after an error. */
export function PinEntry({
  length,
  value,
  onChange,
  onComplete,
  disabled = false,
  showPad = true,
  onCellsPress,
  ...cellProps
}: PinEntryProps) {
  return (
    <View style={styles.entry}>
      <PinCells
        length={length}
        value={value}
        active={showPad && !disabled}
        onPress={onCellsPress}
        {...cellProps}
      />
      {showPad && (
        <PinPad
          length={length}
          value={value}
          onChange={onChange}
          onComplete={onComplete}
          disabled={disabled}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { alignSelf: "stretch", alignItems: "center", gap: SPACE.xl },
  row: { flexDirection: "row", justifyContent: "center", gap: SPACE.md },
  cell: {
    width: 52,
    height: 58,
    borderRadius: 14,
    backgroundColor: T.bg2,
    borderWidth: 1,
    borderColor: T.border2,
    justifyContent: "center",
    alignItems: "center",
  },
  cellCompact: { width: 44, height: 52, borderRadius: 12 },
  cellFilled: { borderColor: T.orange, backgroundColor: T.orangeLt },
  cellNext: { borderColor: T.orange, borderWidth: 2 },
  cellError: { borderColor: T.textDanger, backgroundColor: T.bgDanger },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.text1,
  },
  digit: { fontSize: 22, fontWeight: "700", color: T.text1 },
  pad: { alignSelf: "stretch", marginHorizontal: -SPACE.lg },
  padDisabled: { opacity: 0.5 },
});

export default PinEntry;
