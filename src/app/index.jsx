import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportModal from '../components/ReportModal';

const mapHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: #f2efe9;
      }
      #map {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: 100%;
        background-color: #f2efe9;
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
      .problem-marker-container {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .problem-pin {
        width: 26px;
        height: 26px;
        border-radius: 50% 50% 50% 0;
        background-color: #ff3b30;
        transform: rotate(-45deg);
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: -24px;
        left: -13px;
        cursor: pointer;
      }
      .problem-pin-inner {
        width: 8px;
        height: 8px;
        background-color: #ffffff;
        border-radius: 50%;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([20, 0], 2);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      var userMarker = null;
      var radiusCircle = null;
      var problemMarker = null;

      var userIcon = L.divIcon({
        className: 'user-marker-container',
        html: '<div class="user-pulse"></div><div class="user-dot"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      var problemIcon = L.divIcon({
        className: 'problem-marker-container',
        html: '<div class="problem-pin"><div class="problem-pin-inner"></div></div>',
        iconSize: [26, 26],
        iconAnchor: [0, 0]
      });

      function postToApp(data) {
        var str = typeof data === 'string' ? data : JSON.stringify(data);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(str);
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(data, '*');
        }
      }

      function setUserLocation(lat, lng) {
        if (!userMarker) {
          userMarker = L.marker([lat, lng], { icon: userIcon, title: 'Your Location' }).addTo(map);
        } else {
          userMarker.setLatLng([lat, lng]);
        }

        // Draw / update 500m radius circle around user
        if (!radiusCircle) {
          radiusCircle = L.circle([lat, lng], {
            radius: 500,
            color: '#007aff',
            weight: 2,
            opacity: 0.85,
            fillColor: '#007aff',
            fillOpacity: 0.10,
            dashArray: '6, 6'
          }).addTo(map);
        } else {
          radiusCircle.setLatLng([lat, lng]);
        }

        if (!problemMarker) {
          setProblemLocation(lat, lng, false);
        }

        map.invalidateSize();
        map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
      }

      function setProblemLocation(lat, lng, notify) {
        if (!problemMarker) {
          problemMarker = L.marker([lat, lng], {
            icon: problemIcon,
            draggable: true,
            title: 'Problem Location'
          }).addTo(map);

          problemMarker.on('dragend', function(e) {
            if (!userMarker) return;
            var pos = e.target.getLatLng();
            var dist = Math.round(map.distance(userMarker.getLatLng(), pos));
            if (dist <= 500) {
              postToApp({
                type: 'PROBLEM_LOCATION_SET',
                latitude: pos.lat,
                longitude: pos.lng,
                distance: dist,
                withinRadius: true
              });
            } else {
              var userPos = userMarker.getLatLng();
              problemMarker.setLatLng(userPos);
              postToApp({
                type: 'PROBLEM_LOCATION_OUTSIDE',
                latitude: pos.lat,
                longitude: pos.lng,
                distance: dist,
                withinRadius: false
              });
            }
          });
        } else {
          problemMarker.setLatLng([lat, lng]);
        }

        if (notify && userMarker) {
          var dist = Math.round(map.distance(userMarker.getLatLng(), [lat, lng]));
          postToApp({
            type: 'PROBLEM_LOCATION_SET',
            latitude: lat,
            longitude: lng,
            distance: dist,
            withinRadius: dist <= 500
          });
        }
      }

      function resetProblemLocation() {
        if (userMarker) {
          var pos = userMarker.getLatLng();
          setProblemLocation(pos.lat, pos.lng, true);
        }
      }

      function fitReportingZone() {
        if (radiusCircle) {
          map.fitBounds(radiusCircle.getBounds(), { padding: [40, 40], animate: true });
        }
      }

      map.on('click', function(e) {
        if (!userMarker) return;
        var userPos = userMarker.getLatLng();
        var dist = Math.round(map.distance(userPos, e.latlng));
        if (dist <= 500) {
          setProblemLocation(e.latlng.lat, e.latlng.lng, true);
        } else {
          postToApp({
            type: 'PROBLEM_LOCATION_OUTSIDE',
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
            distance: dist,
            withinRadius: false
          });
        }
      });

      window.setUserLocation = setUserLocation;
      window.setProblemLocation = setProblemLocation;
      window.resetProblemLocation = resetProblemLocation;
      window.fitReportingZone = fitReportingZone;

      function handleMessage(event) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data) return;
          if (data.type === 'SET_LOCATION') {
            setUserLocation(data.latitude, data.longitude);
          } else if (data.type === 'SET_PROBLEM_LOCATION') {
            setProblemLocation(data.latitude, data.longitude, false);
          } else if (data.type === 'RESET_PROBLEM_LOCATION') {
            resetProblemLocation();
          } else if (data.type === 'FIT_REPORTING_ZONE') {
            fitReportingZone();
          }
        } catch(e) {}
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);

      function refreshSize() {
        if (map) {
          map.invalidateSize();
        }
      }

      window.addEventListener('resize', refreshSize);

      function notifyReady() {
        refreshSize();
        postToApp({ type: 'MAP_READY' });
      }

      setTimeout(notifyReady, 100);
      setTimeout(refreshSize, 400);
      setTimeout(refreshSize, 1000);
    </script>
  </body>
</html>`;

const SIDEBAR_ITEMS = [
  {
    id: 'reports_by_category',
    title: 'Reports by Category',
    subtitle: 'Browse water issues by type',
    icon: 'grid-outline',
    iconColor: '#007aff',
    bgColor: '#eff6ff',
    route: '/reports-by-category',
  },
  {
    id: 'alerts',
    title: 'Water Outages & Alerts',
    subtitle: 'City supply schedules and alerts',
    icon: 'warning-outline',
    iconColor: '#ff9500',
    bgColor: '#fff8ed',
    route: null,
  },
  {
    id: 'helpline',
    title: 'Emergency Helpline',
    subtitle: 'Contact municipal water control room',
    icon: 'call-outline',
    iconColor: '#34c759',
    bgColor: '#eefbf2',
    route: null,
  },
  {
    id: 'about',
    title: 'About the Application',
    subtitle: 'App details, version, and mission',
    icon: 'information-circle-outline',
    iconColor: '#5856d6',
    bgColor: '#f5f3ff',
    route: null,
  },
];

export default function Index() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sidebarWidth = Math.min(windowWidth * 0.78, 320);

  const webViewRef = useRef(null);
  const iframeRef = useRef(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Problem coordinates & 500m radius reporting state
  const [problemCoords, setProblemCoords] = useState(null);
  const [problemDistance, setProblemDistance] = useState(0);
  const [mapNotice, setMapNotice] = useState(null);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);

  // Report modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Sidebar state & animations
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isOpeningRef = useRef(false);

  const slideAnim = useRef(new Animated.Value(-sidebarWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openSidebar = () => {
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    if (isOpeningRef.current) return;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -sidebarWidth,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsSidebarOpen(false);
    });
  };

  useEffect(() => {
    if (isSidebarOpen) {
      slideAnim.setValue(-sidebarWidth);
      fadeAnim.setValue(0);
      isOpeningRef.current = true;

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setTimeout(() => {
          isOpeningRef.current = false;
        }, 50);
      });
    }
  }, [isSidebarOpen, sidebarWidth]);

  const sendToMap = (messageObj) => {
    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.postMessage(messageObj, '*');
        if (messageObj.type === 'SET_LOCATION') {
          iframeRef.current?.contentWindow?.setUserLocation?.(
            messageObj.latitude,
            messageObj.longitude
          );
        } else if (messageObj.type === 'SET_PROBLEM_LOCATION') {
          iframeRef.current?.contentWindow?.setProblemLocation?.(
            messageObj.latitude,
            messageObj.longitude,
            false
          );
        } else if (messageObj.type === 'RESET_PROBLEM_LOCATION') {
          iframeRef.current?.contentWindow?.resetProblemLocation?.();
        } else if (messageObj.type === 'FIT_REPORTING_ZONE') {
          iframeRef.current?.contentWindow?.fitReportingZone?.();
        }
      } catch (err) {
        console.warn('Error sending message to web iframe:', err);
      }
    } else {
      webViewRef.current?.injectJavaScript(`
        if (typeof handleMessage === 'function') {
          handleMessage({ data: ${JSON.stringify(messageObj)} });
        }
        true;
      `);
    }
  };

  const sendLocationToMap = (latitude, longitude) => {
    sendToMap({ type: 'SET_LOCATION', latitude, longitude });
  };

  const handleMapMessage = (data) => {
    if (!data) return;
    if (data.type === 'MAP_READY') {
      setIsMapReady(true);
    } else if (data.type === 'PROBLEM_LOCATION_SET') {
      setProblemCoords({
        latitude: data.latitude,
        longitude: data.longitude,
      });
      setProblemDistance(data.distance);
      setMapNotice({
        type: 'info',
        message: `Problem pinned ${data.distance}m from you (within 500m circle). Tap + to report.`,
      });
    } else if (data.type === 'PROBLEM_LOCATION_OUTSIDE') {
      setMapNotice({
        type: 'warning',
        message: `Outside 500m radius (${data.distance}m away). Please tap inside the blue circle.`,
      });
    }
  };

  useEffect(() => {
    if (mapNotice) {
      const timer = setTimeout(() => {
        setMapNotice(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [mapNotice]);

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
      setProblemCoords(coords);
      setProblemDistance(0);
      sendLocationToMap(coords.latitude, coords.longitude);
    } catch (error) {
      console.warn('Error obtaining location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocateMe = () => {
    if (userCoords) {
      // Instantly center on user's known location without delay or spinner
      sendLocationToMap(userCoords.latitude, userCoords.longitude);
    } else {
      requestLocation();
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    try {
      setIsSearching(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=1`,
        {
          headers: {
            'User-Agent': 'AquaPulse-App',
          },
        }
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        sendLocationToMap(lat, lon);
      }
    } catch (err) {
      console.warn('Search geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event) => {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {}
        }
        handleMapMessage(data);
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
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Map layer - takes full screen */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            title="OpenStreetMap"
            srcDoc={mapHtml}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
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
                containerStyle={styles.map}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    handleMapMessage(data);
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
      </View>

      {/* Top Floating Search Bar & Notices */}
      <View
        pointerEvents="box-none"
        style={[
          styles.searchBarWrapper,
          {
            top: insets.top + (Platform.OS === 'web' ? 16 : 10),
          },
        ]}>
        <View style={styles.searchBar} pointerEvents="auto">
          <TouchableOpacity
            onPress={openSidebar}
            activeOpacity={0.6}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            style={styles.hamburgerButton}
            accessibilityLabel="Open sidebar"
            accessibilityRole="button">
            <Ionicons name="menu" size={26} color="#2c3e50" />
          </TouchableOpacity>

          <TextInput
            style={styles.searchInput}
            placeholder="Search on AquaPulse"
            placeholderTextColor="#8e8e93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.iconButton}
              accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={19} color="#8e8e93" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleSearch}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.iconButton}
            accessibilityLabel="Search location">
            {isSearching ? (
              <ActivityIndicator size="small" color="#007aff" />
            ) : (
              <Ionicons name="search" size={21} color="#333333" />
            )}
          </TouchableOpacity>
        </View>

        {/* Picking Location on Map Banner */}
        {isPickingOnMap && (
          <View style={styles.pickingBanner} pointerEvents="auto">
            <View style={styles.pickingBannerLeft}>
              <Ionicons name="location" size={16} color="#007aff" />
              <Text style={styles.pickingBannerText}>
                Tap inside 500m circle to place pin
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.pickingBannerBtn}
              onPress={() => {
                setIsPickingOnMap(false);
                setIsReportModalOpen(true);
              }}>
              <Text style={styles.pickingBannerBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Map Notice Banner */}
        {mapNotice && !isPickingOnMap && (
          <View
            style={[
              styles.mapNoticeBanner,
              mapNotice.type === 'warning' ? styles.mapNoticeWarning : null,
            ]}
            pointerEvents="auto">
            <Ionicons
              name={
                mapNotice.type === 'warning'
                  ? 'alert-circle'
                  : 'checkmark-circle'
              }
              size={16}
              color={mapNotice.type === 'warning' ? '#d9381e' : '#007aff'}
            />
            <Text style={styles.mapNoticeText}>{mapNotice.message}</Text>
            <TouchableOpacity
              onPress={() => setMapNotice(null)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close" size={15} color="#8e8e93" />
            </TouchableOpacity>
          </View>
        )}

        {permissionDenied && (
          <View style={styles.banner} pointerEvents="auto">
            <Text style={styles.bannerText}>
              Location permission was denied.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.bannerButton}
              onPress={requestLocation}>
              <Text style={styles.bannerButtonText}>Enable</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Floating Bottom Action Buttons (+ Report Button and Locate Button) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.bottomControls,
          {
            bottom: insets.bottom + 20,
          },
        ]}>
        {problemDistance > 0 && problemDistance <= 500 && (
          <View style={styles.pinnedPill} pointerEvents="auto">
            <Ionicons name="pin" size={13} color="#ff3b30" />
            <Text style={styles.pinnedPillText}>{problemDistance}m away</Text>
            <TouchableOpacity
              onPress={() => {
                if (userCoords) {
                  setProblemCoords(userCoords);
                  setProblemDistance(0);
                  sendToMap({ type: 'RESET_PROBLEM_LOCATION' });
                }
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={14} color="#8e8e93" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.addReportButton}
          onPress={() => setIsReportModalOpen(true)}
          accessibilityLabel="Report water problem"
          accessibilityRole="button">
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.locationButton}
          onPress={handleLocateMe}
          accessibilityLabel="Locate me"
          accessibilityRole="button">
          {isLoading && !userCoords ? (
            <ActivityIndicator size="small" color="#007aff" />
          ) : (
            <Ionicons name="location-sharp" size={26} color="#007aff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Water Problem Report Modal */}
      <ReportModal
        visible={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        userCoords={userCoords}
        problemCoords={problemCoords || userCoords}
        onAdjustOnMap={() => {
          setIsReportModalOpen(false);
          setIsPickingOnMap(true);
          sendToMap({ type: 'FIT_REPORTING_ZONE' });
        }}
        onResetProblemLocation={() => {
          if (userCoords) {
            setProblemCoords(userCoords);
            setProblemDistance(0);
            sendToMap({ type: 'RESET_PROBLEM_LOCATION' });
          }
        }}
        onSubmit={(report) => {
          console.log('New water problem report submitted:', report);
          setIsPickingOnMap(false);
        }}
      />

      {/* Sidebar Modal Overlay */}
      <Modal
        visible={isSidebarOpen}
        transparent={true}
        animationType="none"
        onRequestClose={closeSidebar}
        statusBarTranslucent={true}>
        <View style={styles.modalRoot}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFillObject}
              onPress={closeSidebar}
              accessibilityLabel="Close sidebar overlay"
            />
          </Animated.View>

          {/* Drawer Panel */}
          <Animated.View
            style={[
              styles.sidebarDrawer,
              {
                width: sidebarWidth,
                transform: [{ translateX: slideAnim }],
                paddingTop: insets.top + (Platform.OS === 'web' ? 20 : 12),
                paddingBottom: insets.bottom + 16,
              },
            ]}>
            {/* Header */}
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>AquaPulse</Text>
              <TouchableOpacity
                onPress={closeSidebar}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeButton}
                accessibilityLabel="Close sidebar">
                <Ionicons name="close" size={22} color="#333333" />
              </TouchableOpacity>
            </View>

            {/* Sidebar Content */}
            <View style={styles.sidebarContent}>
              <View>
                {/* Section Title */}
                <Text style={styles.sidebarSectionTitle}>Menu</Text>

                {/* Navigation List */}
                <View style={styles.sidebarMenu}>
                  {SIDEBAR_ITEMS.map((item, index) => {
                    const isLast = index === SIDEBAR_ITEMS.length - 1;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.sidebarMenuItem,
                          !isLast ? styles.sidebarMenuItemBorder : null,
                        ]}
                        activeOpacity={0.6}
                        onPress={() => {
                          if (item.route) {
                            // Animate the sidebar closed first, then navigate
                            Animated.parallel([
                              Animated.timing(slideAnim, {
                                toValue: -sidebarWidth,
                                duration: 220,
                                useNativeDriver: Platform.OS !== 'web',
                              }),
                              Animated.timing(fadeAnim, {
                                toValue: 0,
                                duration: 220,
                                useNativeDriver: Platform.OS !== 'web',
                              }),
                            ]).start(() => {
                              setIsSidebarOpen(false);
                              router.push(item.route);
                            });
                          } else {
                            closeSidebar();
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={item.title}>
                        <View
                          style={[
                            styles.sidebarMenuIconBubble,
                            { backgroundColor: item.bgColor },
                          ]}>
                          <Ionicons
                            name={item.icon}
                            size={20}
                            color={item.iconColor}
                          />
                        </View>
                        <View style={styles.sidebarMenuTextWrap}>
                          <Text style={styles.sidebarMenuItemTitle}>
                            {item.title}
                          </Text>
                          <Text style={styles.sidebarMenuItemSubtitle}>
                            {item.subtitle}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={17}
                          color="#c7c7cc"
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.sidebarFooter}>
                <Text style={styles.sidebarFooterVersion}>AquaPulse v1.0.0</Text>
                <Text style={styles.sidebarFooterText}>
                  City Water Management & Community Reporting
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#f2efe9',
    position: 'relative',
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  /* Search Bar */
  searchBarWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 25,
    height: 50,
    width: '100%',
    maxWidth: 580,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  hamburgerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1c1c1e',
    paddingHorizontal: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },

  /* Permission Banner */
  banner: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    maxWidth: 580,
  },
  bannerText: {
    fontSize: 13,
    color: '#444',
  },
  bannerButton: {
    backgroundColor: '#007aff',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  bannerButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Picking Banner */
  pickingBanner: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
    width: '100%',
    maxWidth: 580,
    borderLeftWidth: 4,
    borderLeftColor: '#007aff',
  },
  pickingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pickingBannerText: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  pickingBannerBtn: {
    backgroundColor: '#007aff',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  pickingBannerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Map Notice Banner */
  mapNoticeBanner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
    width: '100%',
    maxWidth: 580,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
  },
  mapNoticeWarning: {
    borderLeftColor: '#ff3b30',
    backgroundColor: '#fff7f7',
  },
  mapNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#333333',
    fontWeight: '500',
  },

  /* Bottom Controls */
  bottomControls: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#ffd2cf',
  },
  pinnedPillText: {
    fontSize: 12,
    color: '#d9381e',
    fontWeight: '600',
  },
  addReportButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 6,
  },
  locationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },

  /* Modal & Sidebar Drawer */
  modalRoot: {
    flex: 1,
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sidebarDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 25,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarContent: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  sidebarStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#eefbf2',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 20,
    gap: 6,
  },
  sidebarStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22c55e',
  },
  sidebarStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  sidebarSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8e8e93',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sidebarMenu: {
    backgroundColor: '#ffffff',
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  sidebarMenuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ebebf0',
  },
  sidebarMenuIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sidebarMenuTextWrap: {
    flex: 1,
  },
  sidebarMenuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 2,
  },
  sidebarMenuItemSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
  },
  sidebarFooter: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
    alignItems: 'center',
  },
  sidebarFooterVersion: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 2,
  },
  sidebarFooterText: {
    fontSize: 11,
    color: '#aeaeb2',
    textAlign: 'center',
  },
});
