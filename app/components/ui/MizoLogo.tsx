/**
 * Mizo brand marks: the rounded "m" with the coin (la mise) above it.
 * Source files and usage rules: assets/brand/ and TontiPro-Admin/brand/README.md.
 */
import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

export const MIZO = {
  laterite: "#D85A30",
  tileTop: "#E26B3F",
  tileBottom: "#C94F27",
  coin: "#FFC46B",
  ink: "#1A1A18",
};

const M_PATH = "M22 78V52a14 14 0 0 1 28 0v26M50 52a14 14 0 0 1 28 0v26";

export function MizoGlyph({
  size = 32,
  color = "#fff",
  coin = MIZO.coin,
}: { size?: number; color?: string; coin?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="translate(0 3)">
        <Path
          d={M_PATH}
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={50} cy={18} r={8} fill={coin} />
      </G>
    </Svg>
  );
}

/** Terracotta tile with the white glyph, as on the app icon. */
export function MizoMark({ size = 64 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: MIZO.laterite,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MizoGlyph size={size * 0.72} />
    </View>
  );
}

/** "mizo" monoline wordmark; the dot of the i is the coin. */
export function MizoWordmark({
  height = 20,
  color = MIZO.ink,
  coin = MIZO.laterite,
}: { height?: number; color?: string; coin?: string }) {
  return (
    <Svg
      height={height}
      width={(height * 848) / 310}
      viewBox="0 -30 848 310"
      accessibilityLabel="Mizo"
    >
      <Path
        d="M20 260V140a60 60 0 0 1 120 0v120M140 140a60 60 0 0 1 120 0v120M336 260V80M412 80h160L412 260h160"
        fill="none"
        stroke={color}
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={718} cy={170} r={90} fill="none" stroke={color} strokeWidth={40} />
      <Circle cx={336} cy={6} r={28} fill={coin} />
    </Svg>
  );
}
