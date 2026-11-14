import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportModal from '../components/ReportModal';
import ReportDetailsModal from '../components/ReportDetailsModal';
import ReportFilters from '../components/ReportFilters';
import { useReportExplorer } from '../context/ReportExplorerContext';
import { getCategoryMeta } from '../utils/categoryMeta';
import { getReportCoordinates } from '../utils/nearbyReports';
import { getReportTitleSuggestions } from '../utils/reportListing';
import { mapHtml } from '../utils/mapHtml';

const SIDEBAR_ITEMS = [
  {
    id: 'all_reports',
    title: 'All Reports',
    subtitle: 'Search reports and view full details',
    icon: 'list-outline',
    route: '/reports',
  },
  {
    id: 'reports_by_category',
    title: 'Reports by Category',
    subtitle: 'Browse water issues by type',
    icon: 'grid-outline',
    route: '/reports-by-category',
  },
  {
    id: 'nearby_reports',
    title: 'Nearby Reports',
    subtitle: 'Find water issues around you',
    icon: 'navigate-circle-outline',
    route: '/nearby-reports',
  },
  {
    id: 'alerts',
    title: 'Water Outages & Alerts',
    subtitle: 'Open issues and official information',
    icon: 'warning-outline',
    route: '/alerts',
  },
  {
    id: 'helpline',
    title: 'Emergency Helpline',
    subtitle: 'Emergency and municipal contacts',
    icon: 'call-outline',
    route: '/helpline',
  },
  {
    id: 'about',
    title: 'About the Application',
    subtitle: 'App details, version, and mission',
    icon: 'information-circle-outline',
    route: '/about',
  },
  {
    id: 'area_trends',
    title: 'Areas Getting Worse',
    subtitle: 'Weekly change in reports',
    icon: 'trending-up-outline',
    route: '/area-trends',
  },
];

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sidebarWidth = Math.min(windowWidth * 0.78, 320);

  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const { reports, mapReports, refreshReports, loading: reportsLoading } = useReportExplorer();
  const legend = useMemo(() => [...new Map(mapReports.map((report) => [report.category, report])).values()], [mapReports]);
  useFocusEffect(useCallback(() => { refreshReports(); }, [refreshReports]));

  const [isMapReady, setIsMapReady] = useState(false);
  const [mapGeneration, setMapGeneration] = useState(0);
  const [userCoords, setUserCoords] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const blurTimeoutRef = useRef(null);

  const [problemCoords, setProblemCoords] = useState(null);
  const [problemDistance, setProblemDistance] = useState(0);
  const [mapNotice, setMapNotice] = useState(null);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isOpeningRef = useRef(false);
  const pendingRouteRef = useRef(null);

  const slideAnim = useRef(new Animated.Value(-sidebarWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openSidebar = () => {
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    isOpeningRef.current = false;
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
    setTimeout(() => {
      setIsSidebarOpen(false);
    }, 250);
  };

  const handleOpenGithub = async () => {
    try {
      await Linking.openURL('https://github.com/kartikktripathi/AquaPulse');
    } catch (err) {
    }
  };

  useEffect(() => {
    if (!isSidebarOpen && pendingRouteRef.current) {
      const route = pendingRouteRef.current;
      pendingRouteRef.current = null;
      router.push(route);
    }
  }, [isSidebarOpen, router]);

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

  const sendToMap = useCallback((messageObj) => {
    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.postMessage(messageObj, '*');
      } catch (err) {
      }
    } else {
      webViewRef.current?.injectJavaScript(`
        if (typeof handleMessage === 'function') {
          handleMessage({ data: ${JSON.stringify(messageObj)} });
        }
        true;
      `);
    }
  }, []);

  useEffect(() => {
    if (isMapReady) sendToMap({ type: 'SET_REPORTS', reports: mapReports });
  }, [isMapReady, mapGeneration, mapReports, sendToMap]);

  const sendLocationToMap = (latitude, longitude) => {
    sendToMap({ type: 'SET_LOCATION', latitude, longitude });
  };

  const handleMapMessage = (data) => {
    if (!data) return;
    if (data.type === 'MAP_READY') {
      setIsMapReady(true);
      setMapGeneration((version) => version + 1);
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
    } else if (data.type === 'SELECT_REPORT') {
      const match = (Array.isArray(reports) && reports.find((item) => String(item.id) === String(data.id))) ||
                    (Array.isArray(mapReports) && mapReports.find((item) => String(item.id) === String(data.id))) ||
                    data.report;
      if (match) {
        setSelectedReport(match);
      }
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocateMe = () => {
    if (userCoords) {
      sendLocationToMap(userCoords.latitude, userCoords.longitude);
    } else {
      requestLocation();
    }
  };

  const allReports = useMemo(() => {
    if (Array.isArray(reports) && reports.length > 0) return reports;
    if (Array.isArray(mapReports) && mapReports.length > 0) return mapReports;
    return [];
  }, [reports, mapReports]);

  const searchSuggestions = useMemo(() => {
    return getReportTitleSuggestions(allReports, searchQuery, 8);
  }, [allReports, searchQuery]);

  const showSuggestions = isSearchFocused && searchQuery.trim().length > 0;

  const handleSearchFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      setIsSearchFocused(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectSuggestion = (item) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsSearchFocused(false);
    Keyboard.dismiss();

    const title = (item.name || '').trim();
    if (title) {
      setSearchQuery(title);
    }

    const coords = getReportCoordinates(item) || (
      item.latitude && item.longitude
        ? { latitude: Number(item.latitude), longitude: Number(item.longitude) }
        : null
    );

    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
      sendToMap({
        type: 'PAN_TO_LOCATION',
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    }

    const fullReport =
      (Array.isArray(reports) && reports.find((r) => String(r.id) === String(item.id))) ||
      item;
    setSelectedReport(fullReport);
  };

  const handleClearSearch = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsSearchFocused(false);
    Keyboard.dismiss();

    const queryLower = query.toLowerCase();
    const exactMatch = allReports.find(
      (r) => (r.name || '').trim().toLowerCase() === queryLower
    );
    const bestMatch = exactMatch || searchSuggestions[0];

    if (bestMatch) {
      handleSelectSuggestion(bestMatch);
      return;
    }

    const searchController = new AbortController();
    const searchTimer = setTimeout(() => searchController.abort(), 10000);
    try {
      setIsSearching(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=1`,
        {
          signal: searchController.signal,
          headers: {
            'User-Agent': 'AquaPulse-App',
          },
        }
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        sendToMap({ type: 'PAN_TO_LOCATION', latitude: lat, longitude: lon });
      } else {
        setMapNotice({
          type: 'warning',
          message: `No reports or locations found matching "${query}"`,
        });
      }
    } catch (err) {
    } finally {
      clearTimeout(searchTimer);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
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
  }, [isMapReady, mapGeneration, userCoords]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

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
              />
            );
          })()
        )}
      </View>

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
            placeholder="Search report titles..."
            placeholderTextColor="#8e8e93"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (!isSearchFocused) setIsSearchFocused(true);
            }}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
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

        {showSuggestions && (
          <View style={styles.suggestionsContainer} pointerEvents="auto">
            <View style={styles.suggestionsHeader}>
              <Ionicons name="search" size={13} color="#64748b" />
              <Text style={styles.suggestionsHeaderText}>
                MATCHING REPORT TITLES ({searchSuggestions.length})
              </Text>
            </View>

            {searchSuggestions.length > 0 ? (
              <ScrollView
                style={styles.suggestionsScroll}
                contentContainerStyle={styles.suggestionsScrollContent}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled>
                {searchSuggestions.map((item, index) => {
                  const meta = getCategoryMeta(item.category || item.categoryId || item.categoryLabel);
                  const locationHint =
                    item.addressLine1 ||
                    item.addressLine ||
                    item.address ||
                    item.landmark ||
                    (item.distanceFromUser ? `${Math.round(item.distanceFromUser)}m away` : null);

                  return (
                    <TouchableOpacity
                      key={item.id ? String(item.id) : `sugg-${index}`}
                      style={[
                        styles.suggestionItem,
                        index < searchSuggestions.length - 1 && styles.suggestionItemBorder,
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Select report ${item.name}`}>
                      <View
                        style={[
                          styles.suggestionIconWrap,
                          { backgroundColor: (meta?.color || '#007aff') + '18' },
                        ]}>
                        <Ionicons
                          name={meta?.icon || 'water'}
                          size={16}
                          color={meta?.color || '#007aff'}
                        />
                      </View>
                      <View style={styles.suggestionTextWrap}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item.name || 'Untitled Report'}
                        </Text>
                        <View style={styles.suggestionMetaRow}>
                          <Text
                            style={[
                              styles.suggestionCategory,
                              { color: meta?.color || '#007aff' },
                            ]}
                            numberOfLines={1}>
                            {item.categoryLabel || item.category || meta?.label || 'Water Issue'}
                          </Text>
                          {locationHint ? (
                            <>
                              <Text style={styles.suggestionDot}>•</Text>
                              <Text style={styles.suggestionAddress} numberOfLines={1}>
                                {locationHint}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptySuggestions}>
                <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
                <Text style={styles.emptySuggestionsText}>
                  No report titles matching "{searchQuery.trim()}"
                </Text>
                <Text style={styles.emptySuggestionsSubtext}>
                  Press search to find this location on the map
                </Text>
              </View>
            )}
          </View>
        )}

        {!showSuggestions && (
          <View style={styles.reportControls}>
            <ReportFilters map />
            <View style={styles.reportActions}>
              <TouchableOpacity onPress={() => sendToMap({ type: 'FIT_REPORTS' })} disabled={!isMapReady || !mapReports.length}
                style={styles.reportAction} accessibilityRole="button" accessibilityState={{ disabled: !isMapReady || !mapReports.length }}>
                <Text style={[styles.reportActionText, (!isMapReady || !mapReports.length) && { color: '#8e8e93' }]}>Fit reports</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/reports')} style={styles.reportAction} accessibilityRole="button">
                <Text style={styles.reportActionText}>View list</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={refreshReports} disabled={reportsLoading} style={styles.reportAction} accessibilityRole="button" accessibilityLabel="Refresh map reports">
                <Ionicons name="refresh" size={18} color={reportsLoading ? '#8e8e93' : '#007AFF'} />
              </TouchableOpacity>
            </View>
            {legend.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
              {legend.map((item) => <View key={item.category} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.category}</Text>
              </View>)}
            </ScrollView>}
          </View>
        )}

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
        onSubmit={() => {
          setIsPickingOnMap(false);
          refreshReports();
        }}
      />

      {selectedReport && (
        <ReportDetailsModal
          report={selectedReport}
          userCoords={userCoords}
          onClose={() => setSelectedReport(null)}
          onPhotosUpdated={() => refreshReports()}
        />
      )}

      <Modal
        visible={isSidebarOpen}
        transparent={true}
        animationType="none"
        onRequestClose={closeSidebar}
        statusBarTranslucent={true}>
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFillObject}
              onPress={closeSidebar}
              accessibilityLabel="Close sidebar overlay"
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.sidebarDrawer,
              {
                width: sidebarWidth,
                transform: [{ translateX: slideAnim }],
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 10,
              },
            ]}>
            <View style={styles.sidebarPanel}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>AquaPulse</Text>
                <TouchableOpacity
                  onPress={closeSidebar}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.closeButton}
                  accessibilityLabel="Close sidebar">
                  <Ionicons name="chevron-back" size={18} color="#000000" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
                <View>
                  <Text style={styles.sidebarSectionTitle}>Menu</Text>

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
                            pendingRouteRef.current = item.route;
                            closeSidebar();
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={item.title}>
                          <View style={styles.sidebarMenuIconBubble}>
                            <Ionicons
                              name={item.icon}
                              size={22}
                              color="#ffffff"
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
                            color="#48484a"
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.sidebarFooter}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.sidebarGithubLink}
                    onPress={handleOpenGithub}
                    accessibilityRole="link"
                    accessibilityLabel="View AquaPulse on GitHub">
                    <Ionicons name="logo-github" size={18} color="#ffffff" />
                    <Text style={styles.sidebarGithubText}>View on GitHub</Text>
                    <Ionicons name="open-outline" size={13} color="#8e8e93" />
                  </TouchableOpacity>

                  <Text style={styles.sidebarFooterVersion}>AquaPulse v1.0.0</Text>
                  <Text style={styles.sidebarFooterText}>
                    City Water Management & Community Reporting
                  </Text>
                </View>
              </ScrollView>
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
  reportControls: { marginTop: 8, width: '100%', maxWidth: 580, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', elevation: 3 },
  reportActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#e9edf2' },
  reportAction: { minHeight: 40, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  reportActionText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  legend: { paddingHorizontal: 12, paddingBottom: 10, gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#526072' },
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
  suggestionsContainer: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 101,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionsHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  suggestionsScroll: {
    maxHeight: 260,
  },
  suggestionsScrollContent: {
    paddingVertical: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  suggestionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  suggestionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  suggestionCategory: {
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionDot: {
    fontSize: 11,
    color: '#94a3b8',
  },
  suggestionAddress: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  emptySuggestions: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptySuggestionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  emptySuggestionsSubtext: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
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
    backgroundColor: 'transparent',
    paddingLeft: 10,
  },
  sidebarPanel: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f1f',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarContent: {
    flexGrow: 1,
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
    backgroundColor: 'transparent',
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  sidebarMenuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f1f',
  },
  sidebarMenuIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
    color: '#ffffff',
    marginBottom: 2,
  },
  sidebarMenuItemSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
  },
  sidebarFooter: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1f1f1f',
    alignItems: 'center',
  },
  sidebarGithubLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#111111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 12,
  },
  sidebarGithubText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  sidebarFooterVersion: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 2,
  },
  sidebarFooterText: {
    fontSize: 11,
    color: '#636366',
    textAlign: 'center',
  },
});
