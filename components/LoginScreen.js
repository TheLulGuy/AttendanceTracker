import React, { useState, useRef } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const ERROR_MESSAGES = {
  'auth/invalid-email': 'Invalid email address.',
  'auth/user-not-found': 'No account with that email.',
  'auth/wrong-password': 'Wrong password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
};

function errorMessage(err) {
  return ERROR_MESSAGES[err?.code] || 'Something went wrong. Try again.';
}

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const passwordRef = useRef(null);

  async function submit() {
    if (!email.trim() || !password) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) { setError('Enter your email above first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('Password reset email sent.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="bg-panel border border-border rounded-xl p-3">
      <View className="flex-row gap-1.5 mb-2.5">
        <Pressable
          onPress={() => setMode('login')}
          className={`flex-1 items-center py-1.5 rounded-[7px] border ${mode==='login' ? 'border-cyan bg-cyandim' : 'border-border'}`}
        >
          <Text className={`font-mono text-[10px] ${mode==='login' ? 'text-cyan' : 'text-muted'}`}>LOG IN</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('signup')}
          className={`flex-1 items-center py-1.5 rounded-[7px] border ${mode==='signup' ? 'border-cyan bg-cyandim' : 'border-border'}`}
        >
          <Text className={`font-mono text-[10px] ${mode==='signup' ? 'text-cyan' : 'text-muted'}`}>SIGN UP</Text>
        </Pressable>
      </View>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#566373"
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => passwordRef.current?.focus()}
        className="font-sans text-[12px] border border-border rounded-lg px-2.5 py-2 bg-panel2 text-ink mb-1.5"
      />
      <TextInput
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#566373"
        secureTextEntry
        returnKeyType="done"
        onSubmitEditing={submit}
        className="font-sans text-[12px] border border-border rounded-lg px-2.5 py-2 bg-panel2 text-ink mb-1.5"
      />

      {!!error && <Text className="font-mono text-[10px] text-red mb-1.5">{error}</Text>}
      {!!notice && <Text className="font-mono text-[10px] text-cyan mb-1.5">{notice}</Text>}

      <Pressable onPress={submit} disabled={busy} className="border border-cyan bg-cyandim rounded-[7px] py-2 items-center mb-1.5">
        {busy ? <ActivityIndicator color="#2DD4BF" /> : (
          <Text className="font-mono text-[10px] text-cyan">{mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</Text>
        )}
      </Pressable>

      {mode === 'login' && (
        <Pressable onPress={resetPassword} disabled={busy}>
          <Text className="font-mono text-[9px] text-muted2 text-center">Forgot password?</Text>
        </Pressable>
      )}
    </View>
  );
}
