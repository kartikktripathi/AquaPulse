import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addPhotosToReport } from '../services/reportService';
import { calculateDistanceMeters } from '../utils/geo';
import { getReportCoordinates } from '../utils/nearbyReports';
import { getReportDetails } from '../utils/reportListing';
import ReportPhoto from './ReportPhoto';

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{children}</Text>
    </View>
  );
}

// Mount this modal only for the selected report; closing preserves the parent list.
export default function ReportDetailsModal({ report, userCoords, onClose, onPhotosUpdated }) {
  const insets = useSafeAreaInsets();
  const [photoIndex, setPhotoIndex] = useState(0);
  const details = report ? getReportDetails(report) : null;

  // Active photos list (starts with details.photos, updates as new photos are added)
  const [photos, setPhotos] = useState(() => (details ? details.photos : []));
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [coords, setCoords] = useState(userCoords || null);

  useEffect(() => {
    if (details) {
      setPhotos(details.photos);
      setPhotoIndex(0);
      setUploadSuccess(false);
    }
  }, [report?.id]);

  useEffect(() => {
    if (userCoords) {
      setCoords(userCoords);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted' && active) {
          const loc = await Location.getLastKnownPositionAsync();
          if (loc?.coords && active) {
            setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        }
      } catch (e) {}
    })();
    return () => { active = false; };
  }, [userCoords]);

  // Determine distance and 500m radius eligibility
  const targetCoords = details?.coordinates || getReportCoordinates(report);
  const activeUser = coords || userCoords;
  let distanceMeters = null;
  if (activeUser && targetCoords) {
    distanceMeters = calculateDistanceMeters(
      activeUser.latitude,
      activeUser.longitude,
      targetCoords.latitude,
      targetCoords.longitude,
      false
    );
  } else if (Number.isFinite(report?.distanceFromUser)) {
    distanceMeters = report.distanceFromUser;
  } else if (Number.isFinite(report?.distance)) {
    distanceMeters = report.distance;
  }

  const isWithin500m = distanceMeters !== null && distanceMeters <= 500;
  const currentPhoto = Math.min(photoIndex, Math.max(0, photos.length - 1));

  const handleUploadAssets = async (assets) => {
    if (!assets || assets.length === 0 || !details?.id) return;
    setIsUploading(true);
    setUploadSuccess(false);
    try {
      const payloads = assets.map((asset) => {
        if (asset.base64) {
          return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
        }
        return asset.uri;
      });

      const res = await addPhotosToReport(details.id, payloads);
      if (res && res.success) {
        setPhotos(res.photos);
        setPhotoIndex(res.photos.length - 1);
        setUploadSuccess(true);
        if (onPhotosUpdated) {
          onPhotosUpdated(res.report);
        }
        setTimeout(() => setUploadSuccess(false), 4000);
      } else {
        Alert.alert('Upload Failed', res?.error || 'Could not upload photo.');
      }
    } catch (err) {
      Alert.alert('Upload Failed', err?.message || 'Could not upload photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos of this water problem.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadAssets(result.assets);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera on this device.');
    }
  };

  const handleChoosePhotos = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Media library permission is required to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsMultipleSelection: true,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadAssets(result.assets);
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not access photo library.');
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss report details"
        />
        <View
          style={[styles.sheet, { marginTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}
          accessibilityViewIsModal>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Report details</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close report details"
              style={styles.iconButton}>
              <Ionicons name="close" size={24} color="#1c1c1e" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {details ? (
              <>
                <Text selectable style={styles.name}>{details.name}</Text>
                <View style={styles.badges}>
                  <Text style={[styles.badge, { backgroundColor: details.category.color + '18', color: details.category.color }]}>
                    {details.category.label}
                  </Text>
                  <Text style={[styles.badge, { backgroundColor: details.status.bg, color: details.status.color }]}>
                    {details.status.label}
                  </Text>
                  {isWithin500m && (
                    <Text style={[styles.badge, styles.withinBadge]}>
                      Within 500m circle
                    </Text>
                  )}
                </View>

                {/* Photo Viewer Carousel or Empty State */}
                {photos.length > 0 ? (
                  <>
                    <ReportPhoto
                      key={photos[currentPhoto] || 'none'}
                      uri={photos[currentPhoto]}
                      label={`Report photo ${currentPhoto + 1} of ${photos.length}`}
                      style={styles.photo}
                    />
                    {photos.length > 1 && (
                      <View style={styles.photoControls}>
                        <Pressable
                          onPress={() => setPhotoIndex(currentPhoto - 1)}
                          disabled={currentPhoto === 0}
                          style={styles.iconButton}
                          accessibilityRole="button"
                          accessibilityLabel="Previous report photo">
                          <Ionicons
                            name="chevron-back"
                            size={24}
                            color={currentPhoto === 0 ? '#bac2cd' : '#007AFF'}
                          />
                        </Pressable>
                        <Text style={styles.label} accessibilityLiveRegion="polite">
                          Photo {currentPhoto + 1} of {photos.length}
                        </Text>
                        <Pressable
                          onPress={() => setPhotoIndex(currentPhoto + 1)}
                          disabled={currentPhoto >= photos.length - 1}
                          style={styles.iconButton}
                          accessibilityRole="button"
                          accessibilityLabel="Next report photo">
                          <Ionicons
                            name="chevron-forward"
                            size={24}
                            color={currentPhoto >= photos.length - 1 ? '#bac2cd' : '#007AFF'}
                          />
                        </Pressable>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyPhotoBox}>
                    <Ionicons name="images-outline" size={32} color="#8e8e93" />
                    <Text style={styles.emptyPhotoText}>No photos attached to this report yet</Text>
                  </View>
                )}

                {/* 500m Reporting Zone Photo Contribution Card */}
                {isWithin500m ? (
                  <View style={styles.contributeCard}>
                    <View style={styles.contributeHeader}>
                      <View style={styles.withinRadiusBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                        <Text style={styles.withinRadiusText}>
                          Within 500m reporting circle ({Math.round(distanceMeters)}m away)
                        </Text>
                      </View>
                      <Text style={styles.contributeTitle}>Add Photo Evidence</Text>
                      <Text style={styles.contributeSubtitle}>
                        You are at the site of this water issue. Add live photos to verify and speed up municipal response.
                      </Text>
                    </View>

                    {isUploading ? (
                      <View style={styles.uploadingBox}>
                        <ActivityIndicator size="small" color="#007AFF" />
                        <Text style={styles.uploadingText}>Uploading photo to report...</Text>
                      </View>
                    ) : (
                      <View style={styles.actionRow}>
                        <Pressable
                          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                          onPress={handleTakePhoto}
                          accessibilityRole="button"
                          accessibilityLabel="Take photo with camera">
                          <Ionicons name="camera" size={18} color="#007AFF" />
                          <Text style={styles.actionButtonText}>Take Photo</Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                          onPress={handleChoosePhotos}
                          accessibilityRole="button"
                          accessibilityLabel="Choose photo from library">
                          <Ionicons name="images" size={18} color="#007AFF" />
                          <Text style={styles.actionButtonText}>Photo Library</Text>
                        </Pressable>
                      </View>
                    )}

                    {uploadSuccess && (
                      <View style={styles.successBanner}>
                        <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                        <Text style={styles.successBannerText}>New photo added to this report!</Text>
                      </View>
                    )}
                  </View>
                ) : distanceMeters !== null ? (
                  <View style={styles.radiusNotice}>
                    <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                    <Text style={styles.radiusNoticeText}>
                      Photos can only be contributed within the 500m reporting circle ({Math.round(distanceMeters) >= 1000 ? (distanceMeters / 1000).toFixed(1) + 'km' : Math.round(distanceMeters) + 'm'} away).
                    </Text>
                  </View>
                ) : null}

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
                <Field label="Reported location">
                  {details.coordinates
                    ? `${details.coordinates.latitude.toFixed(6)}, ${details.coordinates.longitude.toFixed(6)}`
                    : 'Coordinates unavailable'}
                </Field>
                {!!details.id && <Field label="Report ID">{details.id}</Field>}
              </>
            ) : (
              <Text style={styles.value}>
                This report is no longer available. Close this window and refresh the list.
              </Text>
            )}
          </ScrollView>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.done}>
            <Text style={styles.doneText}>Back to reports</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#0006' },
  sheet: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 640,
    maxHeight: '94%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#e9edf2',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1c1c1e' },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 18 },
  name: { color: '#1c1c1e', fontSize: 24, fontWeight: '700', lineHeight: 30 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  withinBadge: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
  },
  photo: { width: '100%', height: 220, borderRadius: 14 },
  emptyPhotoBox: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyPhotoText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  photoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -14,
  },
  contributeCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 12,
  },
  contributeHeader: {
    gap: 4,
  },
  withinRadiusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  withinRadiusText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700',
  },
  contributeTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  contributeSubtitle: {
    color: '#475569',
    fontSize: 12.5,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 12,
    height: 44,
  },
  actionButtonPressed: {
    backgroundColor: '#f0f7ff',
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  uploadingText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  successBannerText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  radiusNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radiusNoticeText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  field: { gap: 5, minWidth: 0 },
  label: { color: '#627083', fontSize: 12, fontWeight: '600' },
  value: { color: '#243447', fontSize: 14, lineHeight: 21 },
  assessment: { padding: 16, backgroundColor: '#f4f7fa', borderRadius: 14, gap: 14 },
  done: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
