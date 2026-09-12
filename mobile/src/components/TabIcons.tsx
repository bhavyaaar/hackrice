import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type IconProps = {
  color: string;
  size: number;
  focused?: boolean;
};

function Frame({ size, children }: { size: number; children: ReactNode }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

export function HouseIcon({ color, size, focused }: IconProps) {
  const w = size * 0.78;
  const stroke = focused ? 2.2 : 1.6;
  return (
    <Frame size={size}>
      <View style={{ width: w, alignItems: "center" }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: w * 0.48,
            borderRightWidth: w * 0.48,
            borderBottomWidth: w * 0.36,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: color,
            marginBottom: -1,
          }}
        />
        <View
          style={{
            width: w * 0.7,
            height: w * 0.46,
            borderWidth: stroke,
            borderColor: color,
            backgroundColor: focused ? color : "transparent",
            borderBottomLeftRadius: 2,
            borderBottomRightRadius: 2,
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              width: w * 0.2,
              height: w * 0.22,
              backgroundColor: focused ? "#F3F8F5" : color,
              borderTopLeftRadius: 1.5,
              borderTopRightRadius: 1.5,
            }}
          />
        </View>
      </View>
    </Frame>
  );
}

export function CameraIcon({ color, size, focused }: IconProps) {
  const w = size * 0.8;
  const h = size * 0.54;
  const stroke = focused ? 2.2 : 1.6;
  const lens = size * 0.22;
  return (
    <Frame size={size}>
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: w * 0.28,
            height: 4,
            backgroundColor: color,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            marginBottom: -1,
          }}
        />
        <View
          style={{
            width: w,
            height: h,
            borderWidth: stroke,
            borderColor: color,
            backgroundColor: focused ? color : "transparent",
            borderRadius: 5,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: lens,
              height: lens,
              borderRadius: lens / 2,
              borderWidth: stroke,
              borderColor: focused ? "#F3F8F5" : color,
              backgroundColor: "transparent",
            }}
          />
        </View>
      </View>
    </Frame>
  );
}

export function DollarIcon({ color, size }: IconProps) {
  return (
    <Frame size={size}>
      <Text style={[styles.dollar, { color, fontSize: size * 0.78, lineHeight: size }]}>$</Text>
    </Frame>
  );
}

export function StarIcon({ color, size, focused }: IconProps) {
  const big = size * 0.42;
  const small = size * 0.22;
  return (
    <Frame size={size}>
      <View style={{ width: size * 0.86, height: size * 0.86 }}>
        <View
          style={[
            styles.diamond,
            {
              width: big,
              height: big,
              backgroundColor: color,
              top: size * 0.14,
              left: size * 0.22,
              opacity: focused ? 1 : 0.92,
            },
          ]}
        />
        <View
          style={[
            styles.diamond,
            {
              width: small,
              height: small,
              backgroundColor: color,
              top: size * 0.08,
              right: size * 0.08,
            },
          ]}
        />
        <View
          style={[
            styles.diamond,
            {
              width: small * 0.78,
              height: small * 0.78,
              backgroundColor: color,
              bottom: size * 0.1,
              left: size * 0.08,
            },
          ]}
        />
      </View>
    </Frame>
  );
}

export function PersonIcon({ color, size, focused }: IconProps) {
  const head = size * 0.3;
  const bodyW = size * 0.56;
  const bodyH = size * 0.34;
  const stroke = focused ? 2.2 : 1.6;
  return (
    <Frame size={size}>
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: head,
            height: head,
            borderRadius: head / 2,
            borderWidth: stroke,
            borderColor: color,
            backgroundColor: focused ? color : "transparent",
            marginBottom: 2,
          }}
        />
        <View
          style={{
            width: bodyW,
            height: bodyH,
            borderWidth: stroke,
            borderColor: color,
            backgroundColor: focused ? color : "transparent",
            borderTopLeftRadius: bodyW / 2,
            borderTopRightRadius: bodyW / 2,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
          }}
        />
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  dollar: {
    fontWeight: "800",
    textAlign: "center",
  },
  diamond: {
    position: "absolute",
    transform: [{ rotate: "45deg" }],
    borderRadius: 1,
  },
});
