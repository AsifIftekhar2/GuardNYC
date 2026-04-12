import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function OAuthCallback() {
  useEffect(() => {
    // Check if we're running in a browser
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const googleCalendar = params.get('google_calendar');
      
      if (googleCalendar === 'connected') {
        // Notify parent window (if opened as popup)
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED' }, '*');
          // Close this popup window
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // If not a popup, redirect to calendar tab
          setTimeout(() => {
            window.location.href = '/(tabs)/calendar';
          }, 2000);
        }
      }
    }
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0EA5E9" />
      <Text style={styles.text}>Connecting Google Calendar...</Text>
      <Text style={styles.subtext}>This window will close automatically</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  subtext: {
    color: '#71717A',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
