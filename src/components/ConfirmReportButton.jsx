import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { confirmReport, getConfirmationCount, hasUserConfirmed } from '../services/confirmationService.js';

export function ConfirmReportButton({ reportId }) {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let active = true;
    if (reportId) {
      getConfirmationCount(reportId).then(function (cnt) {
        if (active && cnt !== null) {
          setCount(cnt);
        }
      });
      hasUserConfirmed(reportId).then(function (has) {
        if (active && has) {
          setAlreadyConfirmed(true);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [reportId]);

  const handlePress = async () => {
    if (!reportId || loading || confirmed || alreadyConfirmed) {
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await confirmReport(reportId);
      if (res && res.alreadyConfirmed) {
        setAlreadyConfirmed(true);
        if (res.count !== null && res.count !== undefined) {
          setCount(res.count);
        }
      } else if (res && res.success) {
        setConfirmed(true);
        setCount(res.count);
      } else {
        setErrorMessage(res?.error || 'Could not confirm report.');
      }
    } catch (e) {
      setErrorMessage(e?.message || 'Could not confirm report.');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || confirmed || alreadyConfirmed;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabledButton
        ]}
        onPress={handlePress}
        disabled={isDisabled}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <>
            <Ionicons
              name={confirmed || alreadyConfirmed ? 'checkmark-circle' : 'thumbs-up-outline'}
              size={18}
              color={confirmed || alreadyConfirmed ? '#34C759' : '#007AFF'}
            />
            <Text
              style={[
                styles.buttonText,
                (confirmed || alreadyConfirmed) && styles.confirmedButtonText
              ]}
            >
              {confirmed || alreadyConfirmed ? 'Confirmed' : 'I see this too'}
            </Text>
          </>
        )}
      </Pressable>

      {alreadyConfirmed ? (
        <Text style={styles.infoText}>You already confirmed this</Text>
      ) : count !== null && count > 0 ? (
        <Text style={styles.countText}>
          {count} {count === 1 ? 'person confirmed' : 'people confirmed'}
        </Text>
      ) : null}

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginVertical: 4
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 16
  },
  pressed: {
    backgroundColor: '#f0f7ff'
  },
  disabledButton: {
    opacity: 0.7,
    borderColor: '#e5e5ea'
  },
  buttonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600'
  },
  confirmedButtonText: {
    color: '#34C759'
  },
  countText: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '500'
  },
  infoText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500'
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30'
  }
});

export default ConfirmReportButton;

