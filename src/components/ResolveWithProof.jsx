import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { resolveReportWithProof } from '../services/resolutionService.js';

export function ResolveWithProof({ report, userCoords, onResolved }) {
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleProcessAsset = async (asset) => {
    if (!asset) {
      return;
    }
    setIsResolving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = {
        uri: asset.base64
          ? 'data:' + (asset.mimeType || 'image/jpeg') + ';base64,' + asset.base64
          : asset.uri,
        mimeType: asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg'),
        base64: asset.base64 || null
      };
      const res = await resolveReportWithProof(report, payload, userCoords);
      if (res && res.success) {
        setSuccessMessage('Issue marked as fixed with proof.');
        if (onResolved) {
          onResolved(res.report);
        }
      } else {
        setErrorMessage(res?.error || 'Could not resolve report.');
      }
    } catch (e) {
      setErrorMessage(e?.message || 'Could not resolve report.');
    } finally {
      setIsResolving(false);
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
        quality: 0.5,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleProcessAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera on this device.');
    }
  };

  const handleChoosePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Media library permission is required to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        allowsMultipleSelection: false,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleProcessAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not access photo library.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Mark as Fixed with Proof</Text>
        <Text style={styles.subtitle}>
          Add a photo of the completed repair to verify the resolution.
        </Text>
      </View>

      {isResolving ? (
        <View style={styles.uploadingBox}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.uploadingText}>Submitting resolution proof...</Text>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={handleTakePhoto}
          >
            <Ionicons name="camera" size={18} color="#007AFF" />
            <Text style={styles.actionButtonText}>Take after photo</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={handleChoosePhoto}
          >
            <Ionicons name="images" size={18} color="#007AFF" />
            <Text style={styles.actionButtonText}>Choose after photo</Text>
          </Pressable>
        </View>
      )}

      {successMessage ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
          <Text style={styles.successBannerText}>{successMessage}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={15} color="#FF3B30" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 12
  },
  header: {
    gap: 4
  },
  title: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  subtitle: {
    color: '#475569',
    fontSize: 12.5,
    lineHeight: 18
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
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
    height: 44
  },
  actionButtonPressed: {
    backgroundColor: '#f0f7ff'
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600'
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12
  },
  uploadingText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600'
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8
  },
  successBannerText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8
  },
  errorBannerText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '500'
  }
});

export default ResolveWithProof;

