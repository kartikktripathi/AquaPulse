import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEVERITY_META } from '../utils/severity';

import ReportFilters from '../components/ReportFilters';
import { useReportExplorer } from '../context/ReportExplorerContext';
import { filterReports, normalizeReportStatus } from '../utils/reportFilters';
import {
  FILTER_CATEGORIES,
  formatReportDate,
  getAddressLine,
  getCategoryMeta,
  getStatusMeta,
  getUiCategoryId,
  parsePhotos,
} from '../utils/categoryMeta';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_CHIPS = FILTER_CATEGORIES; // includes 'all' as first entry

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
    statusMeta  = getStatusMeta(normalizeReportStatus(report.status));
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

  const { reports, filteredReports, filters, setFilters, resetFilters, loading, error, refreshReports, now } = useReportExplorer();
  const chipScrollRef = useRef(null);
  const chipOffsets = useRef({});

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
        <Text style={styles.headerTitle} numberOfLines={1}>Reports by Category</Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>Select categories · filters also apply to the map</Text>
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
          No reports match this combination. Change your filters or clear them to see all reports.
        </Text>
        <TouchableOpacity
          onPress={resetFilters}
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
      {renderChipRow()}

      <ReportFilters />

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
            refreshing={loading}
            onRefresh={refreshReports}
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
