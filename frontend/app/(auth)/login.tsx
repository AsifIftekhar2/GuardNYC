import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={48} color="#0EA5E9" />
            </View>
            <Text style={styles.title}>Agentic{'\n'}Safeguard</Text>
            <Text style={styles.subtitle}>AI-powered NYC safety intelligence</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#FB7185" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  testID="login-email-input"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#52525B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  testID="login-password-input"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#52525B"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#71717A" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#09090B" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="go-to-register-button"
              onPress={() => router.push('/(auth)/register')}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkAccent}>Create one</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  iconContainer: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: {
    fontSize: 36, fontWeight: '300', color: '#FAFAFA',
    textAlign: 'center', letterSpacing: -1, lineHeight: 42,
  },
  subtitle: {
    fontSize: 14, color: '#71717A', marginTop: 8,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  form: { width: '100%' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(251,113,133,0.1)',
    borderWidth: 1, borderColor: 'rgba(251,113,133,0.2)',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { color: '#FB7185', fontSize: 13, flex: 1 },
  inputGroup: { marginBottom: 20 },
  label: {
    color: '#A1A1AA', fontSize: 11, fontWeight: '600',
    letterSpacing: 2, marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181B', borderRadius: 14,
    borderWidth: 1, borderColor: '#27272A',
  },
  inputIcon: { marginLeft: 14 },
  input: {
    flex: 1, color: '#FAFAFA', fontSize: 15,
    paddingVertical: 14, paddingHorizontal: 10,
  },
  eyeBtn: { padding: 14 },
  button: {
    backgroundColor: '#0EA5E9', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#09090B', fontSize: 16, fontWeight: '600' },
  linkBtn: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#71717A', fontSize: 14 },
  linkAccent: { color: '#0EA5E9', fontWeight: '500' },
});
