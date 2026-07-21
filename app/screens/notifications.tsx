import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { notificationsAPI } from '@/services/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';


interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  trip_id: number | null;
  created_at: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = 1; // In real app, get from auth context

  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const colors = {
    background: isDark ? '#0b0f19' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    accent: '#6366f1',
    unreadGlow: 'rgba(99, 102, 241, 0.15)',
  };


  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationsAPI.getNotifications(userId);
      setNotifications(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      loadNotifications();
    } catch (error) {
      Alert.alert('Error', 'Failed to mark as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trip_request': return 'taxi';
      case 'trip_accepted': return 'check-circle';
      case 'trip_rejected': return 'times-circle';
      case 'system': return 'bell';
      default: return 'bell';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'trip_request': return '#f59e0b';
      case 'trip_accepted': return '#22c55e';
      case 'trip_rejected': return '#ef4444';
      case 'system': return '#6366f1';
      default: return '#9ca3af';
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, !item.is_read && styles.unreadCard]}
      onPress={() => !item.is_read && handleMarkAsRead(item.id)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) }]}>
          <FontAwesome5 name={getNotificationIcon(item.type)} size={20} color="#fff" />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
        {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
      </View>
      
      <Text style={[styles.message, { color: colors.textSecondary }]}>{item.message}</Text>
      
      {item.trip_id && (
        <TouchableOpacity style={styles.tripLink}>
          <Text style={[styles.tripLinkText, { color: colors.accent }]}>View Trip →</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        {router.canGoBack() && (
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FontAwesome5 name="arrow-left" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        <View style={styles.headerCountBadge}>
          <Text style={styles.headerCountText}>
            {notifications.filter((n) => !n.is_read).length} Unread
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading notifications...</Text>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="bell-slash" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications</Text>
            </View>
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
  headerCountBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginLeft: 10,
  },
  headerCountText: {
    color: '#6366f1',
    fontSize: 11,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  time: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
  message: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    marginLeft: 52,
  },
  tripLink: {
    marginTop: 8,
    marginLeft: 52,
  },
  tripLinkText: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '700',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 16,
    color: '#94a3b8',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
    fontWeight: '600',
  },
});
