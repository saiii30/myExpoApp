import { Platform } from 'react-native';

let Notifications: any = null;
try {
  // Use dynamic require to catch module-load exceptions thrown by expo-notifications inside Expo Go
  Notifications = require('expo-notifications');
} catch (e: any) {
  console.warn(
    '[Notification Service] expo-notifications failed to load (Expo Go SDK 53+ remote push issue). Local reminders will be disabled.',
    e.message
  );
}

// Configure notification handler if available
if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      } as any),
    });
  } catch (e) {
    console.warn('[Notification Service] Failed to set notification handler', e);
  }
}

// Request notification permissions
export const requestNotificationPermissions = async () => {
  if (!Notifications) return false;
  try {
    const permissions = (await Notifications.getPermissionsAsync()) as any;
    const existingStatus = permissions.status;
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const request = (await Notifications.requestPermissionsAsync()) as any;
      finalStatus = request.status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
    
    return true;
  } catch (e) {
    console.warn('Notification permissions request failed', e);
    return false;
  }
};

// Schedule a notification for a specific time
export const scheduleTripNotification = async (
  tripId: string,
  passengerName: string,
  pickupLocation: string,
  startTime: Date
) => {
  if (!Notifications) return;
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  const now = new Date();
  const timeUntilTrip = startTime.getTime() - now.getTime();
  const minutesUntilTrip = timeUntilTrip / (1000 * 60);

  // Only schedule if trip is more than 15 minutes away so the 15-minute reminder is in the future
  if (minutesUntilTrip > 15) {
    const notificationTime = new Date(startTime.getTime() - 15 * 60000); // 15 minutes before
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Upcoming Trip Reminder',
          body: `Trip for ${passengerName} at ${pickupLocation} starts in 15 minutes`,
          data: { tripId },
        },
        trigger: { date: notificationTime } as any,
      });
      
      console.log(`Scheduled notification for trip ${tripId} at ${notificationTime}`);
    } catch (e) {
      console.warn('Failed to schedule notification', e);
    }
  }
};

// Cancel all notifications
export const cancelAllNotifications = async () => {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('Failed to cancel notifications', e);
  }
};

// Cancel specific notification by trip ID
export const cancelTripNotification = async (tripId: string) => {
  if (!Notifications) return;
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.tripId === tripId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (e) {
    console.warn('Failed to cancel trip notification', e);
  }
};

// Schedule notifications for multiple trips
export const scheduleTripNotifications = async (trips: any[]) => {
  if (!Notifications) return;
  await cancelAllNotifications();
  
  for (const trip of trips) {
    const startTimeStr = trip.start_time || trip.start_date;
    const isAccepted = trip.status === 'accepted' || trip.driver_response === 'accepted';
    if (startTimeStr && isAccepted) {
      await scheduleTripNotification(
        trip.id.toString(),
        trip.passenger_name,
        trip.pickup_location,
        new Date(startTimeStr)
      );
    }
  }
};
