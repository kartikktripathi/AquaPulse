import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ReportPhoto from './ReportPhoto.jsx';
import { splitPhotos } from '../utils/photoKinds.js';

export function BeforeAfter({ photos }) {
  const { before, after } = splitPhotos(photos);
  if (after.length === 0) {
    return null;
  }
  const beforePhoto = before.length > 0 ? before[0] : null;
  const afterPhoto = after[after.length - 1];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resolution Proof</Text>
      <View style={styles.row}>
        <View style={styles.photoBox}>
          <Text style={styles.label}>Before</Text>
          {beforePhoto ? (
            <ReportPhoto
              uri={typeof beforePhoto === 'string' ? beforePhoto : beforePhoto.uri}
              label="Before photo"
              style={styles.photo}
            />
          ) : (
            <View style={[styles.photo, styles.placeholder]}>
              <Text style={styles.placeholderText}>No photo</Text>
            </View>
          )}
        </View>

        <View style={styles.photoBox}>
          <Text style={styles.label}>After</Text>
          <ReportPhoto
            uri={typeof afterPhoto === 'string' ? afterPhoto : afterPhoto.uri}
            label="After photo"
            style={styles.photo}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1c1e'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  photoBox: {
    flex: 1,
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#627083'
  },
  photo: {
    height: 120,
    width: '100%',
    borderRadius: 10
  },
  placeholder: {
    backgroundColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholderText: {
    fontSize: 12,
    color: '#8e8e93'
  }
});

export default BeforeAfter;

