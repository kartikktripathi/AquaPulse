import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

export default function ReportPhoto({ uri, label = 'Report photo', style, compact = false }) {
  const [failedUri, setFailedUri] = useState(null);
  const [loadedUri, setLoadedUri] = useState(null);
  const failed = failedUri === uri;
  return <View style={[styles.container, style]}>
    {uri && !failed ? <>
      {loadedUri !== uri && <ActivityIndicator style={StyleSheet.absoluteFill} color="#007AFF" />}
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel={label}
        onLoad={() => setLoadedUri(uri)} onError={() => setFailedUri(uri)} />
    </> : <>
      <Ionicons name="image-outline" size={compact ? 20 : 32} color="#8e8e93" />
      {!compact && <Text style={styles.text}>{uri ? 'Photo unavailable' : 'No photos attached'}</Text>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#edf1f5', justifyContent: 'center', alignItems: 'center', gap: 8, overflow: 'hidden', borderRadius: 12 },
  text: { color: '#627083', fontSize: 13 },
});
