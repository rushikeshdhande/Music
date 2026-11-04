import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { usePlayerStore } from '../store/playerStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { BackIcon, TrashIcon } from '../icons/Icons';
import { safeGoBack } from "../utils/navigation";
import { formatDuration } from '../utils/formatDuration';

const SPACING = { sm: 8, md: 16, lg: 20, xl: 28 };
const FONT_SIZES = { xs: 11, sm: 12, md: 16, lg: 18, xl: 22 };

const ACCENT = '#f92c47';

// ---- SF font helper (same as MusicPlayer) ----
const SF = {
  regular: Platform.select({ ios: 'System', default: 'SFProDisplay-Regular' }),
  medium: Platform.select({ ios: 'System', default: 'SFProDisplay-Medium' }),
  semibold: Platform.select({
    ios: 'System',
    default: 'SFProDisplay-Semibold',
  }),
};
const iosWeight = (w: TextStyle['fontWeight']): TextStyle =>
  Platform.OS === 'ios' ? { fontWeight: w } : {};

export default function QueueScreen() {
  const nav = useNavigation<any>();
  const theme = useTheme();
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveInQueue = usePlayerStore((s) => s.moveInQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const { loadAndPlay } = useAudioPlayer();

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
       <TouchableOpacity
  onPress={() => safeGoBack(nav)}
  style={styles.iconBtn}
>
  <BackIcon color="#fff" />
</TouchableOpacity>
        <Text style={styles.title}>Queue</Text>
        <TouchableOpacity onPress={clearQueue} style={styles.iconBtn}>
          <TrashIcon color="#fff" />
        </TouchableOpacity>
      </View>

      {queue.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Queue is empty</Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(it, idx) => it.id + idx}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item, index }) => {
            const isCurrent = index === currentIndex;
            return (
              <View
                style={[
                  styles.row,
                  isCurrent && styles.rowCurrent,
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => loadAndPlay(queue, index)}
                  activeOpacity={0.7}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.rowTitle,
                      { color: isCurrent ? ACCENT : '#fff' },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowSubtitle}>
                    {item.artist} · {formatDuration(item.duration)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => moveInQueue(index, Math.max(0, index - 1))}
                  style={styles.mini}
                  activeOpacity={0.7}
                >
                  <Text style={styles.miniText}>↑</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    moveInQueue(index, Math.min(queue.length - 1, index + 1))
                  }
                  style={styles.mini}
                  activeOpacity={0.7}
                >
                  <Text style={styles.miniText}>↓</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => removeFromQueue(index)}
                  style={styles.mini}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.miniText, { color: ACCENT }]}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  iconBtn: {
    padding: 10,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: FONT_SIZES.lg,
    fontFamily: SF.semibold,
    ...iosWeight('700'),
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FONT_SIZES.md,
    fontFamily: SF.medium,
    ...iosWeight('500'),
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowCurrent: {
    backgroundColor: 'rgba(249, 44, 71, 0.08)',
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: SF.semibold,
    ...iosWeight('600'),
  },
  rowSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
    fontFamily: SF.medium,
    ...iosWeight('500'),
  },
  mini: {
    padding: 8,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: SF.semibold,
    ...iosWeight('600'),
  },
});