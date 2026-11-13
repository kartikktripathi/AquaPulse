import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getReportDetails } from '../utils/reportListing';
import ReportPhoto from './ReportPhoto';

export default function ReportCard({ report, onPress }) {
  const details = getReportDetails(report);
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open report: ${details.name}`}
    accessibilityHint="Opens the full description, photos and report details"
    style={({ pressed }) => [styles.card, { borderLeftColor: details.category.color }, pressed && { opacity: 0.75 }]}>
    <View style={styles.badges}>
      <Text style={[styles.badge, { color: details.category.color, backgroundColor: details.category.color + '18' }]}>{details.category.label}</Text>
      <Text style={[styles.badge, { color: details.status.color, backgroundColor: details.status.bg }]}>{details.status.label}</Text>
      <Text style={[styles.badge, { color: details.severity.color, backgroundColor: details.severity.bg }]}>
        {details.severity.label === 'Not recorded' ? 'Severity not recorded' : `${details.severity.label} severity`}
      </Text>
    </View>
    <Text style={styles.title} numberOfLines={2}>{details.name}</Text>
    <View style={styles.preview}>
      <View style={styles.grow}>
        <Text numberOfLines={2} style={styles.meta}>{details.address || details.landmark || 'Location details unavailable'}</Text>
        <Text style={styles.meta}>{details.createdAt}</Text>
        <Text numberOfLines={2} style={styles.description}>{details.description}</Text>
      </View>
      {!!details.photos.length && <ReportPhoto key={details.photos[0]} uri={details.photos[0]} compact style={styles.thumbnail} />}
    </View>
    <View style={styles.action}><Text style={styles.actionText}>View details</Text><Ionicons name="chevron-forward" size={16} color="#007AFF" /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { padding: 14, borderLeftWidth: 4, backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, gap: 10, borderWidth: 1, borderColor: '#e9edf2' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { fontSize: 11, fontWeight: '600', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, flexShrink: 1 },
  title: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  preview: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1, minWidth: 0, gap: 5 },
  meta: { color: '#627083', fontSize: 12, lineHeight: 17 },
  description: { color: '#334155', fontSize: 13, lineHeight: 19 },
  thumbnail: { width: 70, height: 70 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  actionText: { fontSize: 12, fontWeight: '600', color: '#007AFF' },
});
