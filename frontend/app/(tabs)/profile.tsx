import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../utils/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [timeStats, setTimeStats] = useState<any>(null);
  const [yearlyStats, setYearlyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [boroRes, timeRes, yearlyRes] = await Promise.all([
        apiGet('/api/stats/boroughs'),
        apiGet('/api/stats/time-distribution'),
        apiGet('/api/stats/yearly'),
      ]);
      setStats(boroRes.stats);
      setTimeStats(timeRes.distribution);
      setYearlyStats(yearlyRes.stats);
    } catch {} finally {
      setLoading(false);
    }
  };

  const getRiskColorForBoro = (total: number) => {
    if (total > 1000) return '#EF4444';
    if (total > 500) return '#FB7185';
    if (total > 200) return '#FBBF24';
    return '#34D399';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'USER'}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NYC SHOOTING STATISTICS</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} />
        ) : (
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
                  const labels: Record<string, string> = {
                    '00-06': 'Midnight - 6 AM',
                    '06-12': '6 AM - Noon',
                    '12-18': 'Noon - 6 PM',
                    '18-24': '6 PM - Midnight',
                  };
                  const icons: Record<string, any> = {
                    '00-06': 'moon',
                    '06-12': 'sunny',
                    '12-18': 'partly-sunny',
                    '18-24': 'cloudy-night',
                  };
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

            {yearlyStats && yearlyStats.length > 0 && (
              <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>Recent Years</Text>
                {yearlyStats.slice(0, 5).map((s: any) => (
                  <View key={s.year} style={styles.yearRow}>
                    <Text style={styles.yearLabel}>{s.year}</Text>
                    <View style={styles.yearBarWrap}>
                      <View style={[styles.yearBar, {
                        width: `${Math.min(100, (s.total / (yearlyStats[0]?.total || 1)) * 100)}%`,
                      }]} />
                    </View>
                    <Text style={styles.yearTotal}>{s.total}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          testID="logout-button"
          style={styles.logoutBtn}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#FB7185" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Agentic Safeguard v1.0{'\n'}
          Data: NYPD Shooting Incident Data (2006-Present)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  scroll: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  headerTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  profileCard: {
    alignItems: 'center', paddingVertical: 28,
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: '#18181B', borderRadius: 20,
    borderWidth: 1, borderColor: '#27272A',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(14,165,233,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#0EA5E9', fontSize: 28, fontWeight: '300' },
  userName: { color: '#FAFAFA', fontSize: 20, fontWeight: '500' },
  userEmail: { color: '#71717A', fontSize: 14, marginTop: 4 },
  roleBadge: {
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)',
  },
  roleText: { color: '#0EA5E9', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 },
  sectionTitle: { color: '#71717A', fontSize: 11, fontWeight: '600', letterSpacing: 2 },
  statsCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#18181B', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#27272A',
  },
  cardTitle: { color: '#FAFAFA', fontSize: 16, fontWeight: '500', marginBottom: 14 },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#27272A',
  },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statName: { color: '#D4D4D8', fontSize: 14 },
  statValues: { alignItems: 'flex-end' },
  statTotal: { color: '#FAFAFA', fontSize: 14, fontWeight: '500' },
  statMurders: { color: '#FB7185', fontSize: 11, marginTop: 2 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, gap: 10,
  },
  timeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 140 },
  timeLabel: { color: '#A1A1AA', fontSize: 13 },
  timeBarWrap: {
    flex: 1, height: 6, backgroundColor: '#27272A',
    borderRadius: 3, overflow: 'hidden',
  },
  timeBar: { height: '100%', backgroundColor: '#0EA5E9', borderRadius: 3 },
  timePct: { color: '#FAFAFA', fontSize: 12, fontWeight: '500', width: 42, textAlign: 'right' },
  yearRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, gap: 10,
  },
  yearLabel: { color: '#A1A1AA', fontSize: 13, width: 44 },
  yearBarWrap: {
    flex: 1, height: 6, backgroundColor: '#27272A',
    borderRadius: 3, overflow: 'hidden',
  },
  yearBar: { height: '100%', backgroundColor: '#FBBF24', borderRadius: 3 },
  yearTotal: { color: '#FAFAFA', fontSize: 12, fontWeight: '500', width: 42, textAlign: 'right' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 24,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(251,113,133,0.3)',
    backgroundColor: 'rgba(251,113,133,0.05)',
  },
  logoutText: { color: '#FB7185', fontSize: 15, fontWeight: '500' },
  footer: {
    color: '#3F3F46', fontSize: 11, textAlign: 'center',
    marginTop: 24, lineHeight: 18,
  },
});
