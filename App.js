import './global.css';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Alert, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { fmt, parseDate, addDays } from './lib/dates';
import { OWNER_EMAIL } from './lib/constants';
import { DEFAULT_CONFIG, EMPTY_CONFIG } from './lib/defaultConfig';
import { migrateConfig } from './lib/configMigration';
import { auth } from './lib/firebase';
import { pushState, pushConfig, subscribeState, subscribeConfig } from './lib/sync';
import { useCloudSync } from './lib/useCloudSync';
import { buildSem, deriveCourses, dispDate, barTone, makeStatHelpers } from './lib/attendance';
import Gauge from './components/Gauge';
import EligibilityGates from './components/EligibilityGates';
import CourseLedger from './components/CourseLedger';
import CalendarGrid from './components/CalendarGrid';
import DayDetailModal from './components/DayDetailModal';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import { version as APP_VERSION } from './package.json';

SplashScreen.preventAutoHideAsync().catch(() => {});

const STORE_KEY  = 'gitam-att-v5';
const CONFIG_KEY = 'gitam-att-config-v1';
const ACTIVE_TAB_KEY    = 'gitam-active-tab';

const TODAY = fmt(new Date());

// ─── Component ───────────────────────────────────────────────────────────────
export default function App() {
  const [sel,      setSel]      = useState(null);   // selected date string
  const [dayModal, setDayModal] = useState(false);
  const [status,   setStatus]   = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [tabLocked, setTabLocked] = useState(false);
  const [closeAttempted, setCloseAttempted] = useState(false);
  const autoOpenedWizard = useRef(false);
  const tabId = useRef(Math.random().toString(36).slice(2) + Date.now()).current;

  function flash(msg, ms=3000) { setStatus(msg); setTimeout(() => setStatus(''), ms); }

  const {
    data: state, setData: setState, ready: stateLoaded, reset: resetStateSync,
  } = useCloudSync({
    storageKey: STORE_KEY,
    initial: {},
    migrate: parsed => (parsed && typeof parsed === 'object' && Object.keys(parsed).length ? parsed : null),
    push: pushState,
    subscribe: subscribeState,
    user, tabLocked,
    onLoad: applied => { if (applied) flash('✓ loaded'); },
    onSaving: () => setStatus('saving…'),
    onSaved: () => flash('✓ saved'),
  });

  const {
    data: config, setData: setConfig, ready: configLoaded, reset: resetConfigSync,
  } = useCloudSync({
    storageKey: CONFIG_KEY,
    initial: EMPTY_CONFIG,
    migrate: migrateConfig,
    push: pushConfig,
    subscribe: subscribeConfig,
    user, tabLocked,
    // First-ever sync for this account: seed the real GITAM schedule for the owner, blank for everyone else.
    seedFor: (u, current) => u.email === OWNER_EMAIL ? DEFAULT_CONFIG : current,
  });

  const [fontsLoaded] = useFonts({
    SpaceGrotesk: require('./assets/fonts/SpaceGrotesk-Variable.ttf'),
    'IBMPlexMono-Regular':  require('./assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBMPlexMono-Medium':   require('./assets/fonts/IBMPlexMono-Medium.ttf'),
    'IBMPlexMono-SemiBold': require('./assets/fonts/IBMPlexMono-SemiBold.ttf'),
    'IBMPlexMono-Bold':     require('./assets/fonts/IBMPlexMono-Bold.ttf'),
  });
  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const SEM = useMemo(() => buildSem(config.semStart, config.semEnd), [config.semStart, config.semEnd]);
  const { COURSES, CLABEL } = useMemo(() => deriveCourses(config.schedule), [config.schedule]);
  const { lockedStatus, slotsFor, dayMix, calcStats, cellClass } = useMemo(
    () => makeStatHelpers({ config, user, SEM, COURSES }),
    [config, user, SEM, COURSES]
  );

  // ── Firebase: track signed-in user ──
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthResolved(true); }), []);

  // ── Web only: detect the same account open in another tab, and let only one tab stay active ──
  useEffect(() => {
    if (Platform.OS !== 'web' || !user) return;
    const claim = () => localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify({ uid: user.uid, tabId, ts: Date.now() }));
    claim();
    function onStorage(e) {
      if (e.key !== ACTIVE_TAB_KEY || !e.newValue) return;
      try {
        const { uid, tabId: otherTabId } = JSON.parse(e.newValue);
        if (uid === user.uid && otherTabId !== tabId) setTabLocked(true);
      } catch (_) {}
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user]);

  function reclaimTab() {
    // The live Firestore listeners stay subscribed even while locked, so state/config are
    // already current here - just retake the tab lock.
    localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify({ uid: user.uid, tabId, ts: Date.now() }));
    setTabLocked(false);
  }

  function closeThisTab() {
    window.close();
    setTimeout(() => setCloseAttempted(true), 300);
  }

  const hasConfigured = Object.values(config.schedule).some(day => day.length > 0);

  // ── Auto-open Settings once for a signed-in user who hasn't set up a schedule yet ──
  useEffect(() => {
    if (user && configLoaded && !hasConfigured && !autoOpenedWizard.current) {
      autoOpenedWizard.current = true;
      setSettingsOpen(true);
    }
  }, [user, configLoaded, hasConfigured]);

  // ── Firebase: sign out and wipe the local cache so the next login on this device starts clean ──
  async function handleSignOut() {
    await signOut(auth);
    await Promise.all([resetStateSync({}), resetConfigSync(EMPTY_CONFIG)]);
    autoOpenedWizard.current = false;
  }

  // ── Actions ──
  function toggleSlot(ds, key) {
    setState(p => {
      const d = p[ds] || {};
      const cur = d[key] === undefined ? true : d[key];
      return { ...p, [ds]: { ...d, [key]: !cur } };
    });
  }

  function markAll(ds, dow, val) {
    const d = {};
    slotsFor(ds, dow).forEach(s => { d[s.key] = val; });
    setState(p => ({ ...p, [ds]: d }));
  }

  function handleLongPress(ds, dow) {
    const mix = dayMix(state, ds, dow);
    markAll(ds, dow, mix === 'none'); // absent→present, else→absent
  }

  function resetAll() {
    Alert.alert('Reset All', 'Clear all logged attendance?', [
      { text:'Cancel', style:'cancel' },
      { text:'Reset', style:'destructive', onPress: () => { setState({}); setSel(null); } },
    ]);
  }

  if (!fontsLoaded) return null;

  // ── Stats ── `stats` = actual attendance through today, the number shown everywhere as "current".
  // `gatePct(cutoff)` reruns the same calc for a future cutoff — since present() defaults unset
  // slots to true, that projects "if I attend everything else up to this date" for each gate.
  const stats = calcStats(state, TODAY);
  const pct   = stats.th ? stats.ta / stats.th * 100 : 100;
  const tone  = barTone(pct, config.threshold);
  const statusLine =
    TODAY < config.semStart ? "Semester hasn't started yet" :
    TODAY > config.semEnd   ? 'Semester over' :
    `Through today · ${dispDate(TODAY)}`;

  function gatePct(cutoffDate) {
    const st = calcStats(state, cutoffDate);
    return st.th ? st.ta / st.th * 100 : 100;
  }
  const GATES = [
    ...config.exams.map(e => {
      const cutoffDate = addDays(e.startDate, -1);
      return { label:e.name, cutoff:dispDate(cutoffDate), pct: gatePct(cutoffDate), known:true };
    }),
    { label:'End Semester', cutoff:dispDate(config.semEnd), pct: gatePct(config.semEnd), known:true },
  ];

  // ── Calendar weeks — align each day under its actual Mon–Fri column ──
  const weeks = [];
  let curWeek = null;
  for (const d of SEM) {
    if (d.dow === 1 || !curWeek) { curWeek = [null,null,null,null,null]; weeks.push(curWeek); }
    curWeek[d.dow-1] = d;
  }

  // ── Selected day ──
  const selDay    = sel ? SEM.find(d => d.date === sel) : null;
  const selLocked = sel ? lockedStatus(sel) : null;
  const selSlots  = selDay && !selLocked ? slotsFor(selDay.date, selDay.dow) : [];

  if (!authResolved) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-bg" onLayout={onLayoutRootView} />
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-bg justify-center items-center p-6" onLayout={onLayoutRootView}>
          <Text className="font-sans text-2xl font-extrabold text-ink mb-5">Attendance Edge</Text>
          <View className="w-full max-w-[360px]">
            <LoginScreen />
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  if (tabLocked) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-bg justify-center items-center p-6" onLayout={onLayoutRootView}>
          <View className="w-full max-w-[360px] bg-panel border border-border rounded-xl p-4">
            <Text className="font-sans text-[15px] font-bold text-ink mb-2">Multiple sign-ins detected</Text>
            <Text className="font-sans text-[13px] text-muted mb-4">This account is open in another tab. To avoid conflicting edits, only one tab can be active at a time.</Text>
            <Pressable onPress={reclaimTab} className="border border-cyan bg-cyandim rounded-[7px] py-2 items-center mb-1.5">
              <Text className="font-mono text-[10px] text-cyan">Use This Tab</Text>
            </Pressable>
            <Pressable onPress={closeThisTab} className="border border-red bg-reddim rounded-[7px] py-2 items-center">
              <Text className="font-mono text-[10px] text-red">Close This Tab</Text>
            </Pressable>
            {closeAttempted && (
              <Text className="font-mono text-[9px] text-muted2 mt-2 text-center">Your browser blocked auto-close — you can close this tab manually.</Text>
            )}
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <View className="flex-1 bg-bg" onLayout={onLayoutRootView}>
      <StatusBar hidden />

      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-[60px] sm:max-w-[640px] sm:w-full sm:mx-auto sm:p-6" showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View className="flex-row items-start justify-between mb-[3px]">
          <View className="flex-1">
            <Text className="font-mono text-[10px] tracking-[2px] uppercase mb-1 text-cyan">{dispDate(config.semStart)} – {dispDate(config.semEnd)}, {parseDate(config.semEnd).getFullYear()}</Text>
            <Text className="font-sans text-2xl font-extrabold text-ink">Attendance Edge</Text>
          </View>
          <View className="items-end">
            <Text className="font-mono text-[9px] text-muted2 mb-1">v{APP_VERSION}</Text>
            <Pressable onPress={() => setSettingsOpen(true)} className="border px-2.5 py-2 rounded-[7px] border-border">
              <Ionicons name="settings-outline" size={16} color="#7C8B9B" />
            </Pressable>
          </View>
        </View>
        <Text className="font-sans text-xs leading-[18px] mb-[18px] text-muted">Tap a date to log classes · long-press to toggle all</Text>

        <Gauge
          pct={pct}
          tone={tone}
          held={stats.th}
          presentCount={stats.ta}
          threshold={config.threshold}
          statusLine={statusLine}
        />

        <EligibilityGates gates={GATES} threshold={config.threshold} />

        <CourseLedger courses={COURSES} clabel={CLABEL} stats={stats} />

        <CalendarGrid
          weeks={weeks}
          today={TODAY}
          state={state}
          lockedStatus={lockedStatus}
          slotsFor={slotsFor}
          dayMix={dayMix}
          cellClass={cellClass}
          onSelectDay={ds => { setSel(ds); setDayModal(true); }}
          onLongPressDay={handleLongPress}
          status={status}
          onReset={resetAll}
        />

        <Text className="font-sans text-[11px] leading-[17px] mt-3 text-muted2">
          Tap the ⚙ icon to edit the semester length, holidays, exams, and weekly schedule.
        </Text>
      </ScrollView>

      <DayDetailModal
        visible={dayModal}
        onClose={() => setDayModal(false)}
        selDay={selDay}
        selLocked={selLocked}
        selSlots={selSlots}
        state={state}
        onToggleSlot={key => toggleSlot(selDay.date, key)}
        onMarkAll={val => markAll(selDay.date, selDay.dow, val)}
      />

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        setConfig={setConfig}
        user={user}
        onSignOut={handleSignOut}
      />
    </View>
    </SafeAreaProvider>
  );
}
