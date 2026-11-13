import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Linking, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNearbyLocation } from '../services/nearbyLocation';
import { getReportsSnapshot } from '../services/reportService';
import { FILTER_CATEGORIES, formatReportDate, getCategoryMeta, getStatusMeta } from '../utils/categoryMeta';
import {
  NEARBY_RADII, filterNearbyReports, formatNearbyDistance, getNearbyPhotoUri, locateReports,
} from '../utils/nearbyReports';
import { SEVERITY_META } from '../utils/severity';

const CATEGORY_CHIPS = [
  { ...FILTER_CATEGORIES[0], label: 'All categories' },
  ...FILTER_CATEGORIES.slice(1),
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#8E8E93' },
];

function Action({ label, onPress, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, secondary && styles.secondaryAction, pressed && styles.pressed]}>
      <Text style={[styles.actionText, secondary && styles.secondaryActionText]}>{label}</Text>
    </Pressable>
  );
}

function NearbyCard({ item }) {
  const { report, distanceMeters } = item;
  const category = getCategoryMeta(report);
  const status = getStatusMeta(report.status);
  const severity = Object.hasOwn(SEVERITY_META, report.severity) ? SEVERITY_META[report.severity] : null;
  const photoUri = getNearbyPhotoUri(report.photos);
  const [failedPhoto, setFailedPhoto] = useState(null);

  return (
    <View style={[styles.card, { borderLeftColor: category.color }]}>
      <View style={styles.cardHeading}>
        <View style={styles.categoryLabel}>
          <Ionicons name={category.icon} color={category.color} size={16} />
          <Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text>
        </View>
        <Text style={styles.distance}>{formatNearbyDistance(distanceMeters)} away</Text>
      </View>
      <Text style={styles.cardTitle}>{report.name}</Text>
      <View style={styles.badges}>
        <Text style={[styles.badge, { color: status.color, backgroundColor: status.bg }]}>{status.label}</Text>
        {severity && (
          <Text style={[styles.badge, { color: severity.color, backgroundColor: severity.bg }]}>
            {severity.label} severity
          </Text>
        )}
      </View>
      <Text style={styles.meta} numberOfLines={2}>
        {report.addressLine1 || report.landmark || 'Location details unavailable'}
      </Text>
      <Text style={styles.meta}>{formatReportDate(report.createdAt) || 'Date unavailable'}</Text>
      <View style={styles.preview}>
        {!!report.description && <Text style={styles.description} numberOfLines={3}>{report.description}</Text>}
        {photoUri && photoUri !== failedPhoto && (
          <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel={`Photo of ${report.name}`}
            onError={() => setFailedPhoto(photoUri)} />
        )}
      </View>
    </View>
  );
}

export default function NearbyReports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [categoryId, setCategoryId] = useState('all');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [snapshot, setSnapshot] = useState({ reports: [], source: 'unavailable', fetchedAt: null });
  const requestRef = useRef(null);

  const load = useCallback(async (refresh = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(!refresh);
    setRefreshing(refresh);
    const [position, reports] = await Promise.allSettled([
      getNearbyLocation({ signal: controller.signal }),
      getReportsSnapshot({ signal: controller.signal }),
    ]);
    if (controller.signal.aborted) return;
    setLocation(position.status === 'fulfilled' ? position.value : null);
    setLocationError(position.status === 'rejected' ? position.reason : null);
    setSnapshot(reports.status === 'fulfilled' ? reports.value : {
      reports: [], source: 'unavailable', fetchedAt: null,
    });
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]));

  const handleBack = () => router.canGoBack() ? router.back() : router.replace('/');
  const resetFilters = () => {
    setCategoryId('all');
    setIncludeResolved(false);
  };
  const { located, skippedCount } = useMemo(() => locateReports(snapshot.reports, location), [snapshot.reports, location]);
  const nearby = useMemo(() => filterNearbyReports(located, { radiusMeters, categoryId, includeResolved }),
    [located, radiusMeters, categoryId, includeResolved]);
  const inRadius = useMemo(() => located.filter((item) => item.distanceMeters <= radiusMeters), [located, radiusMeters]);
  const radiusLabel = NEARBY_RADII.find((radius) => radius.meters === radiusMeters).label;
  const counts = useMemo(() => {
    const result = { all: 0 };
    inRadius.forEach((item) => {
      if (!includeResolved && item.report.status === 'fixed') return;
      result.all += 1;
      result[item.categoryId] = (result[item.categoryId] || 0) + 1;
    });
    return result;
  }, [inRadius, includeResolved]);

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      setLocationError(new Error('Open device Settings, allow location for AquaPulse, then return and tap Try again.'));
    }
  };

  const renderEmpty = () => {
    if (loading) return (
      <View style={styles.empty}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.emptyTitle}>Finding reports near you…</Text>
        <Text style={styles.body}>Checking your location and loading reports.</Text>
      </View>
    );
    if (locationError) return (
      <View style={styles.empty}>
        <Ionicons name="location-outline" size={48} color="#007AFF" />
        <Text style={styles.emptyTitle}>Your location is needed</Text>
        <Text style={styles.body}>{locationError.message || 'Could not find your location. Please try again.'}</Text>
        {Platform.OS === 'web' && (
          <Text style={styles.body}>Allow location in your browser's site settings. Location works on HTTPS or localhost.</Text>
        )}
        {Platform.OS !== 'web' && locationError.code === 'permission' && locationError.canAskAgain === false && (
          <Action label="Open app settings" onPress={openSettings} />
        )}
        <Action label="Try again" onPress={() => load()} />
        <Action label="Back to map" onPress={handleBack} secondary />
      </View>
    );
    if (snapshot.source === 'unavailable') return (
      <View style={styles.empty}>
        <Ionicons name="cloud-offline-outline" size={48} color="#8E8E93" />
        <Text style={styles.emptyTitle}>Reports are unavailable</Text>
        <Text style={styles.body}>{snapshot.error || "We couldn't reach the reports service. Check your connection and try again."}</Text>
        <Action label="Retry loading reports" onPress={() => load()} />
        <Action label="Back to map" onPress={handleBack} secondary />
      </View>
    );
    const hasFilters = categoryId !== 'all' || includeResolved;
    return (
      <View style={styles.empty}>
        <Ionicons name="search-outline" size={48} color="#8E8E93" />
        <Text style={styles.emptyTitle}>{inRadius.length ? 'No matching reports' : `No reports within ${radiusLabel}`}</Text>
        <Text style={styles.body}>
          {inRadius.length ? 'Try another category or include resolved issues.' : 'Try a larger distance or check back after new reports are submitted.'}
        </Text>
        {hasFilters && <Action label="Reset filters" onPress={resetFilters} />}
        {!includeResolved && inRadius.length > 0 && (
          <Action label="Include resolved reports" onPress={() => setIncludeResolved(true)} secondary />
        )}
        {radiusMeters < 10000 && (
          <Action label="Search a larger area" onPress={() => setRadiusMeters(NEARBY_RADII.find((r) => r.meters > radiusMeters).meters)} secondary />
        )}
        <Action label="Back to map" onPress={handleBack} secondary />
      </View>
    );
  };

  const canBrowse = !loading && !!location && snapshot.source !== 'unavailable';
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to map" onPress={handleBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </Pressable>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>Nearby Reports</Text>
          <Text style={styles.subtitle}>Water issues around your current location</Text>
        </View>
      </View>
      <FlatList
        data={canBrowse ? nearby : []}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <NearbyCard item={item} />}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={(
          <View>
            <View style={styles.locationPanel}>
              <Ionicons name="navigate-circle" size={28} color="#007AFF" />
              <View style={styles.headerText}>
                <Text style={styles.locationTitle}>{location ? 'Using your device location' : 'Find issues near you'}</Text>
                <Text style={styles.subtitle}>Approximate straight-line distances · nearest first</Text>
                {location && location.accuracy !== null && (
                  <Text style={styles.subtitle}>GPS accuracy: about {formatNearbyDistance(location.accuracy)}</Text>
                )}
              </View>
            </View>
            <Text style={styles.sectionLabel}>Search distance</Text>
            <View style={styles.radiusRow}>
              {NEARBY_RADII.map((radius) => (
                <Pressable key={radius.meters} onPress={() => setRadiusMeters(radius.meters)}
                  accessibilityRole="button" accessibilityLabel={`Search within ${radius.label}`}
                  accessibilityState={{ selected: radiusMeters === radius.meters }}
                  style={({ pressed }) => [styles.radiusChip, radiusMeters === radius.meters && styles.selected, pressed && styles.pressed]}>
                  <Text style={[styles.chipText, radiusMeters === radius.meters && styles.selectedText]}>{radius.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>Browsing distance only. New reports still use the map's 500 m reporting zone.</Text>
            {canBrowse && (
              <View>
                <Text style={styles.sectionLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                  {CATEGORY_CHIPS.map((category) => (
                    <Pressable key={category.id} onPress={() => setCategoryId(category.id)}
                      accessibilityRole="button" accessibilityLabel={`${category.label}, ${counts[category.id] || 0} reports`}
                      accessibilityState={{ selected: categoryId === category.id }}
                      style={({ pressed }) => [styles.categoryChip, categoryId === category.id && styles.selected, pressed && styles.pressed]}>
                      <Ionicons name={category.icon} size={15} color={categoryId === category.id ? '#FFFFFF' : category.color} />
                      <Text style={[styles.chipText, categoryId === category.id && styles.selectedText]}>
                        {category.label} · {counts[category.id] || 0}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Include resolved reports</Text>
                  <Switch value={includeResolved} onValueChange={setIncludeResolved}
                    accessibilityLabel="Include resolved reports" trackColor={{ false: '#D1D1D6', true: '#007AFF' }} />
                </View>
                {snapshot.source === 'cache' && (
                  <View style={styles.notice}>
                    <Text style={styles.noticeText}>The service is unavailable. Showing previously loaded reports
                      {snapshot.fetchedAt ? ` (${formatReportDate(snapshot.fetchedAt)})` : ''}; they may have changed.</Text>
                    <Action label="Retry connection" onPress={() => load()} secondary />
                  </View>
                )}
                {location.accuracy > radiusMeters && (
                  <Text style={styles.noticeText}>Your location is less precise than this search distance. Try refreshing outdoors or choose a larger area.</Text>
                )}
                {skippedCount > 0 && (
                  <Text style={styles.hint}>{skippedCount} {skippedCount === 1 ? 'report has' : 'reports have'} no usable location and cannot be placed nearby.</Text>
                )}
                <View style={styles.resultRow}>
                  <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
                    {nearby.length} {nearby.length === 1 ? 'report' : 'reports'} within {radiusLabel}
                  </Text>
                  <Pressable onPress={resetFilters} accessibilityRole="button" style={styles.resetButton}>
                    <Text style={styles.resetText}>Reset filters</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={['#007AFF']} tintColor="#007AFF" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: '#FFFFFF' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#F2F2F7' },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 21, fontWeight: '700', color: '#1C1C1E' },
  subtitle: { fontSize: 12, lineHeight: 18, color: '#636366', marginTop: 3 },
  content: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16 },
  locationPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#EAF3FF', borderRadius: 16, marginBottom: 20 },
  locationTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#48484A', marginBottom: 10 },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusChip: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D1D6', backgroundColor: '#FFFFFF' },
  selected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { color: '#3A3A3C', fontSize: 13, fontWeight: '500' },
  selectedText: { color: '#FFFFFF', fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 18, color: '#636366', marginVertical: 12 },
  categoryRow: { gap: 8, paddingBottom: 12 },
  categoryChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D1D1D6', borderRadius: 22, backgroundColor: '#FFFFFF' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  switchLabel: { flex: 1, fontSize: 14, color: '#3A3A3C' },
  notice: { padding: 14, backgroundColor: '#FFF8ED', borderRadius: 12, marginVertical: 12 },
  noticeText: { fontSize: 13, lineHeight: 20, color: '#805400' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  resultCount: { fontSize: 13, fontWeight: '600', color: '#48484A' },
  resetButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  resetText: { color: '#007AFF', fontWeight: '600', fontSize: 13 },
  card: { padding: 16, borderRadius: 14, borderLeftWidth: 4, backgroundColor: '#FFFFFF', marginBottom: 12 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  categoryLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  categoryText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  distance: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  cardTitle: { fontSize: 17, lineHeight: 23, fontWeight: '600', color: '#1C1C1E', marginTop: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  meta: { color: '#636366', fontSize: 12, lineHeight: 19 },
  preview: { flexDirection: 'row', gap: 12, marginTop: 8 },
  description: { flex: 1, fontSize: 13, lineHeight: 20, color: '#48484A' },
  photo: { width: 68, height: 68, borderRadius: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 12, gap: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1C1C1E', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 22, color: '#636366', textAlign: 'center', maxWidth: 400 },
  action: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#007AFF', alignItems: 'center', marginTop: 8 },
  secondaryAction: { backgroundColor: '#EAF3FF' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  secondaryActionText: { color: '#007AFF' },
  pressed: { opacity: 0.65 },
});
