import { useColorScheme } from '@/hooks/use-color-scheme';
import { session, tripsAPI } from '@/services/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Vibration, Alert, Modal, TextInput } from 'react-native';

export default function Dashboard() {
  const [availableCount, setAvailableCount] = useState<number | string>('-');
  const [myTripsCount, setMyTripsCount] = useState<number | string>('-');
  const [urgentTrip, setUrgentTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTripId, setRejectTripId] = useState<string | number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const driverId = session.user?.id || 'cf6912d9-6617-482b-aacf-dd034c780185';
  const agencyId = session.user?.agency_id || '6e7cdb44-603c-46c4-a4ca-198334c34314';

  // Dynamic colors
  const colors = {
    background: isDark ? '#0b0f19' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    accent: '#6366f1',
    accentLight: 'rgba(99, 102, 241, 0.12)',
    success: '#10b981',
    successLight: 'rgba(16, 185, 129, 0.15)',
    glowDot: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        setLoading(true);
        const trips = await tripsAPI.getTrips(undefined, driverId, agencyId);

        const available = trips.filter((t: any) =>
          t.driver_response !== 'accepted' &&
          t.driver_response !== 'declined' &&
          t.status !== 'completed' &&
          t.is_active === true
        ).length;

        const myTrips = trips.filter((t: any) =>
          t.driver_response === 'accepted' &&
          t.status !== 'completed' &&
          t.is_active === true
        ).length;

        setAvailableCount(available);
        setMyTripsCount(myTrips);

        const now = new Date();
        const urgent = trips.find((t: any) => {
          const isPending = !t.driver_response || t.driver_response === 'pending';
          if (!isPending || t.status === 'completed' || t.is_active === false) return false;
          if (!t.start_date || !t.one_way_start_time) return false;
          
          const startTime = new Date(`${t.start_date}T${t.one_way_start_time}`);
          const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60);
          return diffMinutes >= 0 && diffMinutes <= 5;
        });
        setUrgentTrip(urgent);
      } catch (error) {
        console.error('Failed to fetch dashboard counts:', error);
        setAvailableCount(0);
        setMyTripsCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (urgentTrip) {
      Vibration.vibrate([1000, 1000, 1000], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [urgentTrip]);

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
      await tripsAPI.rejectTrip(rejectTripId, driverId, rejectReason);
      Alert.alert('Declined', 'Trip Declined.');
      setUrgentTrip(null);
      Vibration.cancel();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject trip.');
    }
  };

  const handleUrgentAction = async (action: 'accept' | 'decline') => {
    if (!urgentTrip) return;
    try {
      if (action === 'accept') {
        await tripsAPI.acceptTrip(urgentTrip.id, driverId);
        Alert.alert('Success', 'Trip Accepted!');
        setUrgentTrip(null);
        Vibration.cancel();
      } else {
        promptReject(urgentTrip.id);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update trip status.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.accentLight, borderColor: colors.accent }]}>
          <FontAwesome5 name="user-astronaut" size={20} color={colors.accent} />
        </View>
        <View style={styles.profileDetails}>
          <Text style={styles.profileGreeting}>WELCOME BACK</Text>
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>{session.user?.name || 'Active Driver'}</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusGlowDot} />
          <Text style={styles.statusPillText}>ON DUTY</Text>
        </View>
      </View>

      {urgentTrip && (
        <View style={[styles.urgentCard, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: colors.danger }]}>
          <Text style={[styles.urgentTitle, { color: colors.danger }]}>URGENT: TRIP STARTING SOON</Text>
          <Text style={[styles.urgentText, { color: colors.textPrimary }]}>
            Trip for {urgentTrip.passenger_name || urgentTrip.company_name} at {urgentTrip.starting_point} starts in less than 5 minutes!
          </Text>
          <View style={styles.urgentActions}>
            <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: colors.success }]} onPress={() => handleUrgentAction('accept')}>
              <Text style={styles.urgentBtnText}>ACCEPT TRIP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: colors.danger }]} onPress={() => handleUrgentAction('decline')}>
              <Text style={styles.urgentBtnText}>DECLINE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Live Telemetry Widget */}
      {/* <View style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.liveCardHeader}>
          <View style={[styles.liveBadge, { backgroundColor: colors.successLight }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.liveBadgeText, { color: colors.success }]}>GPS LINK ACTIVE</Text>
          </View>
          <Text style={styles.radarTime}>LIVE</Text>
        </View>
        
        <Text style={[styles.liveCardTitle, { color: colors.textPrimary }]}>Awaiting Assignation</Text>
        <Text style={[styles.liveCardDesc, { color: colors.textSecondary }]}>
          Your current telemetry is feeding back to dispatch. Status is updated in real time.
        </Text>

        <View style={[styles.liveFooter, { borderTopColor: colors.border }]}>
          <View style={styles.liveStat}>
            <Text style={[styles.liveStatVal, { color: colors.textPrimary }]}>{myTripsCount}</Text>
            <Text style={[styles.liveStatLabel, { color: colors.textSecondary }]}>Active Schedules</Text>
          </View>
          <View style={[styles.liveStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.liveStat}>
            <Text style={[styles.liveStatVal, { color: colors.accent }]}>100%</Text>
            <Text style={[styles.liveStatLabel, { color: colors.textSecondary }]}>Signal Quality</Text>
          </View>
        </View>
      </View> */}

      {/* Quick Actions Panel */}
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, { color: colors.textSecondary }]}>QUICK CONTROLS</Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/screens/map' as any)}>
          <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
            <FontAwesome5 name="map-marked-alt" size={16} color="#ec4899" />
          </View>
          <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Live Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/screens/trips' as any)}>
          <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
            <FontAwesome5 name="taxi" size={16} color="#38bdf8" />
          </View>
          <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>View Trips</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/screens/settings' as any)}>
          <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
            <FontAwesome5 name="cog" size={16} color="#818cf8" />
          </View>
          <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Operational Metrics (Moved down!) */}
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, { color: colors.textSecondary }]}>REALTIME OPERATIONAL METRICS</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Updating dispatch data...</Text>
        </View>
      ) : (
        <View style={styles.metricsContainer}>
          {/* Available Jobs Row */}
          <TouchableOpacity
            style={[styles.metricRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/screens/trips' as any)}
          >
            <View style={[styles.metricIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <FontAwesome5 name="briefcase" size={18} color="#10b981" />
            </View>
            <View style={styles.metricTextContent}>
              <Text style={[styles.metricName, { color: colors.textPrimary }]}>Available Assignments</Text>
              <Text style={[styles.metricDesc, { color: colors.textSecondary }]}>Pending schedules waiting for your response.</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
              <Text style={[styles.countText, { color: '#10b981' }]}>{availableCount}</Text>
            </View>
          </TouchableOpacity>

          {/* Active Schedules Row */}
          <TouchableOpacity
            style={[styles.metricRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/screens/trips' as any)}
          >
            <View style={[styles.metricIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <FontAwesome5 name="car" size={18} color="#38bdf8" />
            </View>
            <View style={styles.metricTextContent}>
              <Text style={[styles.metricName, { color: colors.textPrimary }]}>Active Schedules</Text>
              <Text style={[styles.metricDesc, { color: colors.textSecondary }]}>Accepted trips currently on your duty list.</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: 'rgba(56, 189, 248, 0.18)' }]}>
              <Text style={[styles.countText, { color: '#38bdf8' }]}>{myTripsCount}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Terminate Session Action */}
      <TouchableOpacity
        style={[styles.logoutRow, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)' }]}
        onPress={() => router.replace('/')}
      >
        <FontAwesome5 name="sign-out-alt" size={14} color="#ef4444" />
        <Text style={styles.logoutText}>Terminate Active Session</Text>
      </TouchableOpacity>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 25,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  profileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  profileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  profileGreeting: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusGlowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  liveCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  liveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  radarTime: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 1,
  },
  liveCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  liveCardDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 20,
  },
  liveFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  liveStat: {
    alignItems: 'center',
  },
  liveStatVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  liveStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  liveStatDivider: {
    width: 1,
    height: 30,
  },
  panelHeader: {
    marginBottom: 10,
    paddingLeft: 4,
  },
  panelTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionBtn: {
    width: '31%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  metricsContainer: {
    marginBottom: 20,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  metricIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTextContent: {
    marginLeft: 14,
    flex: 1,
    paddingRight: 10,
  },
  metricName: {
    fontSize: 14,
    fontWeight: '800',
  },
  metricDesc: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  countBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 15,
    marginBottom: 40,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
    marginLeft: 8,
  },
  urgentCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  urgentTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  urgentText: {
    fontSize: 14,
    marginBottom: 16,
  },
  urgentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  urgentBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  urgentBtnText: {
    color: '#fff',
    fontWeight: '700',
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
});