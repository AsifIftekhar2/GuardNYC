import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost } from '../../utils/api';

function getMapHTML() {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#09090B}
#map{width:100%;height:100vh}
.leaflet-control-attribution{display:none!important}
.leaflet-control-zoom a{background:#18181B!important;color:#FAFAFA!important;border-color:#27272A!important}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:true,attributionControl:false}).setView([40.7128,-73.97],11);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
var heatLayer=null;
var selectedMarker=null;

function updateHeatmap(points){
  if(heatLayer)map.removeLayer(heatLayer);
  heatLayer=L.heatLayer(points,{
    radius:18,blur:25,maxZoom:15,minOpacity:0.3,
    gradient:{0.1:'#34D399',0.3:'#FBBF24',0.5:'#F97316',0.7:'#EF4444',1:'#DC2626'}
  }).addTo(map);
}

function centerMap(lat,lng,zoom){
  map.setView([lat,lng],zoom||14);
  if(selectedMarker)map.removeLayer(selectedMarker);
  selectedMarker=L.circleMarker([lat,lng],{
    radius:10,fillColor:'#0EA5E9',color:'#0EA5E9',weight:2,opacity:1,fillOpacity:0.3
  }).addTo(map);
}

window.addEventListener('message',function(e){
  try{
    var d=typeof e.data==='string'?JSON.parse(e.data):e.data;
    if(d.type==='heatmap')updateHeatmap(d.points);
    if(d.type==='center')centerMap(d.lat,d.lng,d.zoom);
  }catch(err){}
});

map.on('click',function(e){
  if(selectedMarker)map.removeLayer(selectedMarker);
  selectedMarker=L.circleMarker([e.latlng.lat,e.latlng.lng],{
    radius:10,fillColor:'#0EA5E9',color:'#0EA5E9',weight:2,opacity:1,fillOpacity:0.3
  }).addTo(map);
  var msg=JSON.stringify({type:'location_selected',latitude:e.latlng.lat,longitude:e.latlng.lng});
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(msg);
  else window.parent.postMessage(msg,'*');
});
</script>
</body>
</html>`;
}

interface SafetyResult {
  rating: number;
  risk_level: string;
  assessment: string;
  recommendations: string[];
  best_times: string;
  avoid_times: string;
  location_name: string;
  incident_count: number;
}

let WebViewComponent: any = null;
if (Platform.OS !== 'web') {
  try {
    WebViewComponent = require('react-native-webview').WebView;
  } catch {}
}

export default function MapScreen() {
  const webViewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [analysisModal, setAnalysisModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number; lng: number} | null>(null);
  const [safetyResult, setSafetyResult] = useState<SafetyResult | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const sendToMap = useCallback((data: any) => {
    const msg = JSON.stringify(data);
    if (Platform.OS === 'web') {
      try {
        const iframe = document.getElementById('map-frame') as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(msg, '*');
      } catch {}
    } else {
      webViewRef.current?.postMessage(msg);
    }
  }, []);

  const loadMapData = useCallback(async () => {
    try {
      const response = await apiGet('/api/shootings/heatmap?limit=5000');
      if (response.points) {
        setTimeout(() => {
          sendToMap({ type: 'heatmap', points: response.points });
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to load map data:', error);
    } finally {
      setLoading(false);
    }
  }, [sendToMap]);

  // Web: listen for messages from iframe
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handler = (e: MessageEvent) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data.type === 'location_selected') {
            setSelectedLocation({ lat: data.latitude, lng: data.longitude });
            analyzeLocation(data.latitude, data.longitude);
          }
        } catch {}
      };
      (window as any).addEventListener('message', handler);
      return () => (window as any).removeEventListener('message', handler);
    }
  }, []);

  // Load map data when map is ready
  useEffect(() => {
    if (mapReady) {
      loadMapData();
    }
  }, [mapReady, loadMapData]);

  // Auto mark map ready for web after mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      setTimeout(() => setMapReady(true), 2000);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await apiGet(`/api/geocode?q=${encodeURIComponent(searchQuery)}`);
      if (response.latitude && response.longitude) {
        setSelectedLocation({ lat: response.latitude, lng: response.longitude });
        sendToMap({ type: 'center', lat: response.latitude, lng: response.longitude, zoom: 14 });
        analyzeLocation(response.latitude, response.longitude, searchQuery);
      }
    } catch {
      // Fallback: just analyze with a generic NYC location
    } finally {
      setSearching(false);
    }
  };

  const analyzeLocation = async (lat: number, lng: number, name?: string) => {
    setAnalyzing(true);
    setAnalysisModal(true);
    setSafetyResult(null);
    try {
      const response = await apiPost('/api/safety/analyze', {
        latitude: lat,
        longitude: lng,
        location_name: name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        time_of_day: new Date().toLocaleTimeString(),
      });
      setSafetyResult(response);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'location_selected') {
        setSelectedLocation({ lat: data.latitude, lng: data.longitude });
        analyzeLocation(data.latitude, data.longitude);
      }
    } catch {}
  };

  const getRiskColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'LOW': return '#34D399';
      case 'MODERATE': return '#FBBF24';
      case 'HIGH': return '#FB7185';
      case 'CRITICAL': return '#EF4444';
      default: return '#A1A1AA';
    }
  };

  const getRiskBg = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'LOW': return 'rgba(52,211,153,0.1)';
      case 'MODERATE': return 'rgba(251,191,36,0.1)';
      case 'HIGH': return 'rgba(251,113,133,0.1)';
      case 'CRITICAL': return 'rgba(239,68,68,0.1)';
      default: return 'rgba(161,161,170,0.1)';
    }
  };

  const renderMap = () => {
    if (Platform.OS === 'web') {
      // @ts-ignore - iframe is valid HTML element on web
      return React.createElement('iframe', {
        id: 'map-frame',
        srcDoc: getMapHTML(),
        style: {
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#09090B',
        },
        onLoad: () => {
          if (!mapReady) setMapReady(true);
        },
      });
    }

    if (!WebViewComponent) {
      return (
        <View style={styles.mapFallback}>
          <Ionicons name="map-outline" size={48} color="#3F3F46" />
          <Text style={styles.mapFallbackText}>Map loading...</Text>
        </View>
      );
    }

    return (
      <WebViewComponent
        ref={webViewRef}
        testID="map-webview"
        source={{ html: getMapHTML() }}
        style={styles.map}
        onMessage={handleMapMessage}
        javaScriptEnabled
        domStorageEnabled
        onLoad={() => {
          setMapReady(true);
          setTimeout(loadMapData, 500);
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderMap()}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#71717A" />
          <TextInput
            testID="map-search-input"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search NYC location..."
            placeholderTextColor="#52525B"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searching ? (
            <ActivityIndicator size="small" color="#0EA5E9" />
          ) : (
            <TouchableOpacity testID="map-search-button" onPress={handleSearch}>
              <Ionicons name="arrow-forward-circle" size={24} color="#0EA5E9" />
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Loading shooting data...</Text>
          </View>
        )}

        <View style={styles.bottomInfo} pointerEvents="box-none">
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#34D399' }]} />
              <Text style={styles.legendLabel}>Low</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
              <Text style={styles.legendLabel}>Moderate</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendLabel}>High</Text>
            </View>
          </View>
          <Text style={styles.tapHint}>Tap anywhere on the map for a safety analysis</Text>
        </View>
      </SafeAreaView>

      <Modal visible={analysisModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Safety Analysis</Text>
              <TouchableOpacity testID="close-analysis-modal" onPress={() => setAnalysisModal(false)}>
                <Ionicons name="close-circle" size={28} color="#71717A" />
              </TouchableOpacity>
            </View>

            {analyzing ? (
              <View style={styles.analyzeLoading}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.analyzeLoadingText}>AI is analyzing this location...</Text>
              </View>
            ) : safetyResult ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.ratingSection}>
                  <View style={[styles.ratingBadge, { backgroundColor: getRiskBg(safetyResult.risk_level) }]}>
                    <Text style={[styles.ratingNumber, { color: getRiskColor(safetyResult.risk_level) }]}>
                      {safetyResult.rating}/10
                    </Text>
                    <Text style={[styles.riskLabel, { color: getRiskColor(safetyResult.risk_level) }]}>
                      {safetyResult.risk_level}
                    </Text>
                  </View>
                  <Text style={styles.locationName}>{safetyResult.location_name}</Text>
                  <Text style={styles.incidentCount}>
                    {safetyResult.incident_count} incidents nearby
                  </Text>
                </View>

                <Text style={styles.assessmentText}>{safetyResult.assessment}</Text>

                {safetyResult.recommendations?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
                    {safetyResult.recommendations.map((rec: string, i: number) => (
                      <View key={i} style={styles.recItem}>
                        <Ionicons name="shield-checkmark" size={16} color="#0EA5E9" />
                        <Text style={styles.recText}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.timeRow}>
                  <View style={styles.timeCard}>
                    <Ionicons name="sunny" size={20} color="#34D399" />
                    <Text style={styles.timeLabel}>BEST TIMES</Text>
                    <Text style={styles.timeValue}>{safetyResult.best_times}</Text>
                  </View>
                  <View style={styles.timeCard}>
                    <Ionicons name="moon" size={20} color="#FB7185" />
                    <Text style={styles.timeLabel}>AVOID</Text>
                    <Text style={styles.timeValue}>{safetyResult.avoid_times}</Text>
                  </View>
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.noDataText}>No analysis available</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  map: { flex: 1 },
  mapFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#09090B',
  },
  mapFallbackText: { color: '#71717A', marginTop: 12, fontSize: 14 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderRadius: 14, marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1, color: '#FAFAFA', fontSize: 15,
    paddingVertical: 12, paddingHorizontal: 10,
  },
  loadingOverlay: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(9,9,11,0.7)',
    borderRadius: 16, padding: 24,
    marginHorizontal: 60, alignSelf: 'center',
  },
  loadingText: { color: '#A1A1AA', fontSize: 13, marginTop: 8 },
  bottomInfo: { paddingHorizontal: 16, paddingBottom: 8 },
  legendRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: '#A1A1AA', fontSize: 12, fontWeight: '500' },
  tapHint: {
    color: '#52525B', fontSize: 11, textAlign: 'center',
    marginTop: 6, letterSpacing: 0.5,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: {
    backgroundColor: '#18181B',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '75%',
    borderWidth: 1, borderColor: '#27272A',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#3F3F46', alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: '#FAFAFA', fontSize: 20, fontWeight: '300', letterSpacing: -0.5 },
  analyzeLoading: { alignItems: 'center', paddingVertical: 40 },
  analyzeLoadingText: { color: '#A1A1AA', fontSize: 14, marginTop: 12 },
  ratingSection: { alignItems: 'center', marginBottom: 20 },
  ratingBadge: {
    paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingNumber: { fontSize: 36, fontWeight: '300' },
  riskLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 2, marginTop: 4 },
  locationName: { color: '#FAFAFA', fontSize: 16, fontWeight: '500', marginTop: 12, textAlign: 'center' },
  incidentCount: { color: '#71717A', fontSize: 13, marginTop: 4 },
  assessmentText: {
    color: '#A1A1AA', fontSize: 14, lineHeight: 22,
    backgroundColor: '#09090B', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#27272A', marginBottom: 16,
  },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#71717A', fontSize: 11, fontWeight: '600', letterSpacing: 2, marginBottom: 10 },
  recItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  recText: { color: '#D4D4D8', fontSize: 13, flex: 1, lineHeight: 20 },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  timeCard: {
    flex: 1, backgroundColor: '#09090B', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#27272A', alignItems: 'center',
  },
  timeLabel: { color: '#71717A', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 8 },
  timeValue: { color: '#D4D4D8', fontSize: 12, marginTop: 4, textAlign: 'center' },
  noDataText: { color: '#71717A', textAlign: 'center', paddingVertical: 40 },
});
