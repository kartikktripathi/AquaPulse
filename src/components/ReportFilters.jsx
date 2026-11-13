import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReportExplorer } from '../context/ReportExplorerContext';
import { CATEGORY_OPTIONS, createReportFilters, DATE_OPTIONS, filterReports, getActiveFilterCount,
  getFilterSummary, SEVERITY_OPTIONS, STATUS_OPTIONS, validateReportFilters } from '../utils/reportFilters';

function Choice({ label, selected, onPress, multiple = false }) {
  return <Pressable onPress={onPress} accessibilityRole={multiple ? 'checkbox' : 'radio'}
    accessibilityLabel={label} accessibilityState={{ checked: selected }} aria-checked={selected}
    style={[styles.choice, selected && styles.selected]}>
    {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
    <Text style={[styles.choiceText, selected && styles.selectedText]}>{label}</Text>
  </Pressable>;
}

function FilterSheet({ onClose }) {
  const insets = useSafeAreaInsets();
  const { filters, setFilters, reports, now, source } = useReportExplorer();
  const [draft, setDraft] = useState(() => ({ ...filters, categories: [...filters.categories] }));
  const error = validateReportFilters(draft);
  const count = useMemo(() => filterReports(reports, draft, now).length, [reports, draft, now]);
  const update = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  const toggleCategory = (id) => setDraft((old) => ({ ...old, categories: old.categories.includes(id)
    ? old.categories.filter((item) => item !== id) : [...old.categories, id] }));
  const group = (title, key, options) => <View style={styles.section}>
    <Text style={styles.label}>{title}</Text>
    <View style={styles.choices}>{options.map((option) => <Choice key={option.id} label={option.label}
      selected={draft[key] === option.id} onPress={() => update(key, option.id)} />)}</View>
  </View>;

  return <Modal transparent animationType="slide" visible onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cancel filter changes" />
      <View style={[styles.sheet, { marginTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.grow}><Text style={styles.title} accessibilityRole="header">Filter reports & map</Text>
            <Text style={styles.hint}>The same filters apply to both views.</Text></View>
          <Pressable onPress={onClose} style={styles.icon} accessibilityRole="button" accessibilityLabel="Close filters without applying">
            <Ionicons name="close" size={24} color="#1c1c1e" />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <View style={styles.section}>
            <Text style={styles.label}>Categories · select one or more</Text>
            <View style={styles.choices}>
              <Choice label="All categories" selected={!draft.categories.length} onPress={() => update('categories', [])} />
              {CATEGORY_OPTIONS.map((category) => <Choice key={category.id} multiple label={category.label}
                selected={draft.categories.includes(category.id)} onPress={() => toggleCategory(category.id)} />)}
            </View>
          </View>
          {group('Severity', 'severity', SEVERITY_OPTIONS)}
          {group('Status', 'status', STATUS_OPTIONS)}
          {group('Reported date', 'date', DATE_OPTIONS)}
          {draft.date === 'custom' && <View style={styles.section}>
            <View style={styles.dates}>
              {[['from', 'Start date'], ['to', 'End date']].map(([key, label]) => <View key={key} style={styles.grow}>
                <Text style={styles.hint}>{label}</Text>
                <TextInput value={draft[key]} onChangeText={(value) => update(key, value)} placeholder="YYYY-MM-DD"
                  accessibilityLabel={label} autoCapitalize="none" maxLength={10} style={styles.input} />
              </View>)}
            </View>
            <Text style={styles.hint}>Includes both dates, using your device's timezone.</Text>
            {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          </View>}
          <View style={styles.section}>
            <Text style={styles.label}>Area</Text>
            <TextInput value={draft.area} onChangeText={(value) => update('area', value)} placeholder="e.g. Lohegaon or Lake Road"
              accessibilityLabel="Filter by area" maxLength={120} style={styles.input} returnKeyType="done" />
            <Text style={styles.hint}>Searches the report's address and landmark.</Text>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable onPress={() => setDraft(createReportFilters())} style={styles.reset} accessibilityRole="button">
            <Text style={styles.link}>Reset all</Text>
          </Pressable>
          <Pressable disabled={Boolean(error)} accessibilityRole="button" accessibilityState={{ disabled: Boolean(error) }}
            onPress={() => { setFilters({ ...draft, area: draft.area.trim() }); onClose(); }}
            style={[styles.apply, error && { opacity: 0.45 }]}>
            <Text style={styles.selectedText}>{source ? `Show ${count} report${count === 1 ? '' : 's'}` : 'Apply filters'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export default function ReportFilters({ map = false, compact = false }) {
  const { filters, filteredReports, mapReports, resetFilters, loading, error, source, refreshReports } = useReportExplorer();
  const [open, setOpen] = useState(false);
  const active = getActiveFilterCount(filters);
  const summary = getFilterSummary(filters);
  const count = map ? mapReports.length : filteredReports.length;
  const missing = filteredReports.length - mapReports.length;
  return <View style={[styles.toolbar, compact && styles.compactToolbar]}>
    <View style={styles.toolbarRow}>
      <Text style={[styles.count, styles.grow]} accessibilityLiveRegion="polite">
        {loading ? 'Loading reports…' : source === 'unavailable' ? 'Reports unavailable' : `${count} ${map ? 'on map' : `report${count === 1 ? '' : 's'}`}`}
      </Text>
      <Pressable onPress={() => setOpen(true)} style={[styles.filterButton, active > 0 && styles.selected]}
        accessibilityRole="button" accessibilityLabel={`Open report filters${active ? `, ${active} active` : ''}`}>
        <Ionicons name="options-outline" size={17} color={active ? '#fff' : '#007AFF'} />
        <Text style={[styles.link, active > 0 && styles.selectedText]}>Filters{active ? ` (${active})` : ''}</Text>
      </Pressable>
      {active > 0 && <Pressable onPress={resetFilters} style={styles.icon} accessibilityRole="button" accessibilityLabel="Clear all filters">
        <Ionicons name="close-circle-outline" size={23} color="#526072" />
      </Pressable>}
    </View>
    {summary ? <Text numberOfLines={compact ? undefined : 2} style={styles.hint}>{summary}</Text> : null}
    {!loading && !error && count === 0 && <Text style={styles.hint}>{active ? 'No matching reports. Change or clear the filters.' : 'No saved reports to show yet.'}</Text>}
    {map && missing > 0 && <Text style={styles.hint}>{missing} matching report{missing === 1 ? '' : 's'} without coordinates available in the list.</Text>}
    {error && <View style={styles.notice}>
      <Text style={[styles.hint, styles.grow]}>{source === 'cache' ? 'Showing saved results; refresh failed.' : 'Could not load reports. Check your connection.'}</Text>
      <Pressable onPress={refreshReports} disabled={loading} accessibilityRole="button" style={styles.reset}>
        <Text style={styles.link}>{loading ? 'Retrying…' : 'Retry'}</Text>
      </Pressable>
    </View>}
    {open && <FilterSheet onClose={() => setOpen(false)} />}
  </View>;
}

const styles = StyleSheet.create({
  toolbar: { backgroundColor: '#fff', padding: 12, gap: 5 },
  compactToolbar: { paddingVertical: 4 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { color: '#243447', fontWeight: '600', fontSize: 13 },
  grow: { flex: 1, minWidth: 0 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 42, borderRadius: 22, backgroundColor: '#edf5ff' },
  link: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  icon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#0006' },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: '#e9edf2' },
  title: { fontSize: 20, fontWeight: '700', color: '#1c1c1e' },
  hint: { color: '#627083', fontSize: 12, lineHeight: 18 },
  body: { padding: 20, gap: 20 },
  section: { gap: 8 },
  label: { color: '#243447', fontSize: 14, fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, borderRadius: 20, backgroundColor: '#f0f3f7' },
  choiceText: { color: '#334155', fontSize: 13, flexShrink: 1 },
  selected: { backgroundColor: '#007AFF' },
  selectedText: { color: '#fff', fontWeight: '600' },
  dates: { flexDirection: 'row', gap: 12 },
  input: { borderWidth: 1, borderColor: '#c9d3df', borderRadius: 10, padding: 12, minHeight: 44, color: '#1c1c1e', fontSize: 14 },
  error: { color: '#b42318', fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: '#e9edf2' },
  reset: { minHeight: 44, justifyContent: 'center' },
  apply: { flex: 1, backgroundColor: '#007AFF', borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
