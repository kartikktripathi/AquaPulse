import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReportExplorerProvider } from '../context/ReportExplorerContext';
import { loadDeviceId } from '../utils/deviceId';

export default function RootLayout() {
  useEffect(() => {
    loadDeviceId(AsyncStorage);
  }, []);

  return (
    <ReportExplorerProvider>
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="reports-by-category" options={{ headerShown: false }} />
      <Stack.Screen name="nearby-reports" options={{ headerShown: false }} />
      <Stack.Screen name="alerts" options={{ headerShown: false }} />
      <Stack.Screen name="helpline" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ headerShown: false }} />
      <Stack.Screen name="area-trends" options={{ headerShown: false }} />
    </Stack>
    </ReportExplorerProvider>
  );
}
