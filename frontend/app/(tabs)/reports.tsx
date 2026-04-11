import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost, apiDelete } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';

const CATEGORIES = [
  { key: 'shooting', label: 'Shooting', icon: 'flash', color: '#EF4444' },
  { key: 'assault', label: 'Assault', icon: 'hand-left', color: '#F97316' },
  { key: 'robbery', label: 'Robbery', icon: 'cash', color: '#FBBF24' },
  { key: 'suspicious_activity', label: 'Suspicious', icon: 'eye', color: '#A78BFA' },
  { key: 'theft', label: 'Theft', icon: 'bag-remove', color: '#FB923C' },
  { key: 'vandalism', label: 'Vandalism', icon: 'hammer', color: '#94A3B8' },
  { key: 'harassment', label: 'Harassment', icon: 'warning', color: '#F472B6' },
  { key: 'other', label: 'Other', icon: 'alert-circle', color: '#71717A' },
];

interface Report {
  id: string;
  user_name: string;
  title: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  location_name: string;
  photo?: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadReports(); }, [filterCategory]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const url = filterCategory ? `/api/reports?category=${filterCategory}` : '/api/reports';
      const response = await apiGet(url);
      setReports(response.reports || []);
    } catch {} finally { setLoading(false); }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setNewPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submitReport = async () => {
    if (!newTitle.trim() || !newDesc.trim() || !selectedCategory || !newLocation.trim()) {
      Alert.alert('Missing Info', 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      // Geocode the location
      let lat = 40.7128, lng = -73.97;
      try {
        const geo = await apiGet(`/api/geocode?q=${encodeURIComponent(newLocation)}`);
        lat = geo.latitude;
        lng = geo.longitude;
      } catch {}
      const report = await apiPost('/api/reports', {
        title: newTitle, description: newDesc, category: selectedCategory,
        latitude: lat, longitude: lng, location_name: newLocation,
        photo: newPhoto,
      });
      setReports(prev => [report, ...prev]);
      setShowAddModal(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setNewTitle(''); setNewDesc(''); setNewLocation('');
    setSelectedCategory(''); setNewPhoto(null);
  };

  const voteReport = async (reportId: string, vote: number) => {
    try {
      const result = await apiPost(`/api/reports/${reportId}/vote`, { vote });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, upvotes: result.upvotes, downvotes: result.downvotes } : r));
    } catch {}
  };

  const deleteReport = async (reportId: string) => {
    try {
      await apiDelete(`/api/reports/${reportId}`);
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch {}
  };

  const getCatInfo = (key: string) => CATEGORIES.find(c => c.key === key) || CATEGORIES[7];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const renderReport = ({ item }: { item: Report }) => {
    const cat = getCatInfo(item.category);
    return (
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View style={[styles.catBadge, { backgroundColor: cat.color + '20' }]}>
            <Ionicons name={cat.icon as any} size={14} color={cat.color} />
            <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={styles.reportTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.reportTitle}>{item.title}</Text>
        <Text style={styles.reportDesc} numberOfLines={3}>{item.description}</Text>
        {item.location_name ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color="#71717A" />
            <Text style={styles.locationText}>{item.location_name}</Text>
          </View>
        ) : null}
        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.reportPhoto} resizeMode="cover" />
        ) : null}
        <View style={styles.reportFooter}>
          <View style={styles.voteRow}>
            <TouchableOpacity testID={`upvote-${item.id}`} onPress={() => voteReport(item.id, 1)} style={styles.voteBtn}>
              <Ionicons name="arrow-up-circle" size={22} color="#34D399" />
              <Text style={styles.voteCount}>{item.upvotes}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID={`downvote-${item.id}`} onPress={() => voteReport(item.id, -1)} style={styles.voteBtn}>
              <Ionicons name="arrow-down-circle" size={22} color="#FB7185" />
              <Text style={styles.voteCount}>{item.downvotes}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.reportAuthor}>by {item.user_name}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community Reports</Text>
          <Text style={styles.headerSub}>Report & verify safety incidents</Text>
        </View>
        <TouchableOpacity testID="add-report-button" style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={22} color="#09090B" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity style={[styles.filterChip, !filterCategory && styles.filterChipActive]} onPress={() => setFilterCategory('')}>
          <Text style={[styles.filterText, !filterCategory && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity key={cat.key} style={[styles.filterChip, filterCategory === cat.key && styles.filterChipActive]}
            onPress={() => setFilterCategory(filterCategory === cat.key ? '' : cat.key)}>
            <Ionicons name={cat.icon as any} size={14} color={filterCategory === cat.key ? '#09090B' : cat.color} />
            <Text style={[styles.filterText, filterCategory === cat.key && styles.filterTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#0EA5E9" /></View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="megaphone-outline" size={48} color="#3F3F46" />
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptyDesc}>Be the first to report a safety incident in your area.</Text>
        </View>
      ) : (
        <FlatList data={reports} renderItem={renderReport} keyExtractor={item => item.id}
          contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Incident</Text>
              <TouchableOpacity testID="close-report-modal" onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Ionicons name="close-circle" size={28} color="#71717A" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>CATEGORY</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat.key} testID={`cat-${cat.key}`}
                    style={[styles.catOption, selectedCategory === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '15' }]}
                    onPress={() => setSelectedCategory(cat.key)}>
                    <Ionicons name={cat.icon as any} size={18} color={selectedCategory === cat.key ? cat.color : '#71717A'} />
                    <Text style={[styles.catOptionText, selectedCategory === cat.key && { color: cat.color }]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>TITLE</Text>
              <TextInput testID="report-title-input" style={styles.formInput} value={newTitle} onChangeText={setNewTitle}
                placeholder="Brief description" placeholderTextColor="#52525B" />
              <Text style={styles.formLabel}>DETAILS</Text>
              <TextInput testID="report-desc-input" style={[styles.formInput, styles.textArea]} value={newDesc} onChangeText={setNewDesc}
                placeholder="What happened?" placeholderTextColor="#52525B" multiline numberOfLines={3} />
              <Text style={styles.formLabel}>LOCATION</Text>
              <TextInput testID="report-location-input" style={styles.formInput} value={newLocation} onChangeText={setNewLocation}
                placeholder="e.g., E 125th St, Harlem" placeholderTextColor="#52525B" />
              <Text style={styles.formLabel}>PHOTO (OPTIONAL)</Text>
              <TouchableOpacity testID="pick-photo-button" style={styles.photoBtn} onPress={pickImage}>
                {newPhoto ? (
                  <Image source={{ uri: newPhoto }} style={styles.photoPreview} resizeMode="cover" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color="#71717A" />
                    <Text style={styles.photoBtnText}>Add Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity testID="submit-report-button" style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={submitReport} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#09090B" size="small" /> : (
                  <><Ionicons name="megaphone" size={18} color="#09090B" /><Text style={styles.submitBtnText}>Submit Report</Text></>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#27272A',
  },
  headerTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  headerSub: { color: '#52525B', fontSize: 12, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center' },
  filterRow: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A',
  },
  filterChipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  filterText: { color: '#A1A1AA', fontSize: 12, fontWeight: '500' },
  filterTextActive: { color: '#09090B' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '300', marginTop: 16 },
  emptyDesc: { color: '#71717A', fontSize: 14, textAlign: 'center', marginTop: 8 },
  list: { padding: 16, gap: 12 },
  reportCard: { backgroundColor: '#18181B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#27272A' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catLabel: { fontSize: 11, fontWeight: '600' },
  reportTime: { color: '#52525B', fontSize: 11 },
  reportTitle: { color: '#FAFAFA', fontSize: 16, fontWeight: '500', marginBottom: 6 },
  reportDesc: { color: '#A1A1AA', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  locationText: { color: '#71717A', fontSize: 12 },
  reportPhoto: { width: '100%', height: 160, borderRadius: 10, marginBottom: 10, backgroundColor: '#27272A' },
  reportFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  voteRow: { flexDirection: 'row', gap: 12 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteCount: { color: '#A1A1AA', fontSize: 13 },
  reportAuthor: { color: '#52525B', fontSize: 11 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { backgroundColor: '#18181B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%', borderWidth: 1, borderColor: '#27272A' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3F3F46', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '300' },
  formLabel: { color: '#A1A1AA', fontSize: 11, fontWeight: '600', letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catOption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#09090B', borderWidth: 1, borderColor: '#27272A',
  },
  catOptionText: { color: '#A1A1AA', fontSize: 12 },
  formInput: { backgroundColor: '#09090B', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#FAFAFA', fontSize: 15, borderWidth: 1, borderColor: '#27272A' },
  textArea: { height: 80, textAlignVertical: 'top' },
  photoBtn: {
    height: 100, borderRadius: 12, borderWidth: 1, borderColor: '#27272A', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090B', overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoBtnText: { color: '#71717A', fontSize: 13, marginTop: 4 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0EA5E9', borderRadius: 14, paddingVertical: 16, marginTop: 20, marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#09090B', fontSize: 16, fontWeight: '600' },
});
