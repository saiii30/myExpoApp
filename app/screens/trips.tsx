import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadSession, session, tripsAPI } from '@/services/api';
import { cancelTripNotifications, scheduleMultipleTripNotifications, showLocalNotification, TripNotification } from '@/services/notifications';
import { FontAwesome5 } from '@expo/vector-icons';
import { isRunningInExpoGo } from 'expo';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';



interface Trip {
  id: string | number;
  passenger_name: string;
  passenger_phone: string;
  pickup_location: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_location: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  fare: number | null;
  distance: number | null;
  created_at: string;
  start_time?: string; // Trip start time for scheduling
  source?: string;
  company_name?: string;
  trip_type?: string;
  way?: string;
  start_date?: string;
}

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'current' | 'upcoming' | 'completed'>('current');

  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const colors = {
    background: isDark ? '#0b0f19' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    accent: '#6366f1',
    activeTabBg: '#6366f1',
    inactiveTabBg: isDark ? '#1e293b' : '#ffffff',
  };

  // Use active session credentials or fallback to active dev driver UUID
  const driverId = session.user?.id || 'cf6912d9-6617-482b-aacf-dd034c780185';
  const agencyId = session.user?.agency_id || '6e7cdb44-603c-46c4-a4ca-198334c34314';

  // Helper function to check if trip is current (start time has arrived or passed)
  const isCurrentTrip = (trip: any) => {
    const tripStart = trip.start_time || trip.start_date;
    if (!tripStart) return true; // Show by default if no start time specified
    const now = new Date();
    const startTime = new Date(tripStart);
    return startTime <= now;
  };

  // Helper function to check if trip is upcoming (start time is in the future)
  const isUpcomingTrip = (trip: any) => {
    const tripStart = trip.start_time || trip.start_date;
    if (!tripStart) return false;
    const now = new Date();
    const startTime = new Date(tripStart);
    return startTime > now;
  };

  useEffect(() => {
    const init = async () => {
      await loadSession();
      loadTrips();
    };
    init();
  }, [activeTab]);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const data = await tripsAPI.getTrips(undefined, driverId, agencyId);

      // Filter database trips according to activeTab status logic
      const filteredDbTrips = data.filter((t: any) => {
        const isCompleted = t.status === 'completed' || t.is_active === false || t.driver_response === 'declined';

        if (activeTab === 'completed') {
          return isCompleted;
        } else {
          // Current and Upcoming tabs should only show active, non-completed, non-declined trips
          if (isCompleted) {
            return false;
          }

          if (activeTab === 'current') {
            return isCurrentTrip(t);
          } else if (activeTab === 'upcoming') {
            return isUpcomingTrip(t);
          }
        }
        return true;
      });

      // Format database trip objects
      const formattedDbTrips = filteredDbTrips.map((ts: any) => {
        let passengerName = ts.company_name ? `Company: ${ts.company_name}` : 'No passengers';
        let passengerPhone = 'N/A';
        if (ts.route_point) {
          try {
            const points = typeof ts.route_point === 'string' ? JSON.parse(ts.route_point) : ts.route_point;
            if (Array.isArray(points) && points.length > 0) {
              const names = points.map((p: any) => p.passenger_name).filter(Boolean);
              const phones = points.map((p: any) => p.passenger_phone).filter(Boolean);
              if (names.length > 0) passengerName = names.join(', ');
              if (phones.length > 0) passengerPhone = phones.join(', ');
            }
          } catch (e) {
            // ignore parsing failures
          }
        }
        return {
          id: ts.id,
          passenger_name: passengerName,
          passenger_phone: passengerPhone,
          pickup_location: ts.starting_point || 'Unknown Start',
          pickup_lat: ts.starting_lat,
          pickup_lng: ts.starting_lng,
          dropoff_location: ts.end_point || 'Unknown End',
          dropoff_lat: ts.end_lat,
          dropoff_lng: ts.end_lng,
          status: ts.driver_response === 'accepted' ? 'accepted' : (ts.driver_response === 'declined' ? 'rejected' : 'pending'),
          fare: ts.distance_km ? Math.round(ts.distance_km * 15) : 100,
          distance: ts.distance_km ? Math.round(ts.distance_km * 10) / 10 : null,
          created_at: ts.created_at || new Date().toISOString(),
          start_time: (() => {
            // Combine date and time to create a full ISO string for notifications.
            // The backend provides date and time separately.
            const date = ts.start_date; // e.g., "2026-07-04"
            const time = ts.one_way_start_time; // e.g., "13:30:00"
            if (date && time) {
              return `${date}T${time}.000Z`; // Construct ISO string e.g., "2026-07-04T13:30:00.000Z"
            }
            return undefined;
          })(),
          source: 'postgres'
        };
      });

     
    



      const newTrips = [...formattedDbTrips];
      console.log(newTrips)
setTrips(newTrips);

// --------------------
// NEW TRIP NOTIFICATION
// --------------------


// --------------------
// SCHEDULE 15/10/5 MIN REMINDERS
// --------------------
const notificationTrips: TripNotification[] = data
  .filter((t: any) => {
    const isCompleted = t.status === 'completed' || t.is_active === false || t.driver_response === 'declined';
    return !isCompleted && t.start_date && t.one_way_start_time;
  })
  .map((t: any) => ({
    tripId: t.id,
    passengerName: t.company_name ? `Company: ${t.company_name}` : 'Passenger',
    pickupLocation: t.starting_point || 'Unknown Start',
    startTime: `${t.start_date}T${t.one_way_start_time}`,
  }));

// Cancel old reminders first (avoid duplicates)
for (const trip of notificationTrips) {
  await cancelTripNotifications(trip.tripId);
}

// Schedule new reminders
await scheduleMultipleTripNotifications(notificationTrips);
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again');
        router.replace('/');
      } else {
        Alert.alert('Error', 'Failed to load trips');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (tripId: string | number) => {
    try {
      if (String(tripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip accepted locally');
        setTrips(prev => prev.filter(t => t.id !== tripId));
        return;
      }
      await tripsAPI.acceptTrip(tripId, driverId);
      Alert.alert('Success', 'Trip accepted successfully');
      
      if (Platform.OS === 'android' && isRunningInExpoGo()) {
        const trip = trips.find(t => t.id === tripId);
        const name = trip ? trip.passenger_name : 'Passenger';
        showLocalNotification('Trip Accepted', `You have accepted the trip for ${name}.`);
      }
      
      loadTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept trip');
    }
  };

  const handleReject = async (tripId: string | number) => {
    try {
      if (String(tripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip rejected locally');
        setTrips(prev => prev.filter(t => t.id !== tripId));
        return;
      }
      await tripsAPI.rejectTrip(tripId, driverId);
      Alert.alert('Success', 'Trip rejected');
      
      if (Platform.OS === 'android' && isRunningInExpoGo()) {
        const trip = trips.find(t => t.id === tripId);
        const name = trip ? trip.passenger_name : 'Passenger';
        showLocalNotification('Trip Rejected', `You have rejected the trip for ${name}.`);
      }
      
      loadTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject trip');
    }
  };

  const handleComplete = async (tripId: string | number) => {
    try {
      if (String(tripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip completed locally');
        setTrips(prev => prev.filter(t => t.id !== tripId));
        return;
      }
      await tripsAPI.completeTrip(tripId);
      Alert.alert('Success', 'Trip completed successfully');
      
      if (Platform.OS === 'android' && isRunningInExpoGo()) {
        const trip = trips.find(t => t.id === tripId);
        const name = trip ? trip.passenger_name : 'Passenger';
        showLocalNotification('Trip Completed', `You have completed the trip for ${name}.`);
      }
      
      loadTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to complete trip');
    }
  };

  const renderTrip = ({ item }: { item: Trip }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.passengerName, { color: colors.textPrimary }]}>{item.passenger_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Styled Timeline Map Segment */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineLeft}>
          <View style={[styles.timelineDot, { backgroundColor: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }]} />
          <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
          <View style={[styles.timelineDot, { backgroundColor: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }]} />
        </View>
        <View style={styles.timelineRight}>
          <View style={styles.locationGroup}>
            <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
            <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{item.pickup_location}</Text>
          </View>
          <View style={{ height: 20 }} />
          <View style={styles.locationGroup}>
            <Text style={styles.locationLabel}>DROPOFF LOCATION</Text>
            <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{item.dropoff_location}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.detailsRow, { borderTopColor: colors.border }]}>
        {item.distance && (
          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <FontAwesome5 name="road" size={12} color="#38bdf8" />
            </View>
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.distance} km</Text>
          </View>
        )}
        <View style={styles.detailItem}>
          <View style={styles.detailIconContainer}>
            <FontAwesome5 name="phone" size={12} color="#38bdf8" />
          </View>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.passenger_phone}</Text>
        </View>
      </View>

      {item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item.id)}
          >
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAccept(item.id)}
          >
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'accepted' && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => handleComplete(item.id)}
        >
          <Text style={styles.actionButtonText}>Complete Trip</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.viewMapButton, { borderColor: colors.accent }]}
        onPress={() => router.push({ pathname: '/screens/trip-details', params: { tripId: item.id.toString() } })}
      >
        <Text style={[styles.viewMapButtonText, { color: colors.accent }]}>View Details & Map</Text>
      </TouchableOpacity>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'completed': return '#6366f1';
      default: return '#64748b';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        {router.canGoBack() && (
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FontAwesome5 name="arrow-left" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Available Trips</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' ? { backgroundColor: colors.activeTabBg, borderColor: colors.accent } : { backgroundColor: colors.inactiveTabBg, borderColor: colors.border }]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' ? { color: '#ffffff' } : { color: colors.textSecondary }]}>Current</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' ? { backgroundColor: colors.activeTabBg, borderColor: colors.accent } : { backgroundColor: colors.inactiveTabBg, borderColor: colors.border }]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' ? { color: '#ffffff' } : { color: colors.textSecondary }]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' ? { backgroundColor: colors.activeTabBg, borderColor: colors.accent } : { backgroundColor: colors.inactiveTabBg, borderColor: colors.border }]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' ? { color: '#ffffff' } : { color: colors.textSecondary }]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading trips...</Text>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTrip}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No {activeTab} trips available</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 40 : 25,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTab: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 20,
  },
  timelineContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    width: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  timelineRight: {
    flex: 1,
    justifyContent: 'space-between',
  },
  locationGroup: {
    justifyContent: 'center',
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  detailIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  completeButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  viewMapButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    borderRadius: 12,
    alignItems: 'center',
  },
  viewMapButtonText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 16,
    color: '#94a3b8',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 16,
    color: '#64748b',
  },
});
