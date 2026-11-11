import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PROBLEM_CATEGORIES = [
  { id: 'pipe_burst', label: 'Pipe Burst / Major Leak', icon: 'water-outline' },
  { id: 'contamination', label: 'Contaminated / Dirty Water', icon: 'warning-outline' },
  { id: 'low_pressure', label: 'Low Pressure / No Water Supply', icon: 'speedometer-outline' },
  { id: 'drainage_overflow', label: 'Sewage / Drainage Overflow', icon: 'alert-circle-outline' },
  { id: 'waterlogging', label: 'Waterlogging / Street Flooding', icon: 'rainy-outline' },
  { id: 'water_wastage', label: 'Water Wastage / Open Fire Hydrant', icon: 'hourglass-outline' },
  { id: 'meter_fault', label: 'Damaged Meter / Pipeline Fault', icon: 'build-outline' },
  { id: 'tanker_disruption', label: 'Disrupted Water Tanker Supply', icon: 'car-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

export const PROBLEM_STATUSES = [
  {
    id: 'reported',
    label: 'Reported / No Resolution',
    icon: 'alert-circle-outline',
    color: '#ff3b30',
    bgColor: '#fff1f0',
  },
  {
    id: 'review',
    label: 'Under Review',
    icon: 'time-outline',
    color: '#ff9500',
    bgColor: '#fff8ed',
  },
  {
    id: 'in_progress',
    label: 'Getting Fixed / In Progress',
    icon: 'construct-outline',
    color: '#007aff',
    bgColor: '#eff6ff',
  },
  {
    id: 'fixed',
    label: 'Fixed / Resolved',
    icon: 'checkmark-circle-outline',
    color: '#34c759',
    bgColor: '#eefbf2',
  },
];

export default function ReportModal({ visible, onClose, userCoords, onSubmit }) {
  const insets = useSafeAreaInsets();

  const [problemName, setProblemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [customCategory, setCustomCategory] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState(PROBLEM_STATUSES[0].id);

  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const resetForm = () => {
    setProblemName('');
    setSelectedCategory(null);
    setCustomCategory('');
    setIsDropdownOpen(false);
    setDescription('');
    setPhotos([]);
    setStatus(PROBLEM_STATUSES[0].id);
    setErrors({});
    setIsSubmitted(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        setPhotos((prev) => [...prev, newUri]);
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
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUris = result.assets.map((asset) => asset.uri);
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
    if (categoryItem.id !== 'other') {
      setCustomCategory('');
    }
    setErrors((prev) => ({ ...prev, category: undefined, customCategory: undefined }));
  };

  const handleSubmit = () => {
    const newErrors = {};

    if (!problemName.trim()) {
      newErrors.problemName = 'Please enter a name for the water problem.';
    }

    if (!selectedCategory) {
      newErrors.category = 'Please choose a category from the dropdown.';
    } else if (selectedCategory.id === 'other' && !customCategory.trim()) {
      newErrors.customCategory = 'Please specify the custom category.';
    }

    if (!description.trim()) {
      newErrors.description = 'Please describe the water problem in detail.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const reportData = {
      id: Date.now().toString(),
      name: problemName.trim(),
      categoryId: selectedCategory.id,
      categoryLabel:
        selectedCategory.id === 'other'
          ? customCategory.trim()
          : selectedCategory.label,
      description: description.trim(),
      photos,
      status,
      coordinates: userCoords || null,
      createdAt: new Date().toISOString(),
    };

    if (onSubmit) {
      onSubmit(reportData);
    }

    setIsSubmitted(true);
  };

  const activeStatusObj =
    PROBLEM_STATUSES.find((s) => s.id === status) || PROBLEM_STATUSES[0];

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

            {isSubmitted ? (
              /* Success Screen */
              <View style={styles.successContainer}>
                <View style={styles.successIconBubble}>
                  <Ionicons name="checkmark" size={48} color="#34c759" />
                </View>
                <Text style={styles.successTitle}>Report Submitted!</Text>
                <Text style={styles.successMessage}>
                  Thank you for submitting this report. Your report helps municipal
                  and community teams resolve water issues quickly.
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
                      {selectedCategory?.id === 'other'
                        ? customCategory
                        : selectedCategory?.label}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Status:</Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: activeStatusObj.color, fontWeight: '600' },
                      ]}>
                      {activeStatusObj.label}
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
              </View>
            ) : (
              /* Form Body */
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                {/* Location indicator */}
                {userCoords && (
                  <View style={styles.locationBadge}>
                    <Ionicons name="location-sharp" size={15} color="#007aff" />
                    <Text style={styles.locationBadgeText}>
                      Pinning location: {userCoords.latitude.toFixed(5)},{' '}
                      {userCoords.longitude.toFixed(5)}
                    </Text>
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
                      {PROBLEM_CATEGORIES.map((item) => {
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
                                  isSelected ? styles.dropdownMenuItemLabelActive : null,
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

                  {/* If Other selected, required custom category input */}
                  {selectedCategory?.id === 'other' && (
                    <View style={styles.otherInputWrapper}>
                      <Text style={styles.subFieldLabel}>
                        Specify Custom Category{' '}
                        <Text style={styles.requiredMark}>*</Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          errors.customCategory ? styles.inputErrorBorder : null,
                        ]}
                        placeholder="Write the specific water problem category..."
                        placeholderTextColor="#8e8e93"
                        value={customCategory}
                        onChangeText={(val) => {
                          setCustomCategory(val);
                          if (errors.customCategory) {
                            setErrors((prev) => ({
                              ...prev,
                              customCategory: undefined,
                            }));
                          }
                        }}
                      />
                      {errors.customCategory && (
                        <View style={styles.errorRow}>
                          <Ionicons name="alert-circle" size={14} color="#ff3b30" />
                          <Text style={styles.errorText}>
                            {errors.customCategory}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* 3. Description Paragraph Field */}
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
                        setErrors((prev) => ({ ...prev, description: undefined }));
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

                {/* 4. Photos of the Problem */}
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

                {/* 5. Status of the Problem */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Status of the Problem</Text>
                  <View style={styles.statusGrid}>
                    {PROBLEM_STATUSES.map((item) => {
                      const isSelected = status === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.75}
                          style={[
                            styles.statusCard,
                            isSelected
                              ? {
                                  borderColor: item.color,
                                  backgroundColor: item.bgColor,
                                }
                              : null,
                          ]}
                          onPress={() => setStatus(item.id)}>
                          <View
                            style={[
                              styles.statusIconWrap,
                              { backgroundColor: item.color },
                            ]}>
                            <Ionicons name={item.icon} size={15} color="#ffffff" />
                          </View>
                          <Text
                            style={[
                              styles.statusCardLabel,
                              isSelected
                                ? { color: item.color, fontWeight: '700' }
                                : null,
                            ]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Submit button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.primaryButton}
                  onPress={handleSubmit}>
                  <Ionicons name="paper-plane" size={19} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Submit Report</Text>
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
    paddingBottom: 32,
  },

  /* Location badge */
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    borderColor: '#cce3ff',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 6,
  },
  locationBadgeText: {
    fontSize: 12,
    color: '#005bb5',
    fontWeight: '500',
  },

  /* Form Groups */
  fieldGroup: {
    marginBottom: 20,
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
    backgroundColor: '#f9f9fb',
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

  /* Status Grid */
  statusGrid: {
    gap: 8,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    gap: 10,
  },
  statusIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCardLabel: {
    fontSize: 13,
    color: '#3a3a3c',
    fontWeight: '500',
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
    marginTop: 8,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
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
  successContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 24,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#f9f9fb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    marginBottom: 24,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#8e8e93',
  },
  summaryValue: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '500',
    maxWidth: '65%',
  },
});

