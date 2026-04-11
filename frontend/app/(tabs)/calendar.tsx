import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost, apiDelete } from '../../utils/api';

interface Plan {
  id: string;
  title: string;
  location_name: string;
  start_time: string;
  end_time?: string;
  safety_analysis?: {
    rating: number;
    risk_level: string;
    assessment: string;
    recommendations?: string[];
  };
}

export default function CalendarScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newTime, setNewTime] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await apiGet('/api/plans');
      setPlans(response.plans || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const addPlan = async () => {
    if (!newTitle.trim() || !newLocation.trim() || !newTime.trim()) return;
    setAdding(true);
    try {
      const plan = await apiPost('/api/plans', {
        title: newTitle,
        location_name: newLocation,
        start_time: newTime,
      });
      setPlans(prev => [...prev, plan]);
      setShowAddModal(false);
      setNewTitle('');
      setNewLocation('');
      setNewTime('');
    } catch (error: any) {
      alert(error.message || 'Failed to add plan');
    } finally {
      setAdding(false);
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      await apiDelete(`/api/plans/${planId}`);
      setPlans(prev => prev.filter(p => p.id !== planId));
    } catch {}
  };

  const analyzePlan = async (planId: string) => {
    try {
      const result = await apiPost(`/api/plans/${planId}/analyze`, {});
      setPlans(prev => prev.map(p => p.id === planId ? result : p));
    } catch (error: any) {
      alert(error.message || 'Analysis failed');
    }
  };

  const getRiskColor = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'LOW': return '#34D399';
      case 'MODERATE': return '#FBBF24';
      case 'HIGH': return '#FB7185';
      case 'CRITICAL': return '#EF4444';
      default: return '#71717A';
    }
  };

  const getRiskBg = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'LOW': return 'rgba(52,211,153,0.1)';
      case 'MODERATE': return 'rgba(251,191,36,0.1)';
      case 'HIGH': return 'rgba(251,113,133,0.1)';
      case 'CRITICAL': return 'rgba(239,68,68,0.1)';
      default: return 'rgba(113,113,122,0.1)';
    }
  };

  const getRiskIcon = (level?: string): any => {
    switch (level?.toUpperCase()) {
      case 'LOW': return 'shield-checkmark';
      case 'MODERATE': return 'warning';
      case 'HIGH': return 'alert-circle';
      case 'CRITICAL': return 'skull';
      default: return 'help-circle';
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Plans</Text>
          <Text style={styles.headerSub}>Safety-aware scheduling</Text>
        </View>
        <TouchableOpacity
          testID="add-plan-button"
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={22} color="#09090B" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={48} color="#3F3F46" />
          </View>
          <Text style={styles.emptyTitle}>No plans yet</Text>
          <Text style={styles.emptyDesc}>
            Add your plans and we'll automatically analyze the safety of each location.
          </Text>
          <TouchableOpacity
            testID="empty-add-plan-button"
            style={styles.emptyAddBtn}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={18} color="#09090B" />
            <Text style={styles.emptyAddText}>Add a plan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.planList} showsVerticalScrollIndicator={false}>
          {plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <View style={styles.planMeta}>
                    <Ionicons name="location-outline" size={14} color="#71717A" />
                    <Text style={styles.planLocation}>{plan.location_name}</Text>
                  </View>
                  <View style={styles.planMeta}>
                    <Ionicons name="time-outline" size={14} color="#71717A" />
                    <Text style={styles.planTime}>{plan.start_time}</Text>
                  </View>
                </View>
                <TouchableOpacity testID={`delete-plan-${plan.id}`} onPress={() => deletePlan(plan.id)}>
                  <Ionicons name="trash-outline" size={20} color="#52525B" />
                </TouchableOpacity>
              </View>

              {plan.safety_analysis ? (
                <View style={[styles.safetyBadge, { backgroundColor: getRiskBg(plan.safety_analysis.risk_level) }]}>
                  <Ionicons
                    name={getRiskIcon(plan.safety_analysis.risk_level)}
                    size={16}
                    color={getRiskColor(plan.safety_analysis.risk_level)}
                  />
                  <Text style={[styles.safetyRating, { color: getRiskColor(plan.safety_analysis.risk_level) }]}>
                    {plan.safety_analysis.rating}/10 - {plan.safety_analysis.risk_level}
                  </Text>
                  <Text style={styles.safetyAssessment} numberOfLines={2}>
                    {plan.safety_analysis.assessment}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  testID={`analyze-plan-${plan.id}`}
                  style={styles.analyzeBtn}
                  onPress={() => analyzePlan(plan.id)}
                >
                  <Ionicons name="analytics-outline" size={16} color="#0EA5E9" />
                  <Text style={styles.analyzeBtnText}>Analyze Safety</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Plan</Text>
              <TouchableOpacity testID="close-add-modal" onPress={() => setShowAddModal(false)}>
                <Ionicons name="close-circle" size={28} color="#71717A" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>WHAT</Text>
              <TextInput
                testID="plan-title-input"
                style={styles.formInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g., Dinner with friends"
                placeholderTextColor="#52525B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>WHERE (NYC)</Text>
              <TextInput
                testID="plan-location-input"
                style={styles.formInput}
                value={newLocation}
                onChangeText={setNewLocation}
                placeholder="e.g., Times Square, Manhattan"
                placeholderTextColor="#52525B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>WHEN</Text>
              <TextInput
                testID="plan-time-input"
                style={styles.formInput}
                value={newTime}
                onChangeText={setNewTime}
                placeholder="e.g., Tonight 8pm, Tomorrow 2pm"
                placeholderTextColor="#52525B"
              />
            </View>

            <TouchableOpacity
              testID="submit-plan-button"
              style={[styles.submitBtn, adding && styles.submitBtnDisabled]}
              onPress={addPlan}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator color="#09090B" size="small" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color="#09090B" />
                  <Text style={styles.submitBtnText}>Add & Analyze</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#27272A',
  },
  headerTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  headerSub: { color: '#52525B', fontSize: 12, marginTop: 2, letterSpacing: 0.5 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0EA5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#18181B',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '300', marginBottom: 8 },
  emptyDesc: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0EA5E9', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 24,
  },
  emptyAddText: { color: '#09090B', fontSize: 15, fontWeight: '600' },
  planList: { padding: 16, gap: 12 },
  planCard: {
    backgroundColor: '#18181B', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#27272A',
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  planInfo: { flex: 1, gap: 6 },
  planTitle: { color: '#FAFAFA', fontSize: 16, fontWeight: '500' },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planLocation: { color: '#A1A1AA', fontSize: 13 },
  planTime: { color: '#A1A1AA', fontSize: 13 },
  safetyBadge: {
    borderRadius: 12, padding: 12, marginTop: 12,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  safetyRating: { fontSize: 13, fontWeight: '600' },
  safetyAssessment: { color: '#A1A1AA', fontSize: 12, width: '100%', lineHeight: 18 },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)',
    borderRadius: 10, backgroundColor: 'rgba(14,165,233,0.05)',
  },
  analyzeBtnText: { color: '#0EA5E9', fontSize: 13, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: {
    backgroundColor: '#18181B', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, borderWidth: 1, borderColor: '#27272A',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#3F3F46', alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  modalTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '300' },
  formGroup: { marginBottom: 20 },
  formLabel: {
    color: '#A1A1AA', fontSize: 11, fontWeight: '600',
    letterSpacing: 2, marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#09090B', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#FAFAFA', fontSize: 15,
    borderWidth: 1, borderColor: '#27272A',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#0EA5E9', borderRadius: 14,
    paddingVertical: 16, marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#09090B', fontSize: 16, fontWeight: '600' },
});
