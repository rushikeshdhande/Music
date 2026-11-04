import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

// ---------------------------------------------------------------------------
// useSleepTimer — counts down and calls onExpire (e.g. pause the song)
// ---------------------------------------------------------------------------
export const useSleepTimer = (onExpire: () => void) => {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (endAt == null) {
      setRemainingSec(null);
      return;
    }
    const tick = () => {
      const left = Math.round((endAt - Date.now()) / 1000);
      if (left <= 0) {
        setEndAt(null);
        setRemainingSec(null);
        onExpireRef.current();
      } else {
        setRemainingSec(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  const start = useCallback((minutes: number) => {
    setEndAt(Date.now() + minutes * 60 * 1000);
  }, []);
  const cancel = useCallback(() => setEndAt(null), []);

  return { remainingSec, isActive: endAt != null, start, cancel };
};

export const formatTimer = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// ---------------------------------------------------------------------------
// Wheel — position is an Animated.Value (in "rows"), driven by ONE pan
// responder that covers the whole screen. Rendering is 100% native-driven, so
// dragging up / down anywhere is smooth.
// ---------------------------------------------------------------------------
const ITEM_H = 48;
const VISIBLE = 5; // odd number, centre row is the selected one
const WHEEL_H = ITEM_H * VISIBLE;
const PAD = ITEM_H * Math.floor(VISIBLE / 2);

const DRAG_SENSITIVITY = 1.1; // rows moved per row-height of finger travel
const MOMENTUM_MS = 380; // how far a flick glides
const RUBBER = 0.35; // resistance past the first / last row

type WheelColors = {
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
};

type Ctrl = {
  pos: Animated.Value;
  posRef: { current: number };
  indexRef: { current: number };
  count: number;
  def: number;
  reset: () => void;
};

const useWheelCtrl = (count: number, def: number): Ctrl => {
  const ref = useRef<Ctrl | null>(null);
  if (!ref.current) {
    const pos = new Animated.Value(def);
    const c: Ctrl = {
      pos,
      posRef: { current: def },
      indexRef: { current: def },
      count,
      def,
      reset: () => {
        pos.stopAnimation();
        pos.setValue(def);
        c.posRef.current = def;
        c.indexRef.current = def;
      },
    };
    ref.current = c;
  }
  return ref.current;
};

const clampIdx = (n: number, count: number) =>
  Math.max(0, Math.min(count - 1, Math.round(n)));

const rubber = (v: number, max: number) => {
  if (v < 0) return v * RUBBER;
  if (v > max) return max + (v - max) * RUBBER;
  return v;
};

const Wheel = ({
  ctrl,
  data,
  format,
  colors,
}: {
  ctrl: Ctrl;
  data: number[];
  format: (n: number) => string;
  colors: WheelColors;
}) => {
  const translateY = Animated.multiply(ctrl.pos, -ITEM_H);

  return (
    <View style={s.wheelWrap}>
      <View
        pointerEvents="none"
        style={[s.selection, { top: PAD, borderColor: colors.border }]}
      />
      <View style={{ height: WHEEL_H, overflow: "hidden" }} pointerEvents="none">
        <Animated.View
          style={{ paddingTop: PAD, transform: [{ translateY }] }}
        >
          {data.map((v, i) => {
            const range = [i - 2, i - 1, i, i + 1, i + 2];
            const opacity = ctrl.pos.interpolate({
              inputRange: range,
              outputRange: [0.15, 0.4, 1, 0.4, 0.15],
              extrapolate: "clamp",
            });
            const scale = ctrl.pos.interpolate({
              inputRange: range,
              outputRange: [0.7, 0.85, 1.2, 0.85, 0.7],
              extrapolate: "clamp",
            });
            return (
              <View key={v} style={s.item}>
                <Animated.Text
                  style={[
                    s.itemText,
                    { color: colors.text, opacity, transform: [{ scale }] },
                  ]}
                >
                  {format(v)}
                </Animated.Text>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// SleepTimerSheet
//   • Preset view : wheel 5 min → 1 hr, "Start Timer", "Custom" button
//   • Custom view : hours + minutes wheels, "Continue" sets the timer
//   • Drag up / down ANYWHERE on the screen to change the value
//     (custom view: left half = hours, right half = minutes)
// ---------------------------------------------------------------------------
const PRESET_MINUTES: number[] = Array.from({ length: 12 }, (_, i) => (i + 1) * 5); // 5..60
const PRESET_DEFAULT = PRESET_MINUTES.indexOf(30);

const HOURS: number[] = Array.from({ length: 13 }, (_, i) => i); // 0..12
const MINS: number[] = Array.from({ length: 60 }, (_, i) => i); // 0..59

const presetLabel = (min: number) => (min === 60 ? "1 hr" : `${min} min`);

type Props = {
  visible: boolean;
  onClose: () => void;
  onStart: (minutes: number) => void;
  onCancelTimer: () => void;
  remainingSec: number | null;
  colors: WheelColors;
};

export const SleepTimerSheet = ({
  visible,
  onClose,
  onStart,
  onCancelTimer,
  remainingSec,
  colors,
}: Props) => {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [zeroError, setZeroError] = useState(false);
  const modeRef = useRef<"preset" | "custom">("preset");
  modeRef.current = mode;

  const presetCtrl = useWheelCtrl(PRESET_MINUTES.length, PRESET_DEFAULT);
  const hoursCtrl = useWheelCtrl(HOURS.length, 0);
  const minsCtrl = useWheelCtrl(MINS.length, 30);

  // always reopen on the preset view with default values
  useEffect(() => {
    if (visible) {
      setMode("preset");
      setZeroError(false);
      presetCtrl.reset();
      hoursCtrl.reset();
      minsCtrl.reset();
    }
  }, [visible, presetCtrl, hoursCtrl, minsCtrl]);

  // ---- one pan responder for the whole screen -----------------------------
  const activeRef = useRef<Ctrl>(presetCtrl);
  const startPosRef = useRef(0);
  const baseDyRef = useRef(0);

  const settle = (c: Ctrl, vy: number) => {
    const cur = c.posRef.current;
    const extra = (-vy * MOMENTUM_MS) / ITEM_H;
    const target = clampIdx(cur + extra, c.count);
    c.indexRef.current = target;
    c.posRef.current = target;
    const dist = Math.abs(target - cur);
    Animated.timing(c.pos, {
      toValue: target,
      duration: Math.min(900, 220 + dist * 40),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (_, g) => {
        let c = presetCtrl;
        if (modeRef.current === "custom") {
          const half = Dimensions.get("window").width / 2;
          c = g.x0 < half ? hoursCtrl : minsCtrl;
        }
        activeRef.current = c;
        baseDyRef.current = g.dy;
        startPosRef.current = c.posRef.current;
        // catch the wheel mid-glide
        c.pos.stopAnimation((v) => {
          c.posRef.current = v;
          startPosRef.current = v;
        });
      },

      onPanResponderMove: (_, g) => {
        const c = activeRef.current;
        const raw =
          startPosRef.current -
          ((g.dy - baseDyRef.current) / ITEM_H) * DRAG_SENSITIVITY;
        const v = rubber(raw, c.count - 1);
        c.pos.setValue(v);
        c.posRef.current = v;
        c.indexRef.current = clampIdx(v, c.count);
      },

      onPanResponderRelease: (_, g) => settle(activeRef.current, g.vy),
      onPanResponderTerminate: () => settle(activeRef.current, 0),
    }),
  ).current;

  const active = remainingSec != null;

  const handleContinue = () => {
    const total =
      HOURS[hoursCtrl.indexRef.current] * 60 + MINS[minsCtrl.indexRef.current];
    if (total <= 0) {
      setZeroError(true);
      return;
    }
    onStart(total);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* the pan handlers cover the whole screen: drag anywhere */}
      <View style={s.fill} {...pan.panHandlers}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable
            style={[s.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[s.handle, { backgroundColor: colors.textSecondary }]}
            />

            {mode === "preset" ? (
              <>
                <Text style={[s.title, { color: colors.text }]}>
                  Sleep Timer
                </Text>

                {active && (
                  <View style={s.activeBox}>
                    <Text
                      style={[s.activeLabel, { color: colors.textSecondary }]}
                    >
                      Music stops in
                    </Text>
                    <Text style={[s.activeTime, { color: colors.text }]}>
                      {formatTimer(remainingSec as number)}
                    </Text>
                  </View>
                )}

                <Text style={[s.hint, { color: colors.textSecondary }]}>
                  Drag up or down anywhere to set the time
                </Text>

                <Wheel
                  ctrl={presetCtrl}
                  data={PRESET_MINUTES}
                  format={presetLabel}
                  colors={colors}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[s.primaryBtn, { backgroundColor: colors.text }]}
                  onPress={() => {
                    onStart(PRESET_MINUTES[presetCtrl.indexRef.current]);
                    onClose();
                  }}
                >
                  <Text style={[s.primaryText, { color: colors.surface }]}>
                    {active ? "Update Timer" : "Start Timer"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[s.outlineBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setZeroError(false);
                    setMode("custom");
                  }}
                >
                  <Text style={[s.outlineText, { color: colors.text }]}>
                    Custom
                  </Text>
                </TouchableOpacity>

                {active && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={s.secondaryBtn}
                    onPress={() => {
                      onCancelTimer();
                      onClose();
                    }}
                  >
                    <Text style={s.cancelText}>Turn Off Timer</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <View style={s.customHeader}>
                  <TouchableOpacity
                    onPress={() => setMode("preset")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={s.backBtn}
                  >
                    <Text
                      style={[s.backText, { color: colors.textSecondary }]}
                    >
                      ‹ Back
                    </Text>
                  </TouchableOpacity>
                  <Text style={[s.title, { color: colors.text }]}>
                    Custom Timer
                  </Text>
                  <View style={s.backBtn} />
                </View>

                <Text style={[s.hint, { color: colors.textSecondary }]}>
                  Drag the left side for hours, the right side for minutes
                </Text>

                <View style={s.customRow}>
                  <View style={s.customCol}>
                    <Wheel
                      ctrl={hoursCtrl}
                      data={HOURS}
                      format={(n) => `${n} hr`}
                      colors={colors}
                    />
                  </View>
                  <View style={s.customCol}>
                    <Wheel
                      ctrl={minsCtrl}
                      data={MINS}
                      format={(n) => `${n} min`}
                      colors={colors}
                    />
                  </View>
                </View>

                {zeroError && (
                  <Text style={s.errorText}>Choose at least 1 minute</Text>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[s.primaryBtn, { backgroundColor: colors.text }]}
                  onPress={handleContinue}
                >
                  <Text style={[s.primaryText, { color: colors.surface }]}>
                    Continue
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
    opacity: 0.5,
  },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  hint: { fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 8 },
  activeBox: { alignItems: "center", marginTop: 12 },
  activeLabel: { fontSize: 12 },
  activeTime: { fontSize: 28, fontWeight: "700", marginTop: 2 },

  wheelWrap: { height: WHEEL_H, justifyContent: "center" },
  selection: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: { textAlign: "center", fontSize: 22, fontWeight: "600" },

  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 64 },
  backText: { fontSize: 15, fontWeight: "500" },
  customRow: { flexDirection: "row", gap: 12 },
  customCol: { flex: 1 },
  errorText: {
    color: "#f92c47",
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
  },

  primaryBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { fontSize: 16, fontWeight: "700" },
  outlineBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
  },
  outlineText: { fontSize: 16, fontWeight: "600" },
  secondaryBtn: { marginTop: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#f92c47", fontSize: 15, fontWeight: "600" },
});