import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, FlatList, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiDelete } from '../../utils/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [timeStats, setTimeStats] = useState<any>(null);
  const [yearlyStats, setYearlyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [analysisLimit, setAnalysisLimit] = useState<any>(null);
  const [calendarStatus, setCalendarStatus] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [boroRes, timeRes, yearlyRes, limitRes, calRes] = await Promise.all([
        apiGet('/api/stats/boroughs'), apiGet('/api/stats/time-distribution'),
        apiGet('/api/stats/yearly'), apiGet('/api/safety/limit'),
        apiGet('/api/calendar/status'),
      ]);
      setStats(boroRes.stats);
      setTimeStats(timeRes.distribution);
      setYearlyStats(yearlyRes.stats);
      setAnalysisLimit(limitRes);
      setCalendarStatus(calRes);
    } catch {} finally { setLoading(false); }
  };

  const loadNotifications = async () => {
    try {
      const res = await apiGet('/api/notifications');
      setNotifications(res.notifications || []);
    } catch {}
  };

  const markRead = async () => {
    try {
      await apiPost('/api/notifications/mark-read', {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      refreshUser();
    } catch {}
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const origin = Platform.OS === 'web' ? (window as any).location.origin : process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const res = await apiPost('/api/subscription/checkout', { origin_url: origin });
      if (res.url) {
        if (Platform.OS === 'web') {
          (window as any).location.href = res.url;
        } else {
          await Linking.openURL(res.url);
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to start checkout');
    } finally { setUpgrading(false); }
  };

  const connectCalendar = async () => {
    try {
      const res = await apiGet('/api/calendar/auth-url');
      if (res.authorization_url) {
        if (Platform.OS === 'web') {
          (window as any).location.href = res.authorization_url;
        } else {
          await Linking.openURL(res.authorization_url);
        }
      }
    } catch (error: any) {
      alert(error.message || 'Google Calendar not configured');
    }
  };

  const disconnectCalendar = async () => {
    try {
      await apiDelete('/api/calendar/disconnect');
      setCalendarStatus({ configured: calendarStatus?.configured, connected: false });
      refreshUser();
    } catch {}
  };

  const isPremium = user?.subscription_tier === 'premium';

  const getRiskColorForBoro = (total: number) => {
    if (total > 1000) return '#EF4444';
    if (total > 500) return '#FB7185';
    if (total > 200) return '#FBBF24';
    return '#34D399';
  };

  const getNotifIcon = (type: string): any => {
    switch (type) {
      case 'community_report': return 'megaphone';
      case 'calendar_digest': return 'calendar';
      case 'subscription': return 'star';
      case 'safety_alert': return 'warning';
      default: return 'notifications';
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity testID="open-notifications" onPress={() => { setShowNotifs(true); loadNotifications(); }} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color="#A1A1AA" />
            {(user?.unread_notifications || 0) > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{user?.unread_notifications}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <View style={[styles.tierBadge, isPremium && styles.premiumBadge]}>
            <Ionicons name={isPremium ? 'star' : 'person'} size={12} color={isPremium ? '#FBBF24' : '#0EA5E9'} />
            <Text style={[styles.tierText, isPremium && styles.premiumText]}>{isPremium ? 'PREMIUM' : 'FREE'}</Text>
          </View>
        </View>

        {/* Analysis Limit */}
        {analysisLimit && !isPremium && (
          <View style={styles.limitCard}>
            <View style={styles.limitInfo}>
              <Text style={styles.limitTitle}>Daily Analyses</Text>
              <Text style={styles.limitCount}>{analysisLimit.used}/{analysisLimit.limit}</Text>
            </View>
            <View style={styles.limitBar}>
              <View style={[styles.limitProgress, { width: `${(analysisLimit.used / analysisLimit.limit) * 100}%` }]} />
            </View>
            <Text style={styles.limitHint}>{analysisLimit.remaining} remaining today</Text>
          </View>
        )}

        {/* Premium Upgrade */}
        {!isPremium && (
          <TouchableOpacity testID="upgrade-premium-button" style={styles.premiumCard} onPress={() => setShowPremium(true)}>
            <View style={styles.premiumIconWrap}>
              <Ionicons name="diamond" size={28} color="#FBBF24" />
            </View>
            <View style={styles.premiumInfo}>
              <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
              <Text style={styles.premiumDesc}>Unlimited analyses, calendar sync & more</Text>
            </View>
            <Text style={styles.premiumPrice}>$9.99</Text>
            <Ionicons name="chevron-forward" size={20} color="#71717A" />
          </TouchableOpacity>
        )}

        {/* Google Calendar */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>GOOGLE CALENDAR</Text>
        </View>
        <View style={styles.calendarCard}>
          <Ionicons name="logo-google" size={22} color={calendarStatus?.connected ? '#34D399' : '#71717A'} />
          <View style={styles.calendarInfo}>
            <Text style={styles.calendarTitle}>
              {calendarStatus?.connected ? 'Connected' : 'Not Connected'}
            </Text>
            <Text style={styles.calendarDesc}>
              {!calendarStatus?.configured ? 'Admin needs to configure Google API credentials' :
                calendarStatus?.connected ? 'Your calendar events are synced for safety analysis' :
                isPremium ? 'Connect to auto-analyze your schedule' : 'Premium feature - upgrade to connect'}
            </Text>
          </View>
          {calendarStatus?.configured && isPremium && (
            calendarStatus?.connected ? (
              <TouchableOpacity testID="disconnect-calendar" onPress={disconnectCalendar}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity testID="connect-calendar" style={styles.connectBtn} onPress={connectCalendar}>
                <Text style={styles.connectBtnText}>Connect</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Stats */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NYC SHOOTING STATISTICS</Text>
        </View>

        {loading ? <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} /> : (
          <>
            {stats && (
              <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>By Borough</Text>
                {stats.map((s: any) => (
                  <View key={s.boro} style={styles.statRow}>
                    <View style={styles.statLabel}>
                      <View style={[styles.statDot, { backgroundColor: getRiskColorForBoro(s.total) }]} />
                      <Text style={styles.statName}>{s.boro}</Text>
                    </View>
                    <View style={styles.statValues}>
                      <Text style={styles.statTotal}>{s.total.toLocaleString()}</Text>
                      <Text style={styles.statMurders}>{s.murders} fatal</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {timeStats && (
              <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>By Time of Day</Text>
                {Object.entries(timeStats).map(([key, value]) => {
                  const labels: Record<string, string> = { '00-06': 'Midnight - 6 AM', '06-12': '6 AM - Noon', '12-18': 'Noon - 6 PM', '18-24': '6 PM - Midnight' };
                  const icons: Record<string, any> = { '00-06': 'moon', '06-12': 'sunny', '12-18': 'partly-sunny', '18-24': 'cloudy-night' };
                  const total = Object.values(timeStats).reduce((a: number, b: any) => a + b, 0) as number;
                  const pct = total > 0 ? ((value as number) / total * 100).toFixed(1) : '0';
                  return (
                    <View key={key} style={styles.timeRow}>
                      <View style={styles.timeInfo}>
                        <Ionicons name={icons[key] || 'time'} size={16} color="#71717A" />
                        <Text style={styles.timeLabel}>{labels[key] || key}</Text>
                      </View>
                      <View style={styles.timeBarWrap}>
                        <View style={[styles.timeBar, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.timePct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        <TouchableOpacity testID="logout-button" style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#FB7185" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>Agentic Safeguard v2.0{'\n'}Data: NYPD Shooting Incident Data (2006-Present)</Text>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal visible={showNotifs} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity testID="mark-read-button" onPress={markRead}>
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowNotifs(false)}>
                  <Ionicons name="close-circle" size={28} color="#71717A" />
                </TouchableOpacity>
              </View>
            </View>
            {notifications.length === 0 ? (
              <View style={styles.emptyNotifs}>
                <Ionicons name="notifications-off-outline" size={40} color="#3F3F46" />
                <Text style={styles.emptyNotifsText}>No notifications yet</Text>
              </View>
            ) : (
              <FlatList data={notifications} keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.notifItem, !item.read && styles.notifUnread]}>
                    <View style={styles.notifIcon}>
                      <Ionicons name={getNotifIcon(item.type)} size={18} color="#0EA5E9" />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={styles.notifTitle}>{item.title}</Text>
                      <Text style={styles.notifMsg} numberOfLines={2}>{item.message}</Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Premium Modal */}
      <Modal visible={showPremium} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Premium Plan</Text>
              <TouchableOpacity onPress={() => setShowPremium(false)}>
                <Ionicons name="close-circle" size={28} color="#71717A" />
              </TouchableOpacity>
            </View>
            <View style={styles.premiumHero}>
              <Ionicons name="diamond" size={48} color="#FBBF24" />
              <Text style={styles.premiumHeroPrice}>$9.99<Text style={styles.premiumHeroPer}>/month</Text></Text>
            </View>
            <View style={styles.featureList}>
              {[
                ['analytics', 'Unlimited safety analyses'],
                ['calendar', 'Google Calendar integration'],
                ['megaphone', 'Priority community reports'],
                ['flash', 'Real-time safety alerts'],
                ['shield-checkmark', 'Advanced AI insights'],
                ['people', 'Priority support'],
              ].map(([icon, text], i) => (
                <View key={i} style={styles.featureItem}>
                  <Ionicons name={icon as any} size={18} color="#FBBF24" />
                  <Text style={styles.featureText}>{text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity testID="checkout-premium-button" style={[styles.checkoutBtn, upgrading && styles.checkoutBtnDisabled]}
              onPress={handleUpgrade} disabled={upgrading}>
              {upgrading ? <ActivityIndicator color="#09090B" size="small" /> : (
                <Text style={styles.checkoutBtnText}>Upgrade Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  scroll: { paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  headerTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  notifBtn: { position: 'relative', padding: 8 },
  notifBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  notifBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  profileCard: { alignItems: 'center', paddingVertical: 24, marginHorizontal: 16, marginTop: 8, backgroundColor: '#18181B', borderRadius: 20, borderWidth: 1, borderColor: '#27272A' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#0EA5E9', fontSize: 28, fontWeight: '300' },
  userName: { color: '#FAFAFA', fontSize: 20, fontWeight: '500' },
  userEmail: { color: '#71717A', fontSize: 14, marginTop: 4 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(14,165,233,0.1)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)' },
  premiumBadge: { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' },
  tierText: { color: '#0EA5E9', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  premiumText: { color: '#FBBF24' },
  limitCard: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#18181B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#27272A' },
  limitInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  limitTitle: { color: '#A1A1AA', fontSize: 13 },
  limitCount: { color: '#FAFAFA', fontSize: 13, fontWeight: '600' },
  limitBar: { height: 4, backgroundColor: '#27272A', borderRadius: 2, overflow: 'hidden' },
  limitProgress: { height: '100%', backgroundColor: '#0EA5E9', borderRadius: 2 },
  limitHint: { color: '#52525B', fontSize: 11, marginTop: 6 },
  premiumCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, backgroundColor: '#18181B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', gap: 12 },
  premiumIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(251,191,36,0.1)', alignItems: 'center', justifyContent: 'center' },
  premiumInfo: { flex: 1 },
  premiumTitle: { color: '#FAFAFA', fontSize: 15, fontWeight: '500' },
  premiumDesc: { color: '#71717A', fontSize: 12, marginTop: 2 },
  premiumPrice: { color: '#FBBF24', fontSize: 18, fontWeight: '600' },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  sectionTitle: { color: '#71717A', fontSize: 11, fontWeight: '600', letterSpacing: 2 },
  calendarCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, gap: 12, backgroundColor: '#18181B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#27272A' },
  calendarInfo: { flex: 1 },
  calendarTitle: { color: '#FAFAFA', fontSize: 14, fontWeight: '500' },
  calendarDesc: { color: '#71717A', fontSize: 12, marginTop: 2 },
  connectBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#0EA5E9' },
  connectBtnText: { color: '#09090B', fontSize: 13, fontWeight: '600' },
  disconnectText: { color: '#FB7185', fontSize: 13 },
  statsCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#18181B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#27272A' },
  cardTitle: { color: '#FAFAFA', fontSize: 16, fontWeight: '500', marginBottom: 14 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statName: { color: '#D4D4D8', fontSize: 14 },
  statValues: { alignItems: 'flex-end' },
  statTotal: { color: '#FAFAFA', fontSize: 14, fontWeight: '500' },
  statMurders: { color: '#FB7185', fontSize: 11, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  timeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 140 },
  timeLabel: { color: '#A1A1AA', fontSize: 13 },
  timeBarWrap: { flex: 1, height: 6, backgroundColor: '#27272A', borderRadius: 3, overflow: 'hidden' },
  timeBar: { height: '100%', backgroundColor: '#0EA5E9', borderRadius: 3 },
  timePct: { color: '#FAFAFA', fontSize: 12, fontWeight: '500', width: 42, textAlign: 'right' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(251,113,133,0.3)', backgroundColor: 'rgba(251,113,133,0.05)' },
  logoutText: { color: '#FB7185', fontSize: 15, fontWeight: '500' },
  footer: { color: '#3F3F46', fontSize: 11, textAlign: 'center', marginTop: 24, lineHeight: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { backgroundColor: '#18181B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: '#27272A' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3F3F46', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '300' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markReadText: { color: '#0EA5E9', fontSize: 13 },
  emptyNotifs: { alignItems: 'center', paddingVertical: 40 },
  emptyNotifsText: { color: '#71717A', marginTop: 8 },
  notifItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  notifUnread: { backgroundColor: 'rgba(14,165,233,0.05)' },
  notifIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(14,165,233,0.1)', alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { color: '#FAFAFA', fontSize: 14, fontWeight: '500' },
  notifMsg: { color: '#71717A', fontSize: 12, marginTop: 2 },
  premiumHero: { alignItems: 'center', paddingVertical: 24 },
  premiumHeroPrice: { color: '#FAFAFA', fontSize: 36, fontWeight: '300', marginTop: 12 },
  premiumHeroPer: { color: '#71717A', fontSize: 16 },
  featureList: { gap: 14, marginBottom: 24 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { color: '#D4D4D8', fontSize: 15 },
  checkoutBtn: { backgroundColor: '#FBBF24', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  checkoutBtnDisabled: { opacity: 0.7 },
  checkoutBtnText: { color: '#09090B', fontSize: 16, fontWeight: '600' },
});
