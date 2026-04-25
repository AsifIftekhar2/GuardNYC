import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, Picker,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';

// Helper function to clean markdown formatting
const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove bold **text**
    .replace(/\*(.+?)\*/g, '$1')      // Remove italic *text*
    .replace(/^[-*•]\s+/gm, '• ')     // Normalize list bullets
    .replace(/^#{1,6}\s+(.+)$/gm, '$1') // Remove headers
    .replace(/`(.+?)`/g, '$1')        // Remove code backticks
    .trim();
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [dailyBrief, setDailyBrief] = useState<any>(null);
  const [briefSettings, setBriefSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedHour, setSelectedHour] = useState(6);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [brief, settings] = await Promise.all([
        apiGet('/api/daily-brief'),
        apiGet('/api/brief-settings')
      ]);
      // Clean markdown from brief text
      if (brief && brief.brief) {
        brief.brief = cleanMarkdown(brief.brief);
      }
      setDailyBrief(brief);
      setBriefSettings(settings);
      setSelectedHour(settings.preferred_hour);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDailyBrief = async (force = false) => {
    try {
      const url = force ? '/api/daily-brief?force=true' : '/api/daily-brief';
      const brief = await apiGet(url);
      // Clean markdown from brief text
      if (brief && brief.brief) {
        brief.brief = cleanMarkdown(brief.brief);
      }
      setDailyBrief(brief);
    } catch (error) {
      console.error('Failed to load daily brief:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const updateBriefTime = async () => {
    try {
      await apiPost('/api/brief-settings', { preferred_hour: selectedHour });
      await loadData();
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
      alert('Failed to update settings');
    }
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />
        }
      >
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
          <Ionicons name="today" size={20} color="#0EA5E9" />
          <Text style={styles.sectionTitle}>TODAY'S BRIEF</Text>
          <TouchableOpacity 
            onPress={() => setShowSettings(true)}
            style={styles.settingsIcon}
          >
            <Ionicons name="settings-outline" size={18} color="#71717A" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Analyzing your plans...</Text>
          </View>
        ) : dailyBrief ? (
          <View style={styles.briefCard}>
            <View style={styles.briefHeader}>
              <View style={styles.briefStats}>
                <View style={styles.statItem}>
                  <Ionicons name="calendar" size={16} color="#71717A" />
                  <Text style={styles.statText}>{dailyBrief.plans_count} plan{dailyBrief.plans_count !== 1 ? 's' : ''}</Text>
                </View>
                {dailyBrief.avg_risk && (
                  <View style={styles.statItem}>
                    <Ionicons 
                      name={dailyBrief.avg_risk >= 7 ? "alert-circle" : dailyBrief.avg_risk >= 4 ? "warning" : "shield-checkmark"} 
                      size={16} 
                      color={dailyBrief.avg_risk >= 7 ? "#EF4444" : dailyBrief.avg_risk >= 4 ? "#FBBF24" : "#34D399"} 
                    />
                    <Text style={styles.statText}>Avg {dailyBrief.avg_risk}/10</Text>
                  </View>
                )}
              </View>
              {dailyBrief.has_risks && (
                <View style={styles.riskWarning}>
                  <Ionicons name="warning" size={14} color="#FB923C" />
                  <Text style={styles.riskWarningText}>High-risk events detected</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.briefText}>{dailyBrief.brief}</Text>
            
            {dailyBrief.next_generation && (
              <Text style={styles.nextGenText}>
                📅 Next brief: {dailyBrief.next_generation}
              </Text>
            )}
            
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => loadDailyBrief(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color="#0EA5E9" />
              <Text style={styles.refreshButtonText}>Regenerate Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.briefCard}>
            <Text style={styles.briefText}>No daily brief available. Add some plans to get started!</Text>
          </View>
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
          AI-Powered NYC Safety Intelligence
        </Text>
      </ScrollView>

      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Brief Generation Time</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Your daily brief will be generated once per day at your preferred time when you next open the app.
            </Text>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Generation Time:</Text>
              <Picker
                selectedValue={selectedHour}
                onValueChange={(value) => setSelectedHour(value)}
                style={styles.picker}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <Picker.Item 
                    key={i} 
                    label={formatTime(i)} 
                    value={i}
                    color="#FFFFFF"
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={updateBriefTime}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionHeader: { 
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  sectionTitle: { color: '#71717A', fontSize: 11, fontWeight: '600', letterSpacing: 2, flex: 1 },
  settingsIcon: { padding: 4 },
  loadingContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: { color: '#71717A', fontSize: 13, marginTop: 12 },
  briefCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#18181B', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#27272A',
  },
  briefHeader: {
    marginBottom: 16, gap: 12,
  },
  briefStats: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  statItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  statText: { color: '#A1A1AA', fontSize: 13 },
  riskWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(251,146,60,0.1)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.2)',
    alignSelf: 'flex-start',
  },
  riskWarningText: { color: '#FB923C', fontSize: 12, fontWeight: '500' },
  briefText: {
    color: '#D4D4D8', fontSize: 14, lineHeight: 22,
  },
  nextGenText: {
    color: '#71717A', fontSize: 12, marginTop: 12, fontStyle: 'italic',
  },
  refreshButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 16, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#27272A',
    backgroundColor: '#09090B',
  },
  refreshButtonText: { color: '#0EA5E9', fontSize: 13, fontWeight: '500' },
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
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#18181B', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: '#27272A',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { color: '#FAFAFA', fontSize: 18, fontWeight: '600' },
  modalDescription: { color: '#A1A1AA', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  pickerContainer: { marginBottom: 24 },
  pickerLabel: { color: '#D4D4D8', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  picker: { backgroundColor: '#27272A', borderRadius: 12, color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#27272A', alignItems: 'center',
  },
  cancelButtonText: { color: '#A1A1AA', fontSize: 15, fontWeight: '500' },
  saveButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#0EA5E9', alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
