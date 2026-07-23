import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';
import { tripsAPI, session } from '@/services/api';

export default function TripDetailsScreen() {
  const { tripId } = useLocalSearchParams();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const driverId = session.user?.id || 'cf6912d9-6617-482b-aacf-dd034c780185';
  const agencyId = session.user?.agency_id || '6e7cdb44-603c-46c4-a4ca-198334c34314';

  useEffect(() => {
    loadTripDetails();
  }, [tripId]);

  const loadTripDetails = async () => {
    try {
      setLoading(true);
      // Fetch trips from database for the driver
      const trips = await tripsAPI.getTrips(undefined, driverId, agencyId);
      
      const formattedDbTrips = trips.map((ts: any) => {
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
            // ignore parsing failure
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
          source: 'postgres'
        };
      });

      // Mock trips for frontend display
      const mockTrips: any[] = [
        {
          id: 'mock-1',
          passenger_name: 'Aditi Sharma (Mock)',
          passenger_phone: '9876543210',
          pickup_location: 'Coimbatore Airport, Coimbatore',
          pickup_lat: 11.03,
          pickup_lng: 77.04,
          dropoff_location: 'Gandhipuram Bus Stand, Coimbatore',
          dropoff_lat: 11.02,
          dropoff_lng: 76.97,
          status: 'pending',
          fare: 350,
          distance: 12.5,
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-2',
          passenger_name: 'Rajesh Kumar (Mock)',
          passenger_phone: '9876543211',
          pickup_location: 'Railway Station, Coimbatore',
          pickup_lat: 10.99,
          pickup_lng: 76.96,
          dropoff_location: 'PSG College of Technology, Coimbatore',
          dropoff_lat: 11.02,
          dropoff_lng: 77.00,
          status: 'accepted',
          fare: 220,
          distance: 6.8,
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-3',
          passenger_name: 'Meena Patel (Mock)',
          passenger_phone: '9876543212',
          pickup_location: 'Brookefields Mall, Coimbatore',
          pickup_lat: 11.01,
          pickup_lng: 76.96,
          dropoff_location: 'TIDEL Park, Coimbatore',
          dropoff_lat: 11.02,
          dropoff_lng: 77.03,
          status: 'completed',
          fare: 400,
          distance: 14.2,
          created_at: new Date().toISOString()
        }
      ];

      const allTrips = [...formattedDbTrips, ...mockTrips];
      const tripData = allTrips.find((t: any) => String(t.id) === String(tripId));
      setTrip(tripData);
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again');
        router.replace('/');
      } else {
        Alert.alert('Error', 'Failed to load trip details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      if (String(tripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip accepted locally');
        setTrip((prev: any) => ({ ...prev, status: 'accepted' }));
        return;
      }
      await tripsAPI.acceptTrip(tripId as string, driverId);
      Alert.alert('Success', 'Trip accepted successfully');
      loadTripDetails();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept trip');
    }
  };

  const handleReject = async () => {
    try {
      if (String(tripId).startsWith('mock-')) {
        Alert.alert('Success (Mock)', 'Mock trip rejected locally');
        router.back();
        return;
      }
      await tripsAPI.rejectTrip(tripId as string, driverId);
      Alert.alert('Success', 'Trip rejected');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject trip');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome5 name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.passengerInfo}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user" size={32} color="#6366f1" />
          </View>
          <View style={styles.passengerDetails}>
            <Text style={styles.passengerName}>{trip.passenger_name}</Text>
            <Text style={styles.passengerPhone}>{trip.passenger_phone}</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
            <Text style={styles.statusText}>{trip.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Route Information</Text>

        <View style={styles.timelineContainer}>
          <View style={styles.timelineLeft}>
            <View style={[styles.timelineDot, { backgroundColor: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }]} />
            <View style={styles.timelineLine} />
            <View style={[styles.timelineDot, { backgroundColor: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }]} />
          </View>
          <View style={styles.timelineRight}>
            <View style={styles.locationGroup}>
              <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
              <Text style={styles.locationText}>{trip.pickup_location}</Text>
            </View>
            <View style={{ height: 24 }} />
            <View style={styles.locationGroup}>
              <Text style={styles.locationLabel}>DROPOFF LOCATION</Text>
              <Text style={styles.locationText}>{trip.dropoff_location}</Text>
            </View>
          </View>
        </View>
      </View>

      {trip.pickup_lat && trip.pickup_lng && trip.dropoff_lat && trip.dropoff_lng && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Route Map</Text>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (trip.pickup_lat + trip.dropoff_lat) / 2,
              longitude: (trip.pickup_lng + trip.dropoff_lng) / 2,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker
              coordinate={{
                latitude: trip.pickup_lat,
                longitude: trip.pickup_lng,
              }}
              title="Pickup Location"
              pinColor="#22c55e"
            />
            <Marker
              coordinate={{
                latitude: trip.dropoff_lat,
                longitude: trip.dropoff_lng,
              }}
              title="Dropoff Location"
              pinColor="#ef4444"
            />
            <Polyline
              coordinates={[
                { latitude: trip.pickup_lat, longitude: trip.pickup_lng },
                { latitude: trip.dropoff_lat, longitude: trip.dropoff_lng },
              ]}
              strokeColor="#6366f1"
              strokeWidth={3}
            />
          </MapView>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trip Details</Text>
        
        <View style={styles.detailRow}>
          <FontAwesome5 name="road" size={18} color="#38bdf8" />
          <Text style={styles.detailLabel}>Distance:</Text>
          <Text style={styles.detailValue}>{trip.distance ? `${trip.distance} km` : 'Not specified'}</Text>
        </View>

        <View style={styles.detailRow}>
          <FontAwesome5 name="clock" size={18} color="#38bdf8" />
          <Text style={styles.detailLabel}>Created:</Text>
          <Text style={styles.detailValue}>{new Date(trip.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
        </View>
      </View>

      {trip.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={handleReject}>
            <Text style={styles.actionButtonText}>Reject Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={handleAccept}>
            <Text style={styles.actionButtonText}>Accept Trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#f59e0b';
    case 'accepted': return '#10b981';
    case 'rejected': return '#ef4444';
    case 'completed': return '#6366f1';
    default: return '#64748b';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    margin: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  passengerDetails: {
    marginLeft: 16,
    flex: 1,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  passengerPhone: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 16,
  },
  timelineContainer: {
    flexDirection: 'row',
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
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 12,
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 16,
    color: '#94a3b8',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 16,
    color: '#ef4444',
  },
});
