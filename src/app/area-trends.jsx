import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReportExplorer } from '../context/ReportExplorerContext.jsx';
import { buildAreaTrends } from '../utils/areaTrends.js';

export default function AreaTrendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reports, loading, refreshReports, now } = useReportExplorer();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const trends = useMemo(function () {
    return buildAreaTrends(reports, now);
  }, [reports, now]);

  const worseAreas = useMemo(function () {
    return trends.filter(function (item) {
      return item.change > 0;
    });
  }, [trends]);

  const renderContent = () => {
    if (reports.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="#8e8e93" />
          <Text style={styles.emptyTitle}>No reports yet</Text>
        </View>
      );
    }

    if (worseAreas.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color="#34C759" />
          <Text style={styles.emptyTitle}>No area has more reports than last week</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Areas getting worse</Text>
        {worseAreas.map(function (item) {
          const changeText = item.change > 0 ? '+' + item.change : String(item.change);
          const avgText = Number.isInteger(item.fourWeekAverage)
            ? String(item.fourWeekAverage)
            : item.fourWeekAverage.toFixed(1);

          return (
            <View key={item.area} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.areaName} numberOfLines={1}>
                  {item.area}
                </Text>
                <View style={styles.changeBadge}>
                  <Text style={styles.changeBadgeText}>{changeText}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>This week {item.thisWeek}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Last week {item.lastWeek}</Text>
                </View>
              </View>

              <Text style={styles.averageText}>4-week average {avgText}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.6}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1c1c1e" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>Areas Getting Worse</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>Weekly change in reports</Text>
        </View>
        <TouchableOpacity
          onPress={refreshReports}
          disabled={loading}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Refresh reports"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="refresh" size={22} color="#007AFF" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f2f2f7'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    elevation: 3
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    marginRight: 10
  },
  headerTitleWrap: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1c1e',
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 1
  },
  content: {
    padding: 16
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 4
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  areaName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    flex: 1,
    marginRight: 12
  },
  changeBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  changeBadgeText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '700'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16
  },
  statBox: {
    backgroundColor: '#f2f2f7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  statLabel: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '500'
  },
  averageText: {
    fontSize: 13,
    color: '#8e8e93',
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12
  },
  emptyTitle: {
    fontSize: 15,
    color: '#8e8e93',
    fontWeight: '600',
    textAlign: 'center'
  }
});

