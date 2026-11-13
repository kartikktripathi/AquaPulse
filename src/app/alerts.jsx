import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, infoStyles as s, useExternalLink } from '../components/InfoPage';
import ReportCard from '../components/ReportCard';
import ReportDetailsModal from '../components/ReportDetailsModal';
import { useReportExplorer } from '../context/ReportExplorerContext';
import { ALERT_MODES, getCommunityAlerts } from '../utils/communityAlerts';
import { PMC_WEBSITE } from '../data/helpContacts';

export default function Alerts() {
  const router = useRouter(), insets = useSafeAreaInsets();
  const { reports, loading, error, source, refreshReports } = useReportExplorer();
  const { openLink, linkError } = useExternalLink();
  const [mode, setMode] = useState('all'), [area, setArea] = useState(''), [selection, setSelection] = useState(null);
  useFocusEffect(useCallback(() => { refreshReports(); }, [refreshReports]));
  const alerts = useMemo(() => getCommunityAlerts(reports, { mode, area }), [reports, mode, area]);
  return <View style={[s.root, { paddingTop: insets.top }]}>
    <View style={s.header}>
      <Pressable style={s.back} accessibilityRole="button" accessibilityLabel="Back to map" onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
        <Ionicons name="chevron-back" size={24} color="#243447" /></Pressable>
      <View style={{ flex: 1 }}><Text accessibilityRole="header" style={s.title}>Water Outages & Alerts</Text><Text style={s.muted}>Community reports · all areas</Text></View>
      <Pressable style={s.back} disabled={loading} accessibilityRole="button" accessibilityLabel="Refresh alerts" onPress={refreshReports}>
        {loading ? <ActivityIndicator color="#007AFF" /> : <Ionicons name="refresh" size={22} color="#007AFF" />}</Pressable>
    </View>
    <FlatList data={alerts} keyExtractor={(item, index) => String(item.id ?? index)}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshReports} />}
      ListHeaderComponent={<View style={styles.controls}>
        <View style={s.card}><Text style={s.heading}>Check before you plan</Text>
          <Text style={s.body}>These are open community reports, not confirmed outage notices. For official supply schedules or restoration times, check your local water provider.</Text>
          <ActionButton secondary label="Pune city: official municipal website" onPress={() => openLink(PMC_WEBSITE)} />
          <ActionButton secondary label="Contact a helpline" onPress={() => router.push('/helpline')} />
        </View>
        {linkError && <Text accessibilityRole="alert" style={s.error}>{linkError}</Text>}
        <View style={styles.modes}>{ALERT_MODES.map((item) => <Pressable key={item.id} accessibilityRole="radio" aria-checked={mode === item.id}
          accessibilityState={{ checked: mode === item.id }} onPress={() => setMode(item.id)} style={[styles.chip, mode === item.id && styles.selected]}>
          <Text style={[styles.chipText, mode === item.id && { color: '#fff' }]}>{item.label}</Text></Pressable>)}</View>
        <TextInput value={area} onChangeText={setArea} accessibilityLabel="Search alert area" placeholder="Search address or landmark" style={styles.input} maxLength={120} />
        {error && <View style={s.card}><Text style={s.body}>{source === 'cache' ? 'Refresh failed. Showing previously loaded reports; their status may have changed.' : 'Reports could not be loaded. Check your connection and try again.'}</Text>
          <ActionButton label="Retry alerts" disabled={loading} onPress={refreshReports} /></View>}
        <Text style={s.muted} accessibilityLiveRegion="polite">{loading ? 'Updating reports…' : source === 'unavailable' ? 'Reports unavailable' : `${alerts.length} matching open report${alerts.length === 1 ? '' : 's'} · highest severity first`}</Text>
        <Text style={s.muted}>Supply-related includes pipe leaks, low pressure and tanker disruption reports. Resolved reports are excluded.</Text>
      </View>}
      renderItem={({ item }) => <ReportCard report={item} onPress={() => { Keyboard.dismiss(); setSelection(item); }} />}
      ListEmptyComponent={!loading && source !== 'unavailable' ? <View style={s.card}>
        <Text style={s.heading}>No matching community reports</Text>
        <Text style={s.body}>This does not confirm that water supply is normal. Try another area or filter, or check directly with your provider.</Text>
        {(mode !== 'all' || area) && <ActionButton secondary label="Clear alert filters" onPress={() => { setMode('all'); setArea(''); }} />}
      </View> : null} />
    {selection && <ReportDetailsModal report={reports.find((item) => item.id === selection.id)} onClose={() => setSelection(null)} />}
  </View>;
}
const styles = StyleSheet.create({
  controls: { gap: 14, marginBottom: 12 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 22 },
  selected: { backgroundColor: '#007AFF' },
  chipText: { color: '#435367', fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#d4deea', borderRadius: 12, backgroundColor: '#fff', color: '#243447' },
});
