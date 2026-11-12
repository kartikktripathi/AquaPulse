/**
 * src/app/reports-by-category.jsx
 * ────────────────────────────────
 * Category-wise Reports screen for AquaPulse.
 *
 * Shows all locally-available water issue reports with horizontal category
 * filter chips and polished report cards. Works safely with an empty cache
 * when the Express backend is offline.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEVERITY_META } from '../utils/severity';

import { getReportsFromDatabase } from '../services/reportService';
import {
  FILTER_CATEGORIES,
  formatReportDate,
  getAddressLine,
  getCategoryMeta,
  getStatusMeta,
  getUiCategoryId,
  parsePhotos,
  reportMatchesCategory,
} from '../utils/categoryMeta';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_CHIPS = FILTER_CATEGORIES; // includes 'all' as first entry

const SEVERITY_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'reported', label: getStatusMeta('reported').label },
  { id: 'review', label: getStatusMeta('review').label },
  { id: 'in_progress', label: getStatusMeta('in_progress').label },
  { id: 'fixed', label: getStatusMeta('fixed').label },
];

const DATE_CHIPS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7days', label: '7 days' },
  { id: '30days', label: '30 days' },
];

// ─── Standalone ReportCard Component ──────────────────────────────────────────

function ReportCard({ report }) {
  let name, addressLine, dateStr, description, firstPhoto, catMeta, statusMeta;
  try {
    name        = (typeof report.name === 'string' && report.name.trim()) || 'Untitled water issue';
    addressLine = getAddressLine(report) || 'Location details unavailable';
    dateStr     = formatReportDate(report.createdAt) || 'Date unavailable';
    description = typeof report.description === 'string' ? report.description.trim() : '';
    const photos = parsePhotos(report.photos);
    firstPhoto  = photos.length > 0 ? photos[0] : null;
    catMeta     = getCategoryMeta(report);
    statusMeta  = getStatusMeta(report.status);
  } catch (_) {
    return null; // Skip genuinely broken cards without crashing the list
  }

  return (
    <View style={styles.card}>
      {/* Left colour accent */}
      <View style={[styles.cardAccent, { backgroundColor: catMeta.color }]} />

      <View style={styles.cardBody}>
        {/* Category badge + Status badge */}
        <View style={styles.cardTopRow}>
          <View style={[styles.categoryBadge, { backgroundColor: catMeta.color + '18' }]}>
            <Ionicons name={catMeta.icon} size={13} color={catMeta.color} />
            <Text style={[styles.categoryBadgeText, { color: catMeta.color }]} numberOfLines={1}>
              {catMeta.label}
            </Text>
          </View>
          <View style={styles.cardBadgesRight}>
            {report.severity && SEVERITY_META[report.severity] && (
              <View style={[styles.statusBadge, { backgroundColor: SEVERITY_META[report.severity].bg }]}>
                <View style={[styles.statusDot, { backgroundColor: SEVERITY_META[report.severity].color }]} />
                <Text style={[styles.statusText, { color: SEVERITY_META[report.severity].color }]}>
                  {SEVERITY_META[report.severity].label}
                </Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Report name */}
        <Text style={styles.cardTitle} numberOfLines={2}>{name}</Text>

        {/* Address */}
        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={12} color="#8e8e93" />
          <Text style={styles.cardMetaText} numberOfLines={1}>{addressLine}</Text>
        </View>

        {/* Date */}
        <View style={styles.cardMeta}>
          <Ionicons name="time-outline" size={12} color="#8e8e93" />
          <Text style={styles.cardMetaText}>{dateStr}</Text>
        </View>

        {/* Description preview + optional thumbnail */}
        {(description.length > 0 || firstPhoto) && (
          <View style={styles.cardPreviewRow}>
            {description.length > 0 && (
              <Text style={styles.cardDescription} numberOfLines={2}>{description}</Text>
            )}
            {firstPhoto && (
              <Image
                source={{ uri: firstPhoto }}
                style={styles.cardThumb}
                accessibilityLabel="Report photo"
                onError={() => { /* silently ignore broken images */ }}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main screen component ────────────────────────────────────────────────────

export default function ReportsByCategory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [selectedChip, setSelectedChip] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState('all');

  const chipScrollRef = useRef(null);
  const chipOffsets   = useRef({});

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchReports = useCallback(async (isPullRefresh = false) => {
    if (!isPullRefresh) setLoading(true);
    setError(null);
    try {
      const data = await getReportsFromDatabase();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[ReportsByCategory] fetch error:', err);
      setError('Could not load reports. Please try again.');
      setReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchReports(false); }, [fetchReports]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReports(true);
  }, [fetchReports]);

  // ── Category chip counts ───────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts = { all: reports.length };
    for (const report of reports) {
      const uid = getUiCategoryId(report);
      counts[uid] = (counts[uid] || 0) + 1;
    }
    return counts;
  }, [reports]);

  // Show the "Other" chip only when there are reports that need it
  const visibleChips = useMemo(() => {
    const hasOther = (categoryCounts['other'] || 0) > 0;
    if (!hasOther) return BASE_CHIPS;
    return [
      ...BASE_CHIPS,
      { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#8E8E93' },
    ];
  }, [categoryCounts]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filteredReports = useMemo(() => {
    const now = Date.now();
    return reports.filter((r) => {
      if (!reportMatchesCategory(r, selectedChip)) return false;
      if (selectedSeverity !== 'all') {
        if (r.severity !== selectedSeverity) return false;
      }
      if (selectedStatus !== 'all') {
        if (r.status !== selectedStatus) return false;
      }
      if (selectedDate !== 'all') {
        if (!r.createdAt) return false;
        const createdMs = new Date(r.createdAt).getTime();
        if (isNaN(createdMs)) return false;
        const diffMs = now - createdMs;
        if (selectedDate === 'today') {
          if (diffMs > 86400000) return false;
        } else if (selectedDate === '7days') {
          if (diffMs > 7 * 86400000) return false;
        } else if (selectedDate === '30days') {
          if (diffMs > 30 * 86400000) return false;
        }
      }
      return true;
    });
  }, [reports, selectedChip, selectedSeverity, selectedStatus, selectedDate]);

  // ── Chip selection ─────────────────────────────────────────────────────────

  const handleChipPress = useCallback((chipId) => {
    setSelectedChip(chipId);
    const offset = chipOffsets.current[chipId];
    if (offset !== undefined && chipScrollRef.current) {
      chipScrollRef.current.scrollTo({ x: Math.max(0, offset - 16), animated: true });
    }
  }, []);

  // ── Back navigation ────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // ── Derived display helpers ────────────────────────────────────────────────

  const selectedCategoryMeta = useMemo(
    () => visibleChips.find((c) => c.id === selectedChip) || visibleChips[0],
    [selectedChip, visibleChips]
  );

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
        <Text style={styles.headerTitle} numberOfLines={1}>Reports by Category</Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>Explore water issues by type</Text>
      </View>
    </View>
  );

  const renderChipRow = () => (
    <ScrollView
      ref={chipScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRowContent}
      style={styles.chipRow}
      accessibilityRole="tablist">
      {visibleChips.map((chip) => {
        const isSelected = selectedChip === chip.id;
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
            accessibilityRole="tab"
            accessibilityLabel={`${chip.label}, ${count} reports`}
            accessibilityState={{ selected: isSelected }}>
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
          No {selectedCategoryMeta?.label || ''} reports found
        </Text>
        <Text style={styles.emptyBody}>
          There are no reports in this category yet. Try a different filter or
          check back later.
        </Text>
        <TouchableOpacity
          onPress={() => setSelectedChip('all')}
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

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.root}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading reports…</Text>
        </View>
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error && reports.length === 0) {
    return (
      <View style={styles.root}>
        {renderHeader()}
        {renderChipRow()}
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={60} color="#c7c7cc" />
          <Text style={styles.emptyTitle}>Could not load reports</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchReports(false)}
            activeOpacity={0.7}
            style={styles.emptyButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading reports">
            <Ionicons name="refresh-outline" size={18} color="#ffffff" />
            <Text style={styles.emptyButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Normal render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {renderHeader()}
      {renderChipRow()}

      {showFilters && (
        <View style={styles.filtersSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRowContent}
            style={styles.filterChipRow}>
            {SEVERITY_CHIPS.map((chip) => {
              const isSelected = selectedSeverity === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setSelectedSeverity(chip.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    isSelected && styles.filterChipSelected,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRowContent}
            style={styles.filterChipRow}>
            {STATUS_CHIPS.map((chip) => {
              const isSelected = selectedStatus === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setSelectedStatus(chip.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    isSelected && styles.filterChipSelected,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRowContent}
            style={styles.filterChipRow}>
            {DATE_CHIPS.map((chip) => {
              const isSelected = selectedDate === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setSelectedDate(chip.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    isSelected && styles.filterChipSelected,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Summary pill */}
      {reports.length > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {filteredReports.length === 0
              ? 'No results'
              : filteredReports.length === 1
              ? '1 report'
              : `${filteredReports.length} reports`}
            {selectedChip !== 'all' ? `  ·  ${selectedCategoryMeta?.label}` : ''}
          </Text>
          <Pressable
            onPress={() => setShowFilters((prev) => !prev)}
            style={({ pressed }) => [
              styles.filterToggleBtn,
              showFilters && styles.filterToggleBtnActive,
              pressed && { opacity: 0.6 },
            ]}>
            <Ionicons
              name="options-outline"
              size={13}
              color={showFilters ? '#ffffff' : '#007AFF'}
            />
            <Text
              style={[
                styles.filterToggleText,
                showFilters && styles.filterToggleTextActive,
              ]}>
              Filters
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={filteredReports}
        keyExtractor={(item, index) =>
          item.id != null ? String(item.id) : `report_${index}`
        }
        renderItem={({ item }) => <ReportCard report={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
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
    maxHeight: 54,
  },
  chipRowContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
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
    fontWeight: '500',
    color: '#3a3a3c',
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Summary row
  summaryRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#ffffff',
  },
  filterToggleBtnActive: {
    backgroundColor: '#007AFF',
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  filterToggleTextActive: {
    color: '#ffffff',
  },
  filtersSection: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    paddingVertical: 6,
    gap: 6,
  },
  filterChipRow: {
    maxHeight: 44,
  },
  filterChipRowContent: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },

  // List
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },

  // Report card
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardAccent: {
    width: 4,
    minHeight: 80,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    paddingLeft: 14,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
    flexShrink: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  cardBadgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    gap: 4,
    flexShrink: 0,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
    letterSpacing: -0.1,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: '#8e8e93',
    flex: 1,
  },
  cardPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  cardDescription: {
    flex: 1,
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },
  cardThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f2f2f7',
    flexShrink: 0,
  },

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
