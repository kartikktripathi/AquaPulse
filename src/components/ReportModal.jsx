import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FILTER_CATEGORIES } from '../utils/categoryMeta';
import { isLocalDemoMode, saveReportToDatabase } from '../services/reportService';
import { calculateDistanceMeters, reverseGeocode } from '../utils/geo';
import {
  DEPTH_OPTIONS,
  PEOPLE_OPTIONS,
  ROAD_OPTIONS,
  SEVERITY_META,
  getSeverity,
} from '../utils/severity';

const FORM_CATEGORIES = FILTER_CATEGORIES.filter((c) => c.id !== 'all');

export default function ReportModal({
  visible,
  onClose,
  userCoords,
  problemCoords,
  onAdjustOnMap,
  onResetProblemLocation,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();

  const [problemName, setProblemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Address fields
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [waterDepth, setWaterDepth] = useState(null);
  const [peopleAffected, setPeopleAffected] = useState(null);
  const [roadBlocked, setRoadBlocked] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Determine active coordinates and calculate distance from user
  const activeProblemCoords = problemCoords || userCoords;
  const distance =
    userCoords && activeProblemCoords
      ? calculateDistanceMeters(
          userCoords.latitude,
          userCoords.longitude,
          activeProblemCoords.latitude,
          activeProblemCoords.longitude
        )
      : 0;

  const isWithin500m = distance <= 500;

  // Auto-fill address when modal opens or coordinates update
  useEffect(() => {
    let isCancelled = false;

    if (visible && activeProblemCoords && !addressLine1) {
      setIsFetchingAddress(true);
      reverseGeocode(activeProblemCoords.latitude, activeProblemCoords.longitude)
        .then((geo) => {
          if (!isCancelled && geo) {
            if (geo.line1 && !addressLine1) {
              setAddressLine1(geo.line1);
            }
            if (geo.line2 && !addressLine2) {
              setAddressLine2(geo.line2);
            }
            if (geo.landmark && !landmark) {
              setLandmark(geo.landmark);
            }
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsFetchingAddress(false);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [visible, activeProblemCoords?.latitude, activeProblemCoords?.longitude]);

  const handleAutoFetchAddress = async () => {
    if (!activeProblemCoords) return;
    try {
      setIsFetchingAddress(true);
      const geo = await reverseGeocode(
        activeProblemCoords.latitude,
        activeProblemCoords.longitude
      );
      if (geo) {
        if (geo.line1) setAddressLine1(geo.line1);
        if (geo.line2) setAddressLine2(geo.line2);
        if (geo.landmark) setLandmark(geo.landmark);
        setErrors((prev) => ({
          ...prev,
          addressLine1: undefined,
          landmark: undefined,
        }));
      }
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const resetForm = () => {
    setProblemName('');
    setSelectedCategory(null);
    setIsDropdownOpen(false);
    setAddressLine1('');
    setAddressLine2('');
    setLandmark('');
    setDescription('');
    setPhotos([]);
    setWaterDepth(null);
    setPeopleAffected(null);
    setRoadBlocked(null);
    setSubmitError(null);
    setErrors({});
    setIsSubmitted(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleResetToUserLocation = () => {
    if (onResetProblemLocation) {
      onResetProblemLocation();
    }
    setErrors((prev) => ({ ...prev, radius: undefined }));
  };

  const handleAdjustOnMap = () => {
    if (onAdjustOnMap) {
      onAdjustOnMap();
    }
  };

  const handleTakePhoto = async () => {
    try {
      setIsProcessingPhotos(true);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Camera access is required to take photos of the water problem.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        allowsEditing: false,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
        setPhotos((prev) => [...prev, dataUri]);
      }
    } catch (err) {
      console.warn('Camera capture error:', err);
      Alert.alert('Camera Error', 'Could not access the camera on this device.');
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const handleChoosePhotos = async () => {
    try {
      setIsProcessingPhotos(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Photo library access is required to select photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUris = result.assets.map(
          (asset) => `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
        );
        setPhotos((prev) => {
          const combined = [...prev];
          for (const uri of pickedUris) {
            if (!combined.includes(uri)) {
              combined.push(uri);
            }
          }
          return combined;
        });
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      Alert.alert('Photo Error', 'Could not access photo library on this device.');
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSelectCategory = (categoryItem) => {
    setSelectedCategory(categoryItem);
    setIsDropdownOpen(false);
    setErrors((prev) => ({
      ...prev,
      category: undefined,
    }));
  };

  const handleSubmit = async () => {
    if (isSubmittingReport) return;
    const newErrors = {};

    if (!problemName.trim()) {
      newErrors.problemName = 'Please enter a name for the water problem.';
    }

    if (!selectedCategory) {
      newErrors.category = 'Please choose a category from the dropdown.';
    }

    if (!addressLine1.trim()) {
      newErrors.addressLine1 = 'Please enter Address Line 1.';
    }

    if (!landmark.trim()) {
      newErrors.landmark = 'Please enter a landmark to help locate the issue.';
    }

    if (!description.trim()) {
      newErrors.description = 'Please describe the water problem in detail.';
    }

    if (!waterDepth) {
      newErrors.waterDepth = 'Please select the water depth.';
    }

    if (!peopleAffected) {
      newErrors.peopleAffected = 'Please select how many people are affected.';
    }

    if (!roadBlocked) {
      newErrors.roadBlocked = 'Please indicate whether the road is blocked.';
    }

    // 500m Radius Circle Constraint
    if (distance > 500) {
      newErrors.radius = `Problem location is ${distance}m away. It must be within 500m of where you are.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const severity = getSeverity({ waterDepth, peopleAffected, roadBlocked });

    const reportData = {
      name: problemName.trim(),
      categoryId: selectedCategory.id,
      categoryLabel: selectedCategory.label,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      landmark: landmark.trim(),
      description: description.trim(),
      photos,
      latitude: activeProblemCoords ? activeProblemCoords.latitude : null,
      longitude: activeProblemCoords ? activeProblemCoords.longitude : null,
      userLatitude: userCoords ? userCoords.latitude : null,
      userLongitude: userCoords ? userCoords.longitude : null,
      distanceFromUser: distance,
      waterDepth,
      peopleAffected,
      roadBlocked,
      severity,
    };

    setSubmitError(null);
    setIsSubmittingReport(true);
    try {
      const result = await saveReportToDatabase(reportData);
      if (!result.success) {
        setSubmitError(
          result.error === 'Failed to fetch'
            ? 'Submission failed due to a network error. Tap Try again.'
            : result.error || 'Submission failed due to a network error. Tap Try again.'
        );
        setIsSubmittingReport(false);
        return;
      }
      onSubmit?.(result.report);
    } catch (saveError) {
      console.warn('Report save warning:', saveError);
      setSubmitError(isLocalDemoMode
        ? 'Could not save this report on your device. Check available storage and try again.'
        : 'Could not reach the report server. Check your connection and try again.');
      setIsSubmittingReport(false);
      return;
    }
    setIsSubmittingReport(false);

    setIsSubmitted(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent={true}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}>
          <View
            style={[
              styles.modalCard,
              {
                paddingTop: insets.top > 0 ? insets.top + 8 : 16,
                paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16,
              },
            ]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconBubble}>
                  <Ionicons name="document-text" size={20} color="#007aff" />
                </View>
                <Text style={styles.headerTitle}>Report Water Problem</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                activeOpacity={0.6}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.closeBtn}
                accessibilityLabel="Close report modal">
                <Ionicons name="close" size={22} color="#48484a" />
              </TouchableOpacity>
            </View>

            {isLocalDemoMode && !isSubmitted && (
              <Text style={[styles.radiusDescription, { paddingHorizontal: 16, marginBottom: 8, color: '#007aff' }]}>
                Local demo mode · reports save on this device, no backend needed.
              </Text>
            )}

            {isSubmitted ? (
              /* Success Screen */
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.successScrollContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.successIconBubble}>
                  <Ionicons name="checkmark" size={48} color="#34c759" />
                </View>
                <Text style={styles.successTitle}>{isLocalDemoMode ? 'Report Saved on This Device!' : 'Report Submitted!'}</Text>
                <Text style={styles.successMessage}>
                  {isLocalDemoMode
                    ? 'Demo mode: your report is saved locally. Find it in Reports by Category or Nearby Reports. It has not been sent to municipal teams.'
                    : 'Thank you for reporting this issue. Your submission helps municipal and local maintenance teams respond rapidly.'}
                </Text>

                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Problem:</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>
                      {problemName}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Category:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedCategory?.label}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Address Line 1:</Text>
                    <Text style={styles.summaryValue} numberOfLines={2}>
                      {addressLine1}
                    </Text>
                  </View>
                  {addressLine2 ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Address Line 2:</Text>
                      <Text style={styles.summaryValue} numberOfLines={2}>
                        {addressLine2}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Landmark:</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>
                      {landmark}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>500m Radius Status:</Text>
                    <Text style={[styles.summaryValue, { color: '#34c759', fontWeight: '600' }]}>
                      Within circle ({distance}m away)
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Severity:</Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        {
                          color: waterDepth && peopleAffected && roadBlocked
                            ? SEVERITY_META[getSeverity({ waterDepth, peopleAffected, roadBlocked })].color
                            : '#8e8e93',
                          fontWeight: '600',
                        },
                      ]}>
                      {waterDepth && peopleAffected && roadBlocked
                        ? SEVERITY_META[getSeverity({ waterDepth, peopleAffected, roadBlocked })].label
                        : '—'}
                    </Text>
                  </View>
                  {photos.length > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Photos Attached:</Text>
                      <Text style={styles.summaryValue}>
                        {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.primaryButton}
                  onPress={handleClose}>
                  <Ionicons name="checkmark-done" size={20} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* Form Body */
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                {/* 500m Radius Circle Status Card */}
                <View
                  style={[
                    styles.radiusCard,
                    isWithin500m ? styles.radiusCardValid : styles.radiusCardInvalid,
                  ]}>
                  <View style={styles.radiusCardHeader}>
                    <Ionicons
                      name={isWithin500m ? 'checkmark-circle' : 'alert-circle'}
                      size={20}
                      color={isWithin500m ? '#34c759' : '#ff3b30'}
                    />
                    <Text
                      style={[
                        styles.radiusStatusTitle,
                        { color: isWithin500m ? '#248a3d' : '#c92a2a' },
                      ]}>
                      {isWithin500m
                        ? `Within 500m Radius (${distance}m away)`
                        : `Outside 500m Radius (${distance}m away)`}
                    </Text>
                  </View>
                  <Text style={styles.radiusDescription}>
                    {isWithin500m
                      ? 'The selected problem location is within your 500m reporting zone.'
                      : 'You are only allowed to report water problems within 500m of your current location.'}
                  </Text>
                  {activeProblemCoords && (
                    <Text style={styles.radiusCoordsText}>
                      Pin: {activeProblemCoords.latitude.toFixed(5)},{' '}
                      {activeProblemCoords.longitude.toFixed(5)}
                    </Text>
                  )}
                  <View style={styles.radiusActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.radiusActionBtn}
                      onPress={handleResetToUserLocation}>
                      <Ionicons name="navigate-outline" size={15} color="#007aff" />
                      <Text style={styles.radiusActionBtnText}>
                        Use My Location (0m)
                      </Text>
                    </TouchableOpacity>
                    {onAdjustOnMap && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.radiusActionBtn}
                        onPress={handleAdjustOnMap}>
                        <Ionicons name="map-outline" size={15} color="#007aff" />
                        <Text style={styles.radiusActionBtnText}>Adjust on Map</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {errors.radius && (
                  <View style={styles.radiusErrorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#ff3b30" />
                    <Text style={styles.radiusErrorBannerText}>{errors.radius}</Text>
                  </View>
                )}

                {/* 1. Problem Name Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Problem Name <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      errors.problemName ? styles.inputErrorBorder : null,
                    ]}
                    placeholder="e.g., Main Pipeline Leakage near City Center"
                    placeholderTextColor="#8e8e93"
                    value={problemName}
                    onChangeText={(val) => {
                      setProblemName(val);
                      if (errors.problemName) {
                        setErrors((prev) => ({ ...prev, problemName: undefined }));
                      }
                    }}
                  />
                  {errors.problemName && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                      <Text style={styles.errorText}>{errors.problemName}</Text>
                    </View>
                  )}
                </View>

                {/* 2. Category Dropdown Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Category of Water Problem{' '}
                    <Text style={styles.requiredMark}>*</Text>
                  </Text>

                  {/* Dropdown trigger box */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.dropdownTrigger,
                      errors.category ? styles.inputErrorBorder : null,
                      isDropdownOpen ? styles.dropdownTriggerActive : null,
                    ]}
                    onPress={() => setIsDropdownOpen((prev) => !prev)}>
                    <View style={styles.dropdownTriggerLeft}>
                      {selectedCategory ? (
                        <>
                          <Ionicons
                            name={selectedCategory.icon}
                            size={18}
                            color="#007aff"
                            style={styles.dropdownIcon}
                          />
                          <Text style={styles.dropdownTriggerTextSelected}>
                            {selectedCategory.label}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.dropdownTriggerPlaceholder}>
                          Select a problem category...
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#636366"
                    />
                  </TouchableOpacity>

                  {errors.category && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                      <Text style={styles.errorText}>{errors.category}</Text>
                    </View>
                  )}

                  {/* Dropdown Options List */}
                  {isDropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      {FORM_CATEGORIES.map((item) => {
                        const isSelected = selectedCategory?.id === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.7}
                            style={[
                              styles.dropdownMenuItem,
                              isSelected ? styles.dropdownMenuItemActive : null,
                            ]}
                            onPress={() => handleSelectCategory(item)}>
                            <View style={styles.dropdownMenuItemLeft}>
                              <Ionicons
                                name={item.icon}
                                size={19}
                                color={isSelected ? '#007aff' : '#48484a'}
                              />
                              <Text
                                style={[
                                  styles.dropdownMenuItemLabel,
                                  isSelected
                                    ? styles.dropdownMenuItemLabelActive
                                    : null,
                                ]}>
                                {item.label}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-sharp"
                                size={18}
                                color="#007aff"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Water Depth <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <View style={styles.cueChipRow}>
                    {DEPTH_OPTIONS.map((opt) => {
                      const sel = waterDepth === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={({ pressed }) => [
                            styles.cueChip,
                            sel && styles.cueChipSelected,
                            pressed && { opacity: 0.6 },
                          ]}
                          onPress={() => {
                            setWaterDepth(opt.id);
                            setErrors((prev) => ({ ...prev, waterDepth: undefined }));
                          }}>
                          <Text style={[styles.cueChipText, sel && styles.cueChipTextSelected]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.waterDepth && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                      <Text style={styles.errorText}>{errors.waterDepth}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    People Affected <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <View style={styles.cueChipRow}>
                    {PEOPLE_OPTIONS.map((opt) => {
                      const sel = peopleAffected === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={({ pressed }) => [
                            styles.cueChip,
                            sel && styles.cueChipSelected,
                            pressed && { opacity: 0.6 },
                          ]}
                          onPress={() => {
                            setPeopleAffected(opt.id);
                            setErrors((prev) => ({ ...prev, peopleAffected: undefined }));
                          }}>
                          <Text style={[styles.cueChipText, sel && styles.cueChipTextSelected]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.peopleAffected && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                      <Text style={styles.errorText}>{errors.peopleAffected}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Road Blocked <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <View style={styles.cueChipRow}>
                    {ROAD_OPTIONS.map((opt) => {
                      const sel = roadBlocked === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={({ pressed }) => [
                            styles.cueChip,
                            sel && styles.cueChipSelected,
                            pressed && { opacity: 0.6 },
                          ]}
                          onPress={() => {
                            setRoadBlocked(opt.id);
                            setErrors((prev) => ({ ...prev, roadBlocked: undefined }));
                          }}>
                          <Text style={[styles.cueChipText, sel && styles.cueChipTextSelected]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.roadBlocked && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                      <Text style={styles.errorText}>{errors.roadBlocked}</Text>
                    </View>
                  )}
                </View>

                {waterDepth && peopleAffected && roadBlocked && (() => {
                  const sev = getSeverity({ waterDepth, peopleAffected, roadBlocked });
                  const meta = SEVERITY_META[sev];
                  return (
                    <View style={[styles.severityBadge, { backgroundColor: meta.bg }]}>
                      <View style={[styles.severityDot, { backgroundColor: meta.color }]} />
                      <Text style={[styles.severityBadgeText, { color: meta.color }]}>
                        Severity: {meta.label}
                      </Text>
                    </View>
                  );
                })()}

                {/* 3. Address Section */}
                <View style={styles.addressSectionBox}>
                  <View style={styles.addressSectionHeader}>
                    <View style={styles.addressHeaderLeft}>
                      <Ionicons name="location" size={18} color="#007aff" />
                      <Text style={styles.addressSectionTitle}>
                        Problem Address Details
                      </Text>
                    </View>
                    {isFetchingAddress ? (
                      <View style={styles.autoDetectingRow}>
                        <ActivityIndicator size="small" color="#007aff" />
                        <Text style={styles.autoDetectingText}>Fetching...</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={handleAutoFetchAddress}
                        style={styles.autoDetectBtn}
                        accessibilityLabel="Auto-detect address from pin">
                        <Ionicons name="locate-outline" size={14} color="#007aff" />
                        <Text style={styles.autoDetectBtnText}>Auto-detect</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Address Line 1 */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Address Line 1 <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        errors.addressLine1 ? styles.inputErrorBorder : null,
                      ]}
                      placeholder="House / Flat No., Street, Building Name"
                      placeholderTextColor="#8e8e93"
                      value={addressLine1}
                      onChangeText={(val) => {
                        setAddressLine1(val);
                        if (errors.addressLine1) {
                          setErrors((prev) => ({
                            ...prev,
                            addressLine1: undefined,
                          }));
                        }
                      }}
                    />
                    {errors.addressLine1 && (
                      <View style={styles.errorRow}>
                        <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                        <Text style={styles.errorText}>{errors.addressLine1}</Text>
                      </View>
                    )}
                  </View>

                  {/* Address Line 2 */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Address Line 2</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Area, Sector, Colony, Locality"
                      placeholderTextColor="#8e8e93"
                      value={addressLine2}
                      onChangeText={setAddressLine2}
                    />
                  </View>

                  {/* Landmark */}
                  <View style={styles.fieldGroupLast}>
                    <Text style={styles.fieldLabel}>
                      Landmark <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        errors.landmark ? styles.inputErrorBorder : null,
                      ]}
                      placeholder="e.g., Near City Water Tank, Opp. Metro Pillar 42"
                      placeholderTextColor="#8e8e93"
                      value={landmark}
                      onChangeText={(val) => {
                        setLandmark(val);
                        if (errors.landmark) {
                          setErrors((prev) => ({
                            ...prev,
                            landmark: undefined,
                          }));
                        }
                      }}
                    />
                    {errors.landmark && (
                      <View style={styles.errorRow}>
                        <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                        <Text style={styles.errorText}>{errors.landmark}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* 4. Description Paragraph Field */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Description of the Problem{' '}
                    <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      errors.description ? styles.inputErrorBorder : null,
                    ]}
                    placeholder="Describe the issue in detail: exact location/landmark, severity of the leak or contamination, duration, and how it impacts the neighborhood..."
                    placeholderTextColor="#8e8e93"
                    value={description}
                    onChangeText={(val) => {
                      setDescription(val);
                      if (errors.description) {
                        setErrors((prev) => ({
                          ...prev,
                          description: undefined,
                        }));
                      }
                    }}
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  {errors.description && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                      <Text style={styles.errorText}>{errors.description}</Text>
                    </View>
                  )}
                </View>

                {/* 5. Photos of the Problem */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>Photos of the Problem</Text>
                    {photos.length > 0 && (
                      <Text style={styles.photoCountText}>
                        {photos.length} {photos.length === 1 ? 'photo' : 'photos'} added
                      </Text>
                    )}
                  </View>

                  <View style={styles.photoActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.photoActionButton}
                      onPress={handleTakePhoto}
                      disabled={isProcessingPhotos}>
                      <Ionicons name="camera-outline" size={20} color="#007aff" />
                      <Text style={styles.photoActionButtonText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.photoActionButton}
                      onPress={handleChoosePhotos}
                      disabled={isProcessingPhotos}>
                      <Ionicons name="images-outline" size={20} color="#007aff" />
                      <Text style={styles.photoActionButtonText}>
                        Choose Photos
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isProcessingPhotos && (
                    <View style={styles.photoLoadingRow}>
                      <ActivityIndicator size="small" color="#007aff" />
                      <Text style={styles.photoLoadingText}>Loading photo...</Text>
                    </View>
                  )}

                  {/* Thumbnail gallery preview */}
                  {photos.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.thumbnailList}>
                      {photos.map((uri, index) => (
                        <View key={`${uri}-${index}`} style={styles.thumbnailWrapper}>
                          <Image
                            source={{ uri }}
                            style={styles.thumbnailImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={styles.removePhotoButton}
                            onPress={() => handleRemovePhoto(index)}
                            accessibilityLabel="Remove photo">
                            <Ionicons name="close" size={14} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera" size={26} color="#8e8e93" />
                      <Text style={styles.photoPlaceholderText}>
                        No photos added yet. Choose multiple photos or snap one now.
                      </Text>
                    </View>
                  )}
                </View>

                {submitError && (
                  <View style={styles.radiusErrorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#ff3b30" />
                    <Text style={styles.radiusErrorBannerText}>{submitError}</Text>
                  </View>
                )}

                {/* Submit button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.primaryButton,
                    isSubmittingReport ? styles.primaryButtonDisabled : null,
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmittingReport}>
                  {isSubmittingReport ? (
                    <>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={styles.primaryButtonText}>
                        Saving to Database...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={19} color="#ffffff" />
                      <Text style={styles.primaryButtonText}>
                        {submitError ? 'Try again' : 'Submit Report'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.6}
                  style={styles.cancelButton}
                  onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    height: '100%',
    maxHeight: Platform.OS === 'web' ? '92%' : '100%',
    backgroundColor: '#ffffff',
    borderRadius: Platform.OS === 'web' ? 18 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Form Scroll Area */
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },

  /* 500m Radius Status Card */
  radiusCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  radiusCardValid: {
    borderColor: '#c6f6d5',
    backgroundColor: '#f0fff4',
  },
  radiusCardInvalid: {
    borderColor: '#fed7d7',
    backgroundColor: '#fff5f5',
  },
  radiusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  radiusStatusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  radiusDescription: {
    fontSize: 12,
    color: '#4a5568',
    lineHeight: 17,
  },
  radiusCoordsText: {
    fontSize: 11,
    color: '#718096',
    marginTop: 4,
  },
  radiusActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  radiusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#b9dbff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 5,
  },
  radiusActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007aff',
  },
  radiusErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#ffa39e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  radiusErrorBannerText: {
    fontSize: 12,
    color: '#cf1322',
    fontWeight: '600',
    flex: 1,
  },

  /* Address Section Box */
  addressSectionBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    padding: 14,
    marginBottom: 20,
  },
  addressSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  addressHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  autoDetectBtnText: {
    fontSize: 11,
    color: '#007aff',
    fontWeight: '600',
  },
  autoDetectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoDetectingText: {
    fontSize: 11,
    color: '#007aff',
  },

  /* Form Groups */
  fieldGroup: {
    marginBottom: 16,
  },
  fieldGroupLast: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 7,
  },
  subFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#48484a',
    marginTop: 10,
    marginBottom: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  photoCountText: {
    fontSize: 12,
    color: '#007aff',
    fontWeight: '600',
  },
  requiredMark: {
    color: '#ff3b30',
  },

  /* Text Inputs */
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#1c1c1e',
  },
  textArea: {
    backgroundColor: '#f9f9fb',
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 100,
    fontSize: 15,
    color: '#1c1c1e',
  },
  inputErrorBorder: {
    borderColor: '#ff3b30',
    backgroundColor: '#fffcfc',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  errorText: {
    fontSize: 12,
    color: '#ff3b30',
  },

  /* Dropdown */
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9fb',
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  dropdownTriggerActive: {
    borderColor: '#007aff',
    backgroundColor: '#ffffff',
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    marginRight: 8,
  },
  dropdownTriggerPlaceholder: {
    fontSize: 15,
    color: '#8e8e93',
  },
  dropdownTriggerTextSelected: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1c1e',
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f2f2f7',
  },
  dropdownMenuItemActive: {
    backgroundColor: '#f0f7ff',
  },
  dropdownMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownMenuItemLabel: {
    fontSize: 14,
    color: '#2c3e50',
  },
  dropdownMenuItemLabelActive: {
    color: '#007aff',
    fontWeight: '600',
  },
  otherInputWrapper: {
    marginTop: 6,
  },

  /* Photos Section */
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#b9dbff',
    borderRadius: 10,
    height: 44,
    gap: 6,
  },
  photoActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007aff',
  },
  photoLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  photoLoadingText: {
    fontSize: 12,
    color: '#007aff',
  },
  photoPlaceholder: {
    backgroundColor: '#f9f9fb',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#8e8e93',
    textAlign: 'center',
  },
  thumbnailList: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'visible',
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#e5e5ea',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },

  cueChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  cueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    backgroundColor: '#f9f9fb',
  },
  cueChipSelected: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  cueChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3a3a3c',
  },
  cueChipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Buttons */
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007aff',
    borderRadius: 12,
    height: 50,
    gap: 8,
    marginTop: 10,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginTop: 6,
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#8e8e93',
    fontWeight: '500',
  },

  /* Success Screen */
  successScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  successIconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eefbf2',
    borderWidth: 2,
    borderColor: '#34c759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#f9f9fb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    marginBottom: 20,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#8e8e93',
    width: '40%',
  },
  summaryValue: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '500',
    width: '60%',
    textAlign: 'right',
  },
});
