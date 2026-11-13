import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportCard from './ReportCard';
import ReportDetailsModal from './ReportDetailsModal';
import { REPORT_SORT_OPTIONS, searchAndSortReports } from '../utils/reportListing';

import ReportFilters from './ReportFilters';
import { useReportExplorer } from '../context/ReportExplorerContext';
import { filterReports } from '../utils/reportFilters';
import {
  FILTER_CATEGORIES,
  getUiCategoryId,
} from '../utils/categoryMeta';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_CHIPS = FILTER_CATEGORIES; // includes 'all' as first entry

// ─── Main screen component ────────────────────────────────────────────────────

export default function ReportsScreen({ categoryMode = false }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { reports, filteredReports, filters, setFilters, resetFilters, loading, error, refreshReports, now } = useReportExplorer();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [selection, setSelection] = useState(null);
  const listedReports = useMemo(() => searchAndSortReports(filteredReports, query, sort), [filteredReports, query, sort]);
  const selectedReport = selection ? reports.find((report) => report === selection || (selection.id != null && report.id === selection.id)) : null;
  const clearSearchAndFilters = () => { setQuery(''); resetFilters(); };
  const chipScrollRef = useRef(null);
  const chipOffsets = useRef({});
  const listRef = useRef(null);

  useEffect(() => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [query, sort, filters]);

  useFocusEffect(useCallback(() => { refreshReports(); }, [refreshReports]));

  // ── Category chip counts ───────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const candidates = filterReports(reports, { ...filters, categories: [] }, now);
    const counts = { all: candidates.length };
    for (const report of candidates) {
      const uid = getUiCategoryId(report);
      counts[uid] = (counts[uid] || 0) + 1;
    }
    return counts;
  }, [reports, filters, now]);

  // Show the "Other" chip only when there are reports that need it
  const visibleChips = useMemo(() => {
    const hasOther = reports.some((r) => getUiCategoryId(r) === 'other') || filters.categories.includes('other');
    if (!hasOther) return BASE_CHIPS;
    return [
      ...BASE_CHIPS,
      { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#8E8E93' },
    ];
  }, [reports, filters.categories]);

  // Quick category chips use the same multi-selection as the filter sheet.
  const handleChipPress = useCallback((chipId) => {
    setFilters((old) => ({ ...old, categories: chipId === 'all' ? [] : old.categories.includes(chipId)
      ? old.categories.filter((id) => id !== chipId) : [...old.categories, chipId] }));
    const offset = chipOffsets.current[chipId];
    if (offset !== undefined) chipScrollRef.current?.scrollTo({ x: Math.max(0, offset - 16), animated: true });
  }, [setFilters]);

  // ── Back navigation ────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // ── Render Helpers ─────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View
      style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 16 : 10) }]}
      accessibilityRole="header">
      <TouchableOpacity
        onPress={handleBack}
        activeOpacity={0.6}
        style={styles.backButton}
        accessibilityLabel="Go back to map"
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="chevron-back" size={24} color="#1c1c1e" />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle} numberOfLines={1}>{categoryMode ? 'Reports by Category' : 'All Reports'}</Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>{categoryMode ? 'Browse by type and open a report for details' : 'Browse reported water issues'}</Text>
      </View>
      <TouchableOpacity onPress={refreshReports} disabled={loading} style={styles.backButton}
        accessibilityRole="button" accessibilityLabel="Refresh reports">
        {loading ? <ActivityIndicator size="small" color="#007AFF" /> : <Ionicons name="refresh" size={22} color="#007AFF" />}
      </TouchableOpacity>
    </View>
  );

  const renderChipRow = () => (
    <ScrollView
      ref={chipScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRowContent}
      style={styles.chipRow}
      >
      {visibleChips.map((chip) => {
        const isSelected = chip.id === 'all' ? !filters.categories.length : filters.categories.includes(chip.id);
        const count = categoryCounts[chip.id] ?? 0;
        return (
          <TouchableOpacity
            key={chip.id}
            onLayout={(e) => { chipOffsets.current[chip.id] = e.nativeEvent.layout.x; }}
            onPress={() => handleChipPress(chip.id)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              isSelected && { backgroundColor: chip.color, borderColor: chip.color },
            ]}
            accessibilityRole="checkbox"
            accessibilityLabel={`${chip.label}, ${count} reports`}
            accessibilityState={{ checked: isSelected }}
            aria-checked={isSelected}>
            <Ionicons
              name={chip.icon}
              size={14}
              color={isSelected ? '#ffffff' : chip.color}
              style={styles.chipIcon}
            />
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {chip.label}{' · '}{count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderEmpty = () => {
    if (loading) return <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading reports…</Text>
    </View>;
    if (error && reports.length === 0) return <View style={styles.emptyContainer}>
      <Ionicons name="cloud-offline-outline" size={60} color="#c7c7cc" />
      <Text style={styles.emptyTitle}>Could not load reports</Text>
      <Text style={styles.emptyBody}>{error}</Text>
      <TouchableOpacity onPress={refreshReports} style={styles.emptyButton} accessibilityRole="button">
        <Text style={styles.emptyButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>;

    if (reports.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="water-outline" size={64} color="#c7c7cc" />
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptyBody}>
            Be the first to report a water issue in your area. Your report helps
            the community and municipal authorities track problems faster.
          </Text>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            style={styles.emptyButton}
            accessibilityRole="button"
            accessibilityLabel="Go back to map to submit a report">
            <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
            <Text style={styles.emptyButtonText}>Submit a Report</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="filter-outline" size={56} color="#c7c7cc" />
        <Text style={styles.emptyTitle}>
          No matching reports
        </Text>
        <Text style={styles.emptyBody}>
          No reports match your search and filters. Try another search or clear both to see all reports.
        </Text>
        <TouchableOpacity
          onPress={clearSearchAndFilters}
          activeOpacity={0.7}
          style={styles.emptyButton}
          accessibilityRole="button"
          accessibilityLabel="View all reports">
          <Ionicons name="apps-outline" size={18} color="#ffffff" />
          <Text style={styles.emptyButtonText}>View all reports</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Normal render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {renderHeader()}
      <FlatList
        ref={listRef}
        style={styles.list}
        ListHeaderComponent={<View style={styles.controls}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color="#627083" />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search reports or location"
              accessibilityLabel="Search reports" style={styles.searchInput} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} maxLength={160} />
            {!!query && <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear report search" style={styles.clearSearch}>
              <Ionicons name="close-circle" size={22} color="#627083" />
            </TouchableOpacity>}
          </View>
          {categoryMode && renderChipRow()}
          <ReportFilters compact />
          <View style={styles.listTools}>
            <ScrollView horizontal style={styles.sortScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
              {REPORT_SORT_OPTIONS.map((option) => <TouchableOpacity key={option.id} onPress={() => setSort(option.id)}
                accessibilityRole="radio" accessibilityLabel={`Sort reports: ${option.label}`} aria-checked={sort === option.id}
                accessibilityState={{ checked: sort === option.id }} style={[styles.sortChip, sort === option.id && styles.sortSelected]}>
                <Text style={[styles.sortText, sort === option.id && { color: '#007AFF' }]}>{option.label}</Text>
              </TouchableOpacity>)}
            </ScrollView>
            {!!query.trim() && <Text style={styles.resultCount} accessibilityLiveRegion="polite">
              {listedReports.length} of {filteredReports.length} match this search
            </Text>}
          </View>

        </View>}
        data={listedReports}
        keyExtractor={(item, index) =>
          item.id != null ? String(item.id) : `report_${index}`
        }
        renderItem={({ item }) => <ReportCard report={item} onPress={() => { Keyboard.dismiss(); setSelection(item); }} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshReports}
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
      {selection && (
        <ReportDetailsModal
          report={selectedReport}
          onClose={() => setSelection(null)}
          onPhotosUpdated={refreshReports}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1c1e',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 1,
  },

  // Chip row
  chipRow: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    flexGrow: 0,
    flexShrink: 0,
  },
  chipRowContent: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    minHeight: 44,
    flexShrink: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    backgroundColor: '#f9f9fb',
    gap: 4,
  },
  chipIcon: {
    marginRight: 1,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: '#3a3a3c',
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Controls live inside the list so short screens and large text never compress them.
  list: { flex: 1 },
  controls: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, paddingBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5eaf0' },

  // List
  listContent: {
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
  },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ed', borderRadius: 14, paddingLeft: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 10, paddingRight: 8, fontSize: 14, color: '#243447' },
  clearSearch: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  listTools: { gap: 6, paddingTop: 4 },
  sortScroll: { flexGrow: 0, flexShrink: 0 },
  sortRow: { paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center', gap: 8 },
  sortChip: { paddingHorizontal: 12, minHeight: 44, paddingVertical: 10, flexShrink: 0, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#dbe3ed' },
  sortSelected: { backgroundColor: '#e7f1ff', borderColor: '#b2d2ff' },
  sortText: { color: '#627083', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  resultCount: { paddingHorizontal: 16, color: '#627083', fontSize: 12 },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    color: '#8e8e93',
    fontWeight: '500',
  },

  // Empty / Error
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1c1e',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 22,
    gap: 8,
    marginTop: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
