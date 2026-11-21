// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Bağlantı yokken üstte ince şerit: son kaydedilen veriler gösterilir, değişiklikler kaydedilemez */
import { useNetworkState } from 'expo-network';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';
import { Icon } from './ui/Icon';
import { T } from './ui/Text';

export function OfflineBanner() {
  const net = useNetworkState();
  const insets = useSafeAreaInsets();
  const offline = Platform.OS !== 'web' && (net.isConnected === false || net.isInternetReachable === false);
  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: colors.espresso, paddingTop: insets.top + 4, paddingBottom: 6, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
    >
      <Icon name="wifi-off" size={14} color={colors.rose} />
      <T variant="caption" color={colors.cream} style={{ flex: 1 }}>
        Çevrimdışısın. Son kaydedilen bilgiler gösteriliyor. Değişiklikler bağlantı gelince yapılabilir.
      </T>
    </View>
  );
}
