import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { confirmReport } from '../services/confirmationService.js';
import { formatNearbyDistance } from '../utils/nearbyReports.js';

export function DuplicateWarning({
  visible,
  matches = [],
  onConfirmExisting,
  onContinue,
  onCancel
}) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState(null);

  React.useEffect(() => {
    if (visible) {
      setIsSubmitting(false);
      setConfirmingId(null);
      setErrorText(null);
    }
  }, [visible]);

  const handleContinuePress = () => {
    if (isSubmitting || confirmingId) {
      return;
    }
    setIsSubmitting(true);
    if (onContinue) {
      onContinue();
    }
  };

  const handleConfirm = async (match) => {
    if (isSubmitting || confirmingId) {
      return;
    }
    const reportId = match.id || match.report?.id;
    if (!reportId) {
      return;
    }
    setConfirmingId(reportId);
    setErrorText(null);
    try {
      const res = await confirmReport(reportId);
      if (res && (res.success || res.alreadyConfirmed)) {
        if (onConfirmExisting) {
          onConfirmExisting(match);
        }
      } else {
        setErrorText(res?.error || 'Could not confirm report.');
      }
    } catch (e) {
      setErrorText('Could not confirm report.');
    } finally {
      setConfirmingId(null);
    }
  };

  const getStatusInfo = (status) => {
    if (status === 'fixed' || status === 'resolved') {
      return { bg: '#e8f5e9', color: '#34C759', label: 'Fixed' };
    }
    if (status === 'review' || status === 'verified') {
      return { bg: '#fff3e0', color: '#B45309', label: 'In Review' };
    }
    return { bg: '#e5e5ea', color: '#1c1c1e', label: 'Reported' };
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Similar reports nearby</Text>
          <Text style={styles.subtitle}>
            A report for this problem may already exist.
          </Text>

          {errorText ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {matches.map((item, idx) => {
              const report = item.report || item;
              const catLabel = item.categoryLabel || report.categoryLabel || report.category || 'Problem';
              const addr = item.addressLine1 || report.addressLine1 || 'Nearby location';
              const dist = item.distanceMeters !== undefined ? formatNearbyDistance(item.distanceMeters) : '';
              const statusInfo = getStatusInfo(item.status || report.status);
              const itemId = item.id || report.id || String(idx);
              const isConfirming = confirmingId === itemId;

              return (
                <View key={itemId} style={styles.matchCard}>
                  <View style={styles.matchHeader}>
                    <Text style={styles.categoryText}>{catLabel}</Text>
                    <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
                      <Text style={[styles.badgeText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.addressText} numberOfLines={2}>{addr}</Text>
                  {dist ? <Text style={styles.distanceText}>{dist} away</Text> : null}

                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmButton,
                      pressed && styles.pressed,
                      isConfirming && styles.disabledButton
                    ]}
                    disabled={isConfirming}
                    onPress={() => handleConfirm(item)}
                  >
                    {isConfirming ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Same problem, confirm it</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.continueButton,
                pressed && !isSubmitting && !confirmingId && styles.pressed,
                (isSubmitting || confirmingId) && styles.disabledButton
              ]}
              disabled={isSubmitting || !!confirmingId}
              onPress={handleContinuePress}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.continueButtonText}>It is different, continue</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              disabled={isSubmitting || !!confirmingId}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 20
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 16
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '500'
  },
  list: {
    maxHeight: 320
  },
  listContent: {
    gap: 12
  },
  matchCard: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 14,
    gap: 6
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
    flex: 1
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  addressText: {
    fontSize: 13,
    color: '#1c1c1e'
  },
  distanceText: {
    fontSize: 12,
    color: '#8e8e93'
  },
  confirmButton: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmButtonText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600'
  },
  footer: {
    marginTop: 16,
    gap: 8
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  cancelButton: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#1c1c1e',
    fontSize: 14,
    fontWeight: '500'
  },
  pressed: {
    opacity: 0.8
  },
  disabledButton: {
    opacity: 0.6
  }
});

export default DuplicateWarning;

