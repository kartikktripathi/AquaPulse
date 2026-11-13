import { Stack } from 'expo-router';
import { ReportExplorerProvider } from '../context/ReportExplorerContext';

export default function RootLayout() {
  return (
    <ReportExplorerProvider>
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="reports-by-category" options={{ headerShown: false }} />
      <Stack.Screen name="nearby-reports" options={{ headerShown: false }} />
    </Stack>
    </ReportExplorerProvider>
  );
}


