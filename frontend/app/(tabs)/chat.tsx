import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost, apiDelete } from '../../utils/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await apiGet('/api/chat/history');
      setMessages(response.messages || []);
    } catch {
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const response = await apiPost('/api/chat', { message: userMsg.content });
      const assistantMsg: Message = { role: 'assistant', content: response.response };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    try {
      await apiDelete('/api/chat/history');
      setMessages([]);
    } catch {}
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.agentAvatar}>
            <Ionicons name="shield-checkmark" size={16} color="#0EA5E9" />
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.agentBubble]}>
          <Text style={[styles.msgText, isUser && styles.userMsgText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  const welcomePrompts = [
    'Is Times Square safe at night?',
    'Safest boroughs in NYC?',
    'Safety tips for Central Park',
    'Compare Brooklyn vs Manhattan safety',
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={22} color="#0EA5E9" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Safety Agent</Text>
            <Text style={styles.headerSub}>Powered by AI</Text>
          </View>
        </View>
        <TouchableOpacity testID="clear-chat-button" onPress={clearChat}>
          <Ionicons name="trash-outline" size={22} color="#71717A" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        {loadingHistory ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0EA5E9" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeIconWrap}>
              <Ionicons name="shield-checkmark" size={48} color="#0EA5E9" />
            </View>
            <Text style={styles.welcomeTitle}>NYC Safety Agent</Text>
            <Text style={styles.welcomeDesc}>
              Ask me about safety in any NYC neighborhood, location, or plan. I use real NYPD shooting data to provide informed assessments.
            </Text>
            <View style={styles.promptsGrid}>
              {welcomePrompts.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  testID={`prompt-${i}`}
                  style={styles.promptBtn}
                  onPress={() => {
                    setInput(prompt);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#0EA5E9" />
                  <Text style={styles.promptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            showsVerticalScrollIndicator={false}
          />
        )}

        {sending && (
          <View style={styles.typingIndicator}>
            <View style={styles.agentAvatar}>
              <Ionicons name="shield-checkmark" size={12} color="#0EA5E9" />
            </View>
            <ActivityIndicator size="small" color="#0EA5E9" />
            <Text style={styles.typingText}>Analyzing...</Text>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about NYC safety..."
            placeholderTextColor="#52525B"
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            testID="send-message-button"
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={18} color={input.trim() && !sending ? '#09090B' : '#52525B'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#27272A',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FAFAFA', fontSize: 17, fontWeight: '500' },
  headerSub: { color: '#52525B', fontSize: 12, marginTop: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcomeContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  welcomeIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(14,165,233,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  welcomeTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  welcomeDesc: {
    color: '#71717A', fontSize: 14, textAlign: 'center',
    lineHeight: 22, marginTop: 8, marginBottom: 28,
    paddingHorizontal: 16,
  },
  promptsGrid: { width: '100%', gap: 10 },
  promptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#18181B', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#27272A',
  },
  promptText: { color: '#D4D4D8', fontSize: 13 },
  messageList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  agentAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(14,165,233,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  msgBubble: { maxWidth: '78%', borderRadius: 16, padding: 14 },
  userBubble: { backgroundColor: '#0EA5E9', borderBottomRightRadius: 4 },
  agentBubble: {
    backgroundColor: '#18181B', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#27272A',
  },
  msgText: { color: '#D4D4D8', fontSize: 14, lineHeight: 21 },
  userMsgText: { color: '#09090B' },
  typingIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  typingText: { color: '#52525B', fontSize: 12 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#27272A',
    gap: 10,
  },
  textInput: {
    flex: 1, backgroundColor: '#18181B', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    color: '#FAFAFA', fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: '#27272A',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0EA5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#27272A' },
});
