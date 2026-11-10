import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const mapHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body, #map {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: #e5e3df;
      }
      .user-marker-container {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .user-dot {
        width: 14px;
        height: 14px;
        background-color: #007aff;
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        position: absolute;
        z-index: 2;
      }
      .user-pulse {
        width: 36px;
        height: 36px;
        background-color: rgba(0, 122, 255, 0.3);
        border-radius: 50%;
        position: absolute;
        z-index: 1;
        animation: pulse-ring 2s infinite ease-out;
      }
      @keyframes pulse-ring {
        0% {
          transform: scale(0.3);
          opacity: 1;
        }
        80% {
          transform: scale(1.4);
          opacity: 0;
        }
        100% {
          transform: scale(1.4);
          opacity: 0;
        }
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', {
        zoomControl: true,
        attributionControl: true
      }).setView([20, 0], 2);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      var userMarker = null;

      var userIcon = L.divIcon({
        className: 'user-marker-container',
        html: '<div class="user-pulse"></div><div class="user-dot"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      function setUserLocation(lat, lng) {
        if (!userMarker) {
          userMarker = L.marker([lat, lng], { icon: userIcon, title: 'Your Location' }).addTo(map);
        } else {
          userMarker.setLatLng([lat, lng]);
        }
        map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
      }

      function handleMessage(event) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data && data.type === 'SET_LOCATION') {
            setUserLocation(data.latitude, data.longitude);
          }
        } catch(e) {}
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);

      function notifyReady() {
        map.invalidateSize();
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'MAP_READY' }, '*');
        }
      }

      setTimeout(notifyReady, 350);
    </script>
  </body>
</html>`;

export default function Index() {
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const sendLocationToMap = (latitude, longitude) => {
    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'SET_LOCATION', latitude, longitude },
          '*'
        );
      } catch (err) {
        console.warn('Error posting message to web iframe:', err);
      }
    } else {
      webViewRef.current?.injectJavaScript(`
        if (typeof setUserLocation === 'function') {
          setUserLocation(${latitude}, ${longitude});
        }
        true;
      `);
    }
  };

  const requestLocation = async () => {
    try {
      setIsLoading(true);
      setPermissionDenied(false);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserCoords(coords);
      sendLocationToMap(coords.latitude, coords.longitude);
    } catch (error) {
      console.warn('Error obtaining location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event) => {
        if (event.data?.type === 'MAP_READY') {
          setIsMapReady(true);
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, []);

  useEffect(() => {
    if (isMapReady && userCoords) {
      sendLocationToMap(userCoords.latitude, userCoords.longitude);
    }
  }, [isMapReady, userCoords]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          title="OpenStreetMap"
          srcDoc={mapHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
          onLoad={() => {
            setIsMapReady(true);
            if (userCoords) {
              sendLocationToMap(userCoords.latitude, userCoords.longitude);
            }
          }}
        />
      ) : (
        (() => {
          const { WebView } = require('react-native-webview');
          return (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.map}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'MAP_READY') {
                    setIsMapReady(true);
                  }
                } catch (e) {}
              }}
              onLoadEnd={() => {
                setIsMapReady(true);
                if (userCoords) {
                  sendLocationToMap(userCoords.latitude, userCoords.longitude);
                }
              }}
            />
          );
        })()
      )}

      {/* Floating Controls Overlay */}
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        {permissionDenied && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Location permission was denied. Tap below to retry.
            </Text>
            <Pressable style={styles.bannerButton} onPress={requestLocation}>
              <Text style={styles.bannerButtonText}>Enable Location</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.bottomBar}>
          <Pressable
            style={({ pressed }) => [
              styles.locationButton,
              pressed && styles.locationButtonPressed,
            ]}
            onPress={requestLocation}
            accessibilityLabel="Locate me">
            {isLoading ? (
              <ActivityIndicator size="small" color="#007aff" />
            ) : (
              <Text style={styles.locationIcon}>📍</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
  },
  banner: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    marginHorizontal: 8,
  },
  bannerText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  bannerButton: {
    backgroundColor: '#007aff',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  bannerButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    marginRight: 4,
  },
  locationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  locationButtonPressed: {
    backgroundColor: '#f0f0f0',
    transform: [{ scale: 0.95 }],
  },
  locationIcon: {
    fontSize: 22,
  },
});
