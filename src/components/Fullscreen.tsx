// src/components/Fullscreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  LayoutChangeEvent,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView } from "expo-video";
import { usePlayerStore } from "../store/playerStore";
import { useVideoBridge } from "../store/videoPlayerBridge";
import { useTheme } from "../hooks/useTheme";
import { formatDuration } from "../utils/formatDuration";
import { showToast } from "../utils/toast";
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  EllipsisIcon,
  LyricsIcon,
  CastIcon,
  QueueIcon,
} from "../icons/Icons";
import {
  CloseIcon,
  VolumeIcon,
  Replay10Ring,
  Replay10Digits,
  Forward10Ring,
  Forward10Digits,
} from "../icons/VideoIcons";
import { SF, iosWeight } from "./playerShared";

// â”€â”€ Shared assets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STAR_ICON = require("../../assets/icons/star-icon.png");
const FAVOURITED_ICON = require("../../assets/images/favourited.png");
const MUTE_SPEAKER = require("../../assets/images/mutespecker.png");

const MARQUEE_PAUSE_MS = 3000;
const MARQUEE_START_DELAY_MS = 2000;
const TITLE_SCROLL_MIN_WORDS = 4;
const ARTIST_SCROLL_MIN_WORDS = 4;

const SKIP_BG = "rgba(70,70,70,0.55)";

// âœ… Time the chrome (title / controls / progress) stays visible after tap
const CHROME_VISIBLE_MS = 5000;
// âœ… Hide / show animation
const CHROME_ANIM_MS = 260;
const CHROME_SLIDE_DISTANCE = 40;

// â”€â”€ ProgressBar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ProgressBar = ({
  position = 0,
  duration = 0,
  onSeek,
  trackColor,
  fillColor,
}: {
  position?: number;
  duration?: number;
  onSeek?: (seconds: number) => void;
  trackColor: string;
  fillColor: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const barWidthRef = useRef(0);
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    if (isDragging) return;
    const ratio =
      duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [position, duration, isDragging, progressAnim]);

  const ratioFromX = (x: number) => {
    const clamped = Math.max(0, Math.min(barWidthRef.current, x));
    return barWidthRef.current > 0 ? clamped / barWidthRef.current : 0;
  };

  const barPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        progressAnim.stopAnimation();
        progressAnim.setValue(ratioFromX(evt.nativeEvent.locationX));
      },
      onPanResponderMove: (evt) => {
        progressAnim.setValue(ratioFromX(evt.nativeEvent.locationX));
      },
      onPanResponderRelease: (evt) => {
        const ratio = ratioFromX(evt.nativeEvent.locationX);
        onSeekRef.current?.(ratio * durationRef.current);
        setIsDragging(false);
      },
      onPanResponderTerminate: () => setIsDragging(false),
    }),
  ).current;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={barStyles.container}>
      <View
        style={[barStyles.track, { backgroundColor: trackColor }]}
        onLayout={(e) => {
          barWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...barPan.panHandlers}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            barStyles.progress,
            { width: progressWidth, backgroundColor: fillColor },
          ]}
        />
      </View>
    </View>
  );
};

const barStyles = StyleSheet.create({
  container: { width: "100%", paddingVertical: 12 },
  track: {
    height: 7,
    borderRadius: 8,
    justifyContent: "center",
    position: "relative",
  },
  progress: {
    height: 7,
    borderRadius: 8,
    position: "absolute",
    left: 0,
  },
});

// â”€â”€ BoldStar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BoldStar = ({
  size = 20,
  thickness = 0.7,
  color = "#FFFFFF",
}: {
  size?: number;
  thickness?: number;
  color?: string;
}) => {
  const pad = Math.ceil(thickness);
  const offsets = [
    [0, 0],
    [thickness, 0],
    [-thickness, 0],
    [0, thickness],
    [0, -thickness],
    [thickness, thickness],
    [-thickness, -thickness],
    [thickness, -thickness],
    [-thickness, thickness],
  ];
  return (
    <View style={{ width: size + pad * 2, height: size + pad * 2 }}>
      {offsets.map(([dx, dy], i) => (
        <Image
          key={i}
          source={STAR_ICON}
          resizeMode="contain"
          style={{
            position: "absolute",
            left: pad + dx,
            top: pad + dy,
            width: size,
            height: size,
            tintColor: color,
          }}
        />
      ))}
    </View>
  );
};

// â”€â”€ Marquee â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type MarqueeLine = {
  text: string;
  style: any;
  scroll?: boolean;
  onPress?: () => void;
};

const wordCount = (t: string): number =>
  t.trim().split(/\s+/).filter(Boolean).length;

const MarqueeTexts = ({
  lines,
  gap = 40,
  speed = 35,
  pause = MARQUEE_PAUSE_MS,
  startDelay = MARQUEE_START_DELAY_MS,
}: {
  lines: MarqueeLine[];
  gap?: number;
  speed?: number;
  pause?: number;
  startDelay?: number;
}) => {
  const [containerW, setContainerW] = useState(0);
  const [textWs, setTextWs] = useState<number[]>(() => lines.map(() => 0));

  const progress = useRef(new Animated.Value(0)).current;

  const measured =
    containerW > 0 && lines.every((l, i) => !l.scroll || textWs[i] > 0);
  const moves = lines.map((l, i) => !!l.scroll && textWs[i] > containerW);
  const anyMove = measured && moves.some(Boolean);

  const effGaps = textWs.map((w) => Math.max(gap, containerW - w + 20));
  const dists = textWs.map((w, i) => w + effGaps[i]);
  const durations = dists.map((d) => d / speed);
  const maxDur = Math.max(...durations.filter((_, i) => moves[i]), 0.001);
  const sig = anyMove ? dists.map((d, i) => (moves[i] ? d : 0)).join(",") : "";

  useEffect(() => {
    progress.setValue(0);
    if (!anyMove) return;
    const anim = Animated.sequence([
      Animated.delay(startDelay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: maxDur * 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(pause),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <View>
      {lines.map((line, i) => {
        const wrapperProps = {
          activeOpacity: line.onPress ? 0.6 : 1,
          disabled: !line.onPress,
          onPress: line.onPress,
          style: { overflow: "hidden" as const, position: "relative" as const },
          onLayout:
            i === 0
              ? (e: LayoutChangeEvent) =>
                  setContainerW(e.nativeEvent.layout.width)
              : undefined,
        };

        if (!line.scroll) {
          return (
            <TouchableOpacity key={i} {...wrapperProps}>
              <Text style={line.style} numberOfLines={1} ellipsizeMode="tail">
                {line.text}
              </Text>
            </TouchableOpacity>
          );
        }

        const f = durations[i] / maxDur;
        const translateX: any = moves[i]
          ? progress.interpolate(
              f < 1
                ? {
                    inputRange: [0, f, 1],
                    outputRange: [0, -dists[i], -dists[i]],
                  }
                : { inputRange: [0, 1], outputRange: [0, -dists[i]] },
            )
          : 0;

        return (
          <TouchableOpacity key={i} {...wrapperProps}>
            <Animated.View
              style={{
                flexDirection: "row",
                width: 10000,
                transform: [{ translateX }],
              }}
            >
              <Text
                style={line.style}
                numberOfLines={1}
                onLayout={(e) => {
                  const w = Math.ceil(e.nativeEvent.layout.width) + 1;
                  setTextWs((prev) =>
                    prev[i] === w
                      ? prev
                      : prev.map((v, k) => (k === i ? w : v)),
                  );
                }}
              >
                {line.text}
              </Text>
              {moves[i] && (
                <Text
                  style={[line.style, { marginLeft: effGaps[i] }]}
                  numberOfLines={1}
                >
                  {line.text}
                </Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// â”€â”€ RippleButton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RippleButton = ({
  onPress,
  children,
  style,
  rippleSize = 90,
  activeOpacity = 0.7,
  hitSlop,
  rippleColor = "#000000",
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  rippleSize?: number;
  activeOpacity?: number;
  hitSlop?: any;
  rippleColor?: string;
}) => {
  const ripple = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    onPress?.();
  }, [onPress, ripple]);

  const scale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 1],
  });

  const opacity = ripple.interpolate({
    inputRange: [0, 0.15, 0.6, 1],
    outputRange: [0, 0.85, 0.45, 0],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={activeOpacity}
      hitSlop={hitSlop}
      style={[style, { overflow: "hidden", borderRadius: rippleSize / 2 }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <Animated.View
          style={{
            width: rippleSize,
            height: rippleSize,
            borderRadius: rippleSize / 2,
            backgroundColor: rippleColor,
            opacity,
            transform: [{ scale }],
          }}
        />
      </Animated.View>
      {children}
    </TouchableOpacity>
  );
};

// â”€â”€ PlayerControlsBlock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type PlayerControlsBlockProps = {
  songId: string | number;
  title: string;
  artist: string;
  isPlaying: boolean;
  isFav: boolean;
  position: number;
  duration: number;
  onToggleFav?: () => void;
  onOpenOptions?: () => void;
  onPlayPause?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeek?: (seconds: number) => void;
  onOpenAlbum?: () => void;
  onDark: boolean;
};

const PlayerControlsBlock = ({
  songId,
  title,
  artist,
  isPlaying,
  isFav,
  position,
  duration,
  onToggleFav,
  onOpenOptions,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onOpenAlbum,
  onDark,
}: PlayerControlsBlockProps) => {
  const theme = useTheme();
  const remaining = Math.max(0, (duration || 0) - (position || 0));

  const fg = onDark ? "#FFFFFF" : theme.text;
  const fgMuted = onDark ? "rgba(232, 226, 226, 0.48)" : theme.textSecondary;
  const fgFaint = onDark ? "rgba(255,255,255,0.6)" : theme.textSecondary;

  const trackBg = onDark ? "rgba(174, 176, 177, 0.13)" : "rgba(0,0,0,0.08)";
  const progressBg = onDark ? "rgba(240, 244, 245, 0.48)" : "rgba(0,0,0,0.4)";
  const rippleColor = onDark ? "#000000" : "rgba(0,0,0,0.15)";
  const bottomIconColor = onDark
    ? "rgba(255,255,255,0.6)"
    : theme.textSecondary;

  return (
    <View>
      <View style={blockStyles.infoContainer}>
        <View style={blockStyles.titleRow}>
          <View style={blockStyles.titleTextContainer}>
            <MarqueeTexts
              key={`${songId}|${title}|${artist}`}
              lines={[
                {
                  text: title,
                  style: [blockStyles.title, { color: fg }],
                  scroll: wordCount(title) >= TITLE_SCROLL_MIN_WORDS,
                  onPress: onOpenAlbum,
                },
                {
                  text: artist,
                  style: [blockStyles.artist, { color: fgMuted }],
                  scroll: wordCount(artist) >= ARTIST_SCROLL_MIN_WORDS,
                  onPress: onOpenAlbum,
                },
              ]}
              speed={35}
              pause={MARQUEE_PAUSE_MS}
              startDelay={MARQUEE_START_DELAY_MS}
            />
          </View>

          <TouchableOpacity
            onPress={onToggleFav}
            style={[
              blockStyles.iconButton,
              {
                backgroundColor: isFav
                  ? "transparent"
                  : onDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.08)",
              },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            {isFav ? (
              <Image
                source={FAVOURITED_ICON}
                style={{ width: 27, height: 27 }}
                resizeMode="contain"
                fadeDuration={0}
              />
            ) : (
              <BoldStar size={14} thickness={0.1} color={fg} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onOpenOptions}
            style={[
              blockStyles.iconButton,
              blockStyles.dotsButton,
              {
                backgroundColor: onDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.08)",
              },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <EllipsisIcon size={16} color={fg} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={blockStyles.progressContainer}>
        <ProgressBar
          position={position}
          duration={duration}
          onSeek={onSeek}
          trackColor={trackBg}
          fillColor={progressBg}
        />
        <View style={blockStyles.timeRow}>
          <Text style={[blockStyles.timeText, { color: fgFaint }]}>
            {formatDuration(position)}
          </Text>
          <Text style={[blockStyles.timeText, { color: fgFaint }]}>
            -{formatDuration(remaining)}
          </Text>
        </View>
      </View>

      <View style={blockStyles.controlsContainer}>
        <RippleButton
          onPress={onPrev}
          style={blockStyles.controlBtn}
          rippleSize={72}
          activeOpacity={0.75}
          rippleColor={rippleColor}
        >
          <BackwardIcon size={47} color={fg} />
        </RippleButton>

        <RippleButton
          onPress={onPlayPause}
          style={blockStyles.playButton}
          rippleSize={108}
          activeOpacity={0.85}
          rippleColor={rippleColor}
        >
          {isPlaying ? (
            <PauseIcon size={60} color={fg} />
          ) : (
            <PlayIcon size={56} color={fg} />
          )}
        </RippleButton>

        <RippleButton
          onPress={onNext}
          style={blockStyles.controlBtn}
          rippleSize={72}
          activeOpacity={0.75}
          rippleColor={rippleColor}
        >
          <ForwardIcon size={47} color={fg} />
        </RippleButton>
      </View>

      <View style={blockStyles.bottomRow}>
        <TouchableOpacity
          style={blockStyles.bottomBtn}
          onPress={() => showToast("Lyrics feature soon...")}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <LyricsIcon size={27} color={bottomIconColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={blockStyles.bottomBtn}
          onPress={() => showToast("Cast feature soon...")}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <CastIcon size={23} color={bottomIconColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={blockStyles.bottomBtn}
          onPress={() => showToast("Queue feature soon...")}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <QueueIcon size={23} color={bottomIconColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const blockStyles = StyleSheet.create({
  infoContainer: { paddingLeft: 30, marginTop: 33 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  titleTextContainer: {
    width: "65%",
    position: "relative",
    overflow: "hidden",
  },
  title: {
    fontSize: 20,
    fontFamily: SF.semibold,
    ...iosWeight("900"),
    letterSpacing: -0.3,
  },
  artist: {
    fontFamily: SF.regular,
    ...iosWeight("400"),
    fontSize: 20,
    marginTop: -1,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  dotsButton: { marginLeft: 16 },
  progressContainer: {
    paddingHorizontal: 30,
    marginBottom: 16,
    marginTop: 13,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 0,
  },
  timeText: {
    fontSize: 12,
    fontFamily: SF.medium,
    ...iosWeight("500"),
    letterSpacing: 0.3,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 4,
    gap: 18,
  },
  controlBtn: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  playButton: {
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    padding: 0,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 0,
    marginTop: 0,
  },
  bottomBtn: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
});

// â”€â”€ ExpandedPreview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const ExpandedPreview = ({
  itemKey,
  isVideo,
  title,
  artist,
  isPlaying,
  isFav,
  onToggleFav,
  onOpenAlbum,
  onOpenOptions,
  playPause,
  next,
  hasNext,
  prev,
  seek,
  onDark,
}: {
  itemKey: string | number;
  isVideo: boolean;
  title: string;
  artist: string;
  isPlaying: boolean;
  isFav: boolean;
  onToggleFav: () => void;
  onOpenAlbum?: () => void;
  onOpenOptions: () => void;
  playPause: () => void;
  next: () => void;
  hasNext?: boolean;
  prev: () => void;
  seek: (seconds: number) => void;
  onDark: boolean;
}) => {
  const musicPos = usePlayerStore((s) => s.position);
  const musicDur = usePlayerStore((s) => s.duration);
  const videoPos = useVideoBridge((s) => s.position);
  const videoDur = useVideoBridge((s) => s.duration);

  return (
    <PlayerControlsBlock
      songId={itemKey}
      title={title}
      artist={artist}
      isPlaying={isPlaying}
      isFav={isFav}
      position={isVideo ? videoPos : musicPos}
      duration={isVideo ? videoDur : musicDur}
      onToggleFav={onToggleFav}
      onOpenOptions={onOpenOptions}
      onPlayPause={playPause}
      onPrev={prev}
      onNext={next}
      onSeek={seek}
      onOpenAlbum={onOpenAlbum}
      onDark={onDark}
    />
  );
};

// â”€â”€ SpinSkipButton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SpinSkipButton = ({
  direction,
  onPress,
  size = 54,
}: {
  direction: "forward" | "backward";
  onPress: () => void;
  size?: number;
}) => {
  const spin = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    spin.stopAnimation();
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: 650,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
    onPress();
  };

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", direction === "forward" ? "360deg" : "-360deg"],
  });

  const circle = size + 22;
  const pivot = (2.4961 / 56) * size;
  const Ring = direction === "forward" ? Forward10Ring : Replay10Ring;
  const Digits = direction === "forward" ? Forward10Digits : Replay10Digits;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: circle,
        height: circle,
        borderRadius: circle / 2,
        backgroundColor: SKIP_BG,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateY: pivot },
                { rotate },
                { translateY: -pivot },
              ],
            },
          ]}
        >
          <Ring size={size} color="#fff" />
        </Animated.View>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Digits size={size} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// â”€â”€ ProgressSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Bottom block layout (top â†’ bottom):
//   title â†’ artist â†’ progress bar â†’ time row
// âœ… When chrome hides, this whole block slides DOWN and fades to opacity 0
const ProgressSection = React.memo(function ProgressSection({
  isLandscape,
  insets,
  title,
  artist,
  onSeek,
  bump,
  chromeAnim,
}: {
  isLandscape: boolean;
  insets: any;
  title: string;
  artist: string;
  onSeek: (s: number) => void;
  bump: () => void;
  chromeAnim: Animated.Value;
}) {
  const position = useVideoBridge((s) => s.position);
  const duration = useVideoBridge((s) => s.duration);
  const remaining = Math.max(0, (duration || 0) - (position || 0));

  const translateY = chromeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CHROME_SLIDE_DISTANCE, 0], // hidden â†’ pushed down
  });

  return (
    <Animated.View
      style={[
        fs.bottom,
        {
          bottom: insets.bottom + (isLandscape ? 26 : 44),
          left: insets.left + (isLandscape ? 28 : 28),   // â† controls left edge
      right: insets.right + (isLandscape ? 28 : 28), // â† controls right edge
          opacity: chromeAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Text numberOfLines={1} style={isLandscape ? fs.lsTitle : fs.title}>
        {title}
      </Text>
      <Text numberOfLines={1} style={isLandscape ? fs.lsArtist : fs.artist}>
        {artist}
      </Text>

      <ProgressBar
        position={position}
        duration={duration}
        onSeek={(s) => {
          bump();
          onSeek(s);
        }}
        trackColor="rgba(255,255,255,0.25)"
        fillColor="rgba(255,255,255,0.9)"
      />

      <View style={fs.timeRow}>
        <Text style={fs.time}>{formatDuration(position)}</Text>
        <Text style={fs.time}>-{formatDuration(remaining)}</Text>
      </View>
    </Animated.View>
  );
});

// â”€â”€ FullscreenPlayer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const FullscreenPlayer = React.memo(function FullscreenPlayer({
  title,
  artist,
  onClose,
  onCollapse,
}: {
  title: string;
  artist: string;
  onClose: () => void;
  onCollapse: () => void;
}) {
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const player = useVideoBridge((s) => s.player);
  const bridgeIsPlaying = useVideoBridge((s) => s.isPlaying);
  const muted = useVideoBridge((s) => s.muted);
  const volume = useVideoBridge((s) => s.volume);

  const onToggleMute = useVideoBridge((s) => s.toggleMute);
  const onTogglePlay = useVideoBridge((s) => s.togglePlay);
  const onSkip = useVideoBridge((s) => s.skip);
  const onSeek = useVideoBridge((s) => s.seekTo);

  // âœ… Local echo of play/pause so the icon flips even if the bridge is
// Use actual playback state from the video bridge
const isPlaying = bridgeIsPlaying;

const handlePlayPause = useCallback(() => {
  try {
    onTogglePlay();
  } catch (error) {
    console.warn("[Fullscreen] Play/pause failed:", error);
  }
}, [onTogglePlay]);
  const collapseRef = useRef(onCollapse);
  collapseRef.current = onCollapse;
  const heightRef = useRef(win.height);
  heightRef.current = win.height;
  const dragY = useRef(new Animated.Value(0)).current;

  const dragScale = dragY.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.86],
    extrapolate: "clamp",
  });
  const dragOpacity = dragY.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.5],
    extrapolate: "clamp",
  });

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dy > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.7) {
          Animated.timing(dragY, {
            toValue: heightRef.current,
            duration: 180,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }).start(() => collapseRef.current());
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            friction: 9,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          friction: 9,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const isLandscape = win.width > win.height;

  // â”€â”€ Chrome show / hide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [show, setShow] = useState(true);
  const autoHide = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1 = fully visible, 0 = hidden (top moved up, bottom moved down, opacity 0)
  const chromeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(chromeAnim, {
      toValue: show ? 1 : 0,
      duration: CHROME_ANIM_MS,
      easing: show ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [show, chromeAnim]);

  const bump = useCallback(() => {
    setShow(true);
    if (autoHide.current) clearTimeout(autoHide.current);
    autoHide.current = setTimeout(() => setShow(false), CHROME_VISIBLE_MS);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setShow(true);
      if (autoHide.current) clearTimeout(autoHide.current);
      return;
    }
    bump();
    return () => {
      if (autoHide.current) clearTimeout(autoHide.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const toggleChrome = useCallback(() => {
    if (show) {
      if (autoHide.current) clearTimeout(autoHide.current);
      setShow(false);
    } else if (isPlaying) {
      bump(); // show again and restart the auto-hide timer
    } else {
      setShow(true);
    }
  }, [show, isPlaying, bump]);

  // Interpolations
  const topTranslateY = chromeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CHROME_SLIDE_DISTANCE, 0], // hidden â†’ pushed up
  });

  const playSize = isLandscape ? 96 : 92;
  const skipSize = isLandscape ? 46 : 40;
  const centerGap = isLandscape ? 56 : 48;

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: "#000",
        opacity: dragOpacity,
        transform: [{ translateY: dragY }, { scale: dragScale }],
      }}
      {...swipePan.panHandlers}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={toggleChrome}>
        {player ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
            allowsPictureInPicture={false}
            pointerEvents="none"
          />
        ) : null}
      </Pressable>

      {/* âœ… Always mounted. When hidden, touches pass through to the video */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={show ? "box-none" : "none"}
      >
        {/* dim overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.42)", opacity: chromeAnim },
          ]}
          pointerEvents="none"
        />

        {/* â”€â”€ CENTRE PLAY / SKIP (fade only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Animated.View
          style={[fs.centerRow, { opacity: chromeAnim }]}
          pointerEvents="box-none"
        >
          <View
            style={[fs.centerInner, { gap: centerGap }]}
            pointerEvents="box-none"
          >
            <SpinSkipButton
              direction="backward"
              size={skipSize}
              onPress={() => {
                bump();
                onSkip(-10);
              }}
            />

            <TouchableOpacity
              onPress={() => {
                bump();
                handlePlayPause();
              }}
              activeOpacity={0.8}
              style={[
                fs.playBtn,
                {
                  width: playSize,
                  height: playSize,
                  borderRadius: playSize / 2,
                  backgroundColor: SKIP_BG,
                },
              ]}
            >
              {isPlaying ? (
                <PauseIcon size={isLandscape ? 68 : 66} color="#fff" />
              ) : (
                <PlayIcon size={isLandscape ? 62 : 60} color="#fff" />
              )}
            </TouchableOpacity>

            <SpinSkipButton
              direction="forward"
              size={skipSize}
              onPress={() => {
                bump();
                onSkip(10);
              }}
            />
          </View>
        </Animated.View>

        {/* â”€â”€ TOP BAR: cross (left) + speaker (right) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* âœ… hides by moving UP + opacity 0 */}
        <Animated.View
          style={[
            fs.topRow,
            {
              top: insets.top + (isLandscape ? 8 : 12),
              left: insets.left + (isLandscape ? 18 : 28),
              right: insets.right + (isLandscape ? 18 : 28),
              opacity: chromeAnim,
              transform: [{ translateY: topTranslateY }],
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={onClose}
            style={fs.topBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <CloseIcon size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              bump();
              onToggleMute();
            }}
            style={fs.topBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            {muted ? (
              <Image
                source={MUTE_SPEAKER}
                style={{ width: 23, height: 23 }}
                resizeMode="contain"
                fadeDuration={0}
              />
            ) : (
              <VolumeIcon size={20} color="#fff" level={volume} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* â”€â”€ BOTTOM: title, artist, progress, time â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* âœ… hides by moving DOWN + opacity 0 */}
        <ProgressSection
          isLandscape={isLandscape}
          insets={insets}
          title={title}
          artist={artist}
          onSeek={onSeek}
          bump={bump}
          chromeAnim={chromeAnim}
        />
      </View>
    </Animated.View>
  );
});

const fs = StyleSheet.create({
  // âœ… bumped to 44Ã—44 for easier tapping, matches the larger 28px icons
  topBtn: {
    width: 33,
    height: 33,
    borderRadius: 22,
    backgroundColor: SKIP_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  centerRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    position: "absolute",
    top: 18,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottom: { position: "absolute", left: 32, right: 32, bottom: 14 },
  title: {
    color: "#fff",
    fontSize: 19,
    fontFamily: SF.medium,
    fontWeight: Platform.OS === "ios" ? "700" : undefined,
  },
  artist: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontFamily: SF.regular,
    marginTop: 1,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  time: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: SF.medium,
    letterSpacing: 0.3,
  },
  lsTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: SF.medium,
    fontWeight: Platform.OS === "ios" ? "700" : undefined,
  },
  lsArtist: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 16,
    fontFamily: SF.regular,
    marginTop: 1,
  },
});
