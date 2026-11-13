import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getReportDetails } from '../utils/reportListing';
import ReportPhoto from './ReportPhoto';

function Field({ label, children }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{children}</Text></View>;
}

// Mount this modal only for the selected report; closing preserves the parent list.
export default function ReportDetailsModal({ report, onClose }) {
  const insets = useSafeAreaInsets();
  const [photoIndex, setPhotoIndex] = useState(0);
  const details = report ? getReportDetails(report) : null;
  const currentPhoto = details ? Math.min(photoIndex, Math.max(0, details.photos.length - 1)) : 0;

  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss report details" />
      <View style={[styles.sheet, { marginTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Report details</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close report details" style={styles.iconButton}>
            <Ionicons name="close" size={24} color="#1c1c1e" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {details ? <>
            <Text selectable style={styles.name}>{details.name}</Text>
            <View style={styles.badges}>
              <Text style={[styles.badge, { backgroundColor: details.category.color + '18', color: details.category.color }]}>{details.category.label}</Text>
              <Text style={[styles.badge, { backgroundColor: details.status.bg, color: details.status.color }]}>{details.status.label}</Text>
            </View>
            <ReportPhoto key={details.photos[currentPhoto] || 'none'} uri={details.photos[currentPhoto]}
              label={`Report photo ${currentPhoto + 1} of ${details.photos.length}`} style={styles.photo} />
            {details.photos.length > 0 && <View style={styles.photoControls}>
              <Pressable onPress={() => setPhotoIndex(currentPhoto - 1)} disabled={currentPhoto === 0} style={styles.iconButton}
                accessibilityRole="button" accessibilityLabel="Previous report photo">
                <Ionicons name="chevron-back" size={24} color={currentPhoto === 0 ? '#bac2cd' : '#007AFF'} />
              </Pressable>
              <Text style={styles.label} accessibilityLiveRegion="polite">Photo {currentPhoto + 1} of {details.photos.length}</Text>
              <Pressable onPress={() => setPhotoIndex(currentPhoto + 1)} disabled={currentPhoto >= details.photos.length - 1} style={styles.iconButton}
                accessibilityRole="button" accessibilityLabel="Next report photo">
                <Ionicons name="chevron-forward" size={24} color={currentPhoto >= details.photos.length - 1 ? '#bac2cd' : '#007AFF'} />
              </Pressable>
            </View>}
            <Field label="Description">{details.description}</Field>
            <Field label="Address">{details.address || 'Address unavailable'}</Field>
            <Field label="Landmark">{details.landmark || 'Not recorded'}</Field>
            <Field label="Reported on">{details.createdAt}</Field>
            <View style={styles.assessment}>
              <Field label="Severity">{details.severity.label}</Field>
              <Field label="Water depth">{details.waterDepth}</Field>
              <Field label="People affected">{details.peopleAffected}</Field>
              <Field label="Road access">{details.roadBlocked}</Field>
            </View>
            <Field label="Reported location">{details.coordinates
              ? `${details.coordinates.latitude.toFixed(6)}, ${details.coordinates.longitude.toFixed(6)}`
              : 'Coordinates unavailable'}</Field>
            {!!details.id && <Field label="Report ID">{details.id}</Field>}
          </> : <Text style={styles.value}>This report is no longer available. Close this window and refresh the list.</Text>}
        </ScrollView>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.done}><Text style={styles.doneText}>Back to reports</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#0006' },
  sheet: { backgroundColor: '#fff', width: '100%', maxWidth: 640, maxHeight: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e9edf2' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1c1c1e' },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 18 },
  name: { color: '#1c1c1e', fontSize: 24, fontWeight: '700', lineHeight: 30 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  photo: { width: '100%', height: 220 },
  photoControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -14 },
  field: { gap: 5, minWidth: 0 },
  label: { color: '#627083', fontSize: 12, fontWeight: '600' },
  value: { color: '#243447', fontSize: 14, lineHeight: 21 },
  assessment: { padding: 16, backgroundColor: '#f4f7fa', borderRadius: 14, gap: 14 },
  done: { marginHorizontal: 20, marginTop: 8, backgroundColor: '#007AFF', borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
