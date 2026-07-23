import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider as AppThemeProvider, useAppTheme } from '@/hooks/ThemeContext';

import { session, tripsAPI } from '@/services/api';
import { cancelTripNotifications, scheduleMultipleTripNotifications, showLocalNotification, TripNotification } from '@/services/notifications';
import { useEffect, useRef } from 'react';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootLayoutContent() {
  const { theme } = useAppTheme();

  const knownTripIds = useRef<Set<string>>(new Set());
  const isInitialized = useRef(false);

  useEffect(() => {
    const checkNewTrips = async () => {
      try {
        const trips = await tripsAPI.getTrips(
          undefined,
          session.user?.id,
          session.user?.agency_id
        );

        const currentIds = new Set<string>(
          trips.map((t: any) => String(t.id))
        );

        if (!isInitialized.current) {
          knownTripIds.current = currentIds;
          isInitialized.current = true;
          return;
        }

        trips.forEach((trip: any) => {
          const id = String(trip.id);
          if (!knownTripIds.current.has(id)) {
            showLocalNotification(
              'New Trip Assigned',
              `${trip.passenger_name || trip.company_name} • ${trip.pickup_location || trip.starting_point}`
            );
          }
        });

        knownTripIds.current = currentIds;

        // Schedule/refresh 15-10-5 min reminders for all trips with a start time
        const notificationTrips: TripNotification[] = trips
          .filter((t: any) => {
            const isCompleted = t.status === 'completed' || t.is_active === false || t.driver_response === 'declined';
            return !isCompleted && t.start_date && t.one_way_start_time;
          })
          .map((t: any) => ({
            tripId: t.id,
            passengerName: t.company_name ? `Company: ${t.company_name}` : 'Passenger',
            pickupLocation: t.starting_point || 'Unknown Start',
            startTime: `${t.start_date}T${t.one_way_start_time}.000Z`,
          }));

        for (const trip of notificationTrips) {
          await cancelTripNotifications(trip.tripId);
        }
        console.log(`[Notification Fallback] Cleared existing notifications for ${notificationTrips.length} trips`);
        await scheduleMultipleTripNotifications(notificationTrips);
      } catch (e) {
        console.log('Trip polling failed', e);
      }
    };

    checkNewTrips();
    const interval = setInterval(checkNewTrips, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index">
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="screens/trip-details" options={{ headerShown: false }} />
        <Stack.Screen name="screens/trips" options={{ headerShown: false }} />
        <Stack.Screen name="screens/map" options={{ headerShown: false }} />
        <Stack.Screen name="screens/settings" options={{ headerShown: false }} />
        <Stack.Screen name="screens/users" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutContent />
    </AppThemeProvider>
  );
}