import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadSession, session, tripsAPI } from '@/services/api';
// import { cancelTripNotifications, scheduleMultipleTripNotifications, showLocalNotification, TripNotification } from '@/services/notifications';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';



interface Trip {
  id: string | number;
  original_id?: string | number; // Original trip ID for two-way trips
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
  end_date?: string;
  // Leg identifier for two-way trips
  leg?: 'outbound' | 'return';
  // Two-way trip fields
  two_way_start_time?: string;
  two_way_isActive?: boolean;
  one_way_isActive?: boolean;
  driver_response_two_way?: string;
}

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTripId, setRejectTripId] = useState<string | number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'upcoming' | 'completed'>('current');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Default to tomorrow
  const [showDatePicker, setShowDatePicker] = useState(false);

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
    accentLight: 'rgba(99, 102, 241, 0.12)',
  };

  // Use active session credentials or fallback to active dev driver UUID
  const driverId = session.user?.id || 'cf6912d9-6617-482b-aacf-dd034c780185';
  const agencyId = session.user?.agency_id || '6e7cdb44-603c-46c4-a4ca-198334c34314';



  useEffect(() => {
    const init = async () => {
      await loadSession();
      loadTrips();
    };
    init();
  }, [activeTab, selectedDate]);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const data = await tripsAPI.getTrips(undefined, driverId, agencyId);



      // STEP 1: Get all active trips
      const activeTrips = data.filter((t: any) => {
        return (
          t.status !== 'completed' &&
          t.is_active !== false &&
          t.driver_response !== 'declined'
        );
      });

      // STEP 2: Sort by start time (earliest first)
      activeTrips.sort((a: any, b: any) => {
        const timeA = a.start_date && a.one_way_start_time
          ? new Date(`${a.start_date}T${a.one_way_start_time}`).getTime()
          : 0;

        const timeB = b.start_date && b.one_way_start_time
          ? new Date(`${b.start_date}T${b.one_way_start_time}`).getTime()
          : 0;

        return timeA - timeB;
      });

      // STEP 3: Get today's date for filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // STEP 4: Filter trips for tabs
      const filteredDbTrips = data.filter((t: any) => {
        const isCompleted =
          t.status === 'completed' ||
          t.is_active === false ||
          t.driver_response === 'declined';

        if (activeTab === 'completed') {
          return isCompleted;
        }

        if (isCompleted) return false;

        if (activeTab === 'current') {
          // Show trips where today is within the date range (start_date to end_date)
          if (t.start_date) {
            // Parse start_date manually to avoid timezone issues
            const [startYear, startMonth, startDay] = t.start_date.split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1, startDay);
            startDate.setHours(0, 0, 0, 0);

            // Parse end_date if available, otherwise use start_date
            let endDate = startDate;
            if (t.end_date) {
              const [endYear, endMonth, endDay] = t.end_date.split('-').map(Number);
              endDate = new Date(endYear, endMonth - 1, endDay);
              endDate.setHours(0, 0, 0, 0);
            }

            // Check if today is within the range [startDate, endDate]
            return today.getTime() >= startDate.getTime() && today.getTime() <= endDate.getTime();
          }
          return false;
        }

        if (activeTab === 'upcoming') {
          // Show trips for selected date
          if (t.start_date) {
            // Parse start_date manually to avoid timezone issues
            const [startYear, startMonth, startDay] = t.start_date.split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1, startDay);
            startDate.setHours(0, 0, 0, 0);

            // Parse end_date if available, otherwise use start_date
            let endDate = startDate;
            if (t.end_date) {
              const [endYear, endMonth, endDay] = t.end_date.split('-').map(Number);
              endDate = new Date(endYear, endMonth - 1, endDay);
              endDate.setHours(0, 0, 0, 0);
            }

            // Parse selected date
            const selected = new Date(selectedDate);
            selected.setHours(0, 0, 0, 0);

            // Check if selected date is within the trip's date range
            return selected.getTime() >= startDate.getTime() && selected.getTime() <= endDate.getTime();
          }
          return false;
        }

        return false;
      });


      // Format database trip objects
      const formattedDbTrips: Trip[] = [];
      
      console.log('=== DEBUG: Raw trip data ===');
      console.log('Total trips:', filteredDbTrips.length);
      filteredDbTrips.forEach((ts: any, index: number) => {
        console.log(`Trip ${index}:`, {
          id: ts.id,
          two_way_isActive: ts.two_way_isActive,
          two_way_start_time: ts.two_way_start_time,
          one_way_isActive: ts.one_way_isActive,
          one_way_start_time: ts.one_way_start_time,
        });
      });
      
      filteredDbTrips.forEach((ts: any) => {
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

        const baseTrip = {
          original_id: ts.id,
          passenger_name: passengerName,
          passenger_phone: passengerPhone,
          pickup_location: ts.starting_point || 'Unknown Start',
          pickup_lat: ts.starting_lat,
          pickup_lng: ts.starting_lng,
          dropoff_location: ts.end_point || 'Unknown End',
          dropoff_lat: ts.end_lat,
          dropoff_lng: ts.end_lng,
          fare: ts.distance_km ? Math.round(ts.distance_km * 15) : 100,
          distance: ts.distance_km ? Math.round(ts.distance_km * 10) / 10 : null,
          created_at: ts.created_at || new Date().toISOString(),
          source: 'postgres',
          start_date: ts.start_date,
          end_date: ts.end_date,
        };

        // Check if this is a two-way trip
        console.log(`Checking trip ${ts.id} for two-way:`, {
          two_way_isActive: ts.two_way_isActive,
          two_way_start_time: ts.two_way_start_time,
          condition: ts.two_way_start_time !== null && ts.two_way_start_time !== undefined
        });
        
        if (ts.two_way_start_time !== null && ts.two_way_start_time !== undefined) {
          console.log(`Splitting trip ${ts.id} into outbound and return legs`);
          // Split into two separate trips: outbound and return
          
          // Outbound leg
          const outboundTrip: Trip = {
            ...baseTrip,
            id: `${ts.id}-outbound`,
            status: ts.driver_response === 'accepted' ? 'accepted' : (ts.driver_response === 'declined' ? 'rejected' : 'pending'),
            start_time: (() => {
              const date = ts.start_date;
              const time = ts.one_way_start_time;
              if (date && time) {
                return `${date}T${time}`;
              }
              return undefined;
            })(),
            leg: 'outbound',
            two_way_start_time: ts.two_way_start_time,
            two_way_isActive: ts.two_way_isActive,
            one_way_isActive: ts.one_way_isActive,
            driver_response_two_way: ts.driver_response_two_way,
          };
          formattedDbTrips.push(outboundTrip);

          // Return leg
          const returnTrip: Trip = {
            ...baseTrip,
            id: `${ts.id}-return`,
            // Reverse pickup and dropoff for return leg
            pickup_location: ts.end_point || 'Unknown Start',
            pickup_lat: ts.end_lat,
            pickup_lng: ts.end_lng,
            dropoff_location: ts.starting_point || 'Unknown End',
            dropoff_lat: ts.starting_lat,
            dropoff_lng: ts.starting_lng,
            status: ts.driver_response_two_way === 'accepted' ? 'accepted' : (ts.driver_response_two_way === 'declined' ? 'rejected' : 'pending'),
            start_time: (() => {
              const date = ts.start_date;
              const time = ts.two_way_start_time;
              if (date && time) {
                return `${date}T${time}`;
              }
              return undefined;
            })(),
            leg: 'return',
            two_way_start_time: ts.two_way_start_time,
            two_way_isActive: ts.two_way_isActive,
            one_way_isActive: ts.one_way_isActive,
            driver_response_two_way: ts.driver_response_two_way,
          };
          formattedDbTrips.push(returnTrip);
        } else {
          console.log(`Trip ${ts.id} is one-way, creating single entry`);
          // One-way trip - single entry
          const oneWayTrip: Trip = {
            ...baseTrip,
            id: ts.id,
            status: ts.driver_response === 'accepted' ? 'accepted' : (ts.driver_response === 'declined' ? 'rejected' : 'pending'),
            start_time: (() => {
              const date = ts.start_date;
              const time = ts.one_way_start_time;
              if (date && time) {
                return `${date}T${time}`;
              }
              return undefined;
            })(),
            leg: undefined,
            two_way_start_time: ts.two_way_start_time,
            two_way_isActive: ts.two_way_isActive,
            one_way_isActive: ts.one_way_isActive,
            driver_response_two_way: ts.driver_response_two_way,
          };
          formattedDbTrips.push(oneWayTrip);
        }
      });






      const newTrips = [...formattedDbTrips];
      // Sort all trips by start time
      newTrips.sort((a: any, b: any) => {
        const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
        const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
        return timeA - timeB;
      });
      console.log(newTrips)
      setTrips(newTrips);

      // --------------------
      // NEW TRIP NOTIFICATION
      // --------------------


      // // --------------------
      // // SCHEDULE 15/10/5 MIN REMINDERS
      // // --------------------
      // const notificationTrips: TripNotification[] = data
      //   .filter(
      //     (t: any) =>
      //       currentTripId !== null &&
      //       String(t.id) === currentTripId
      //   )
      //   .map((t: any) => ({
      //     tripId: t.id,
      //     passengerName: t.company_name
      //       ? `Company: ${t.company_name}`
      //       : "Passenger",

      //     pickupLocation: t.starting_point,

      //     startDate: t.start_date,
      //     endDate: t.end_date,

      //     startTime: t.one_way_start_time,

      //     isPending: t.driver_response !== "accepted",
      //   }));

      // // Cancel old reminders first (avoid duplicates)
      // for (const trip of notificationTrips) {
      //   await cancelTripNotifications(trip.tripId);
      // }

      // // Schedule new reminders
      // await scheduleMultipleTripNotifications(notificationTrips);
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
      // Extract original_id if this is a leg trip
      const originalId = String(tripId).includes('-') ? String(tripId).split('-')[0] : tripId;
      
      if (String(tripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip accepted locally');
        setTrips(prev => prev.filter(t => t.id !== tripId));
        return;
      }
      await tripsAPI.acceptTrip(originalId, driverId);
      Alert.alert('Success', 'Trip accepted successfully');

      // if (Platform.OS === 'android' && isRunningInExpoGo()) {
      //   const trip = trips.find(t => t.id === tripId);
      //   const name = trip ? trip.passenger_name : 'Passenger';
      //   showLocalNotification('Trip Accepted', `You have accepted the trip for ${name}.`);
      // }

      loadTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept trip');
    }
  };

  const promptReject = (tripId: string | number) => {
    setRejectTripId(tripId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const submitReject = async () => {
    if (!rejectTripId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejecting the trip.');
      return;
    }

    setRejectModalVisible(false);

    try {
      // Extract original_id if this is a leg trip
      const originalId = String(rejectTripId).includes('-') ? String(rejectTripId).split('-')[0] : rejectTripId;
      
      if (String(rejectTripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip rejected locally');
        setTrips(prev => prev.filter(t => t.id !== rejectTripId));
        return;
      }
      await tripsAPI.rejectTrip(originalId, driverId, rejectReason);
      Alert.alert('Success', 'Trip rejected');

      // if (Platform.OS === 'android' && isRunningInExpoGo()) {
      //   const trip = trips.find(t => t.id === rejectTripId);
      //   const name = trip ? trip.passenger_name : 'Passenger';
      //   showLocalNotification('Trip Rejected', `You have rejected the trip for ${name}.`);
      // }

      loadTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject trip');
    }
  };

  const handleComplete = async (tripId: string | number) => {
    try {
      // Extract original_id if this is a leg trip
      const originalId = String(tripId).includes('-') ? String(tripId).split('-')[0] : tripId;
      
      if (String(tripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip completed locally');
        setTrips(prev => prev.filter(t => t.id !== tripId));
        return;
      }
      await tripsAPI.completeTrip(originalId);
      Alert.alert('Success', 'Trip completed successfully');

      // if (Platform.OS === 'android' && isRunningInExpoGo()) {
      //   const trip = trips.find(t => t.id === tripId);
      //   const name = trip ? trip.passenger_name : 'Passenger';
      //   showLocalNotification('Trip Completed', `You have completed the trip for ${name}.`);
      // }

      loadTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to complete trip');
    }
  };

  const renderTrip = ({ item }: { item: Trip }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.passengerName, { color: colors.textPrimary }]}>{item.passenger_name}</Text>
        <View style={styles.headerBadges}>
          {item.leg && (
            <View style={[styles.legBadge, { backgroundColor: item.leg === 'outbound' ? '#6366f1' : '#f59e0b' }]}>
              <Text style={styles.legText}>{item.leg === 'outbound' ? 'OUTBOUND' : 'RETURN'}</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
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
        {item.start_date && (
          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <FontAwesome5 name="calendar-alt" size={12} color="#38bdf8" />
            </View>
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {item.start_date}{item.end_date && item.end_date !== item.start_date ? ` - ${item.end_date}` : ''}
            </Text>
          </View>
        )}
        {item.start_time && (
          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <FontAwesome5 name="clock" size={12} color="#38bdf8" />
            </View>
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {new Date(item.start_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </View>
        )}
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
        onPress={() => router.push({ 
          pathname: '/screens/trip-details', 
          params: { 
            tripId: item.original_id ? item.original_id.toString() : item.id.toString(),
            leg: item.leg || 'outbound'
          } 
        })}
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

      {activeTab === 'upcoming' && (
        <TouchableOpacity
          style={[styles.datePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowDatePicker(true)}
        >
          <FontAwesome5 name="calendar-alt" size={16} color={colors.accent} />
          <Text style={[styles.datePickerText, { color: colors.textPrimary }]}>
            {selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <FontAwesome5 name="chevron-down" size={12} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

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

      {/* Reject Reason Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={rejectModalVisible}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Reject Trip</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Please provide a reason for rejecting this trip.</Text>

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g., Too far, Vehicle issue..."
              placeholderTextColor="#94a3b8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmitButton]}
                onPress={submitReject}
              >
                <Text style={styles.modalSubmitText}>Submit Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showDatePicker}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Date</Text>
            <Calendar
              onDayPress={(day: DateData) => {
                setSelectedDate(new Date(day.dateString));
                setShowDatePicker(false);
              }}
              markedDates={{
                [selectedDate.toISOString().split('T')[0]]: {
                  selected: true,
                  selectedColor: colors.accent,
                  selectedTextColor: '#ffffff',
                },
              }}
              theme={{
                backgroundColor: colors.card,
                calendarBackground: colors.card,
                textSectionTitleColor: colors.textSecondary,
                selectedDayBackgroundColor: colors.accent,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.accent,
                dayTextColor: colors.textPrimary,
                textDisabledColor: colors.textSecondary,
                arrowColor: colors.accent,
                monthTextColor: colors.textPrimary,
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '500',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
              enableSwipeMonths={true}
            />
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    flex: 1,
    marginRight: 10,
  },
  legBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  legText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    flexDirection: 'column',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
    marginRight: 12,
  },
  modalSubmitButton: {
    backgroundColor: '#ef4444',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  datePickerContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dateOptionsContainer: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  dateOptionButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dateOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
});
