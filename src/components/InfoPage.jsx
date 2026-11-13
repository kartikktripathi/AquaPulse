import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ActionButton({ label, onPress, secondary = false, disabled = false }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [infoStyles.action, secondary && infoStyles.secondary, (pressed || disabled) && { opacity: 0.55 }]}>
    <Text style={[infoStyles.actionText, secondary && { color: '#007AFF' }]}>{label}</Text>
  </Pressable>;
}

export function useExternalLink() {
  const [linkError, setLinkError] = useState(null);
  const openLink = async (url) => {
    setLinkError(null);
    try { await Linking.openURL(url); }
    catch { setLinkError('Could not open this link on your device. Try again, or use the displayed number or website manually.'); }
  };
  return { openLink, linkError };
}

export default function InfoPage({ title, subtitle, children }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View style={[infoStyles.root, { paddingTop: insets.top }]}>
    <View style={infoStyles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to map" style={infoStyles.back}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
        <Ionicons name="chevron-back" size={24} color="#243447" />
      </Pressable>
      <View style={{ flex: 1 }}><Text accessibilityRole="header" style={infoStyles.title}>{title}</Text>
        {!!subtitle && <Text style={infoStyles.muted}>{subtitle}</Text>}</View>
    </View>
    <ScrollView contentContainerStyle={[infoStyles.content, { paddingBottom: insets.bottom + 24 }]}>{children}</ScrollView>
  </View>;
}

export const infoStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f5f9' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e6ebf1' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f5f9', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#172b40', fontSize: 20, fontWeight: '700' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 12, borderWidth: 1, borderColor: '#e6ebf1' },
  heading: { color: '#172b40', fontSize: 17, fontWeight: '700' },
  body: { color: '#435367', fontSize: 14, lineHeight: 22 },
  muted: { color: '#68798a', fontSize: 12, lineHeight: 18 },
  action: { minHeight: 46, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#007AFF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: '#edf5ff' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  error: { color: '#a43224', backgroundColor: '#fff2ef', padding: 12, borderRadius: 12, lineHeight: 20 },
});
