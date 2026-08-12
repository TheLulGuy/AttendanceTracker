import './global.css';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  useWindowDimensions, Alert, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { fmt, parseDate, addDays } from './lib/dates';
import { MONTHS, DAYNAME, OWNER_EMAIL } from './lib/constants';
import { DEFAULT_CONFIG, EMPTY_CONFIG } from './lib/defaultConfig';
import { migrateConfig } from './lib/configMigration';
import { auth } from './lib/firebase';
import { pushState, pushConfig, subscribeState, subscribeConfig } from './lib/sync';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import { version as APP_VERSION } from './package.json';

SplashScreen.preventAutoHideAsync().catch(() => {});

const THRESHOLD  = 75;
const STORE_KEY  = 'gitam-att-v5';
const CONFIG_KEY = 'gitam-att-config-v1';
const STATE_SYNCED_KEY  = 'gitam-att-v5-synced-at';
const CONFIG_SYNCED_KEY = 'gitam-att-config-v1-synced-at';
const ACTIVE_TAB_KEY    = 'gitam-active-tab';

// One-off cancellations: GCGC1021 cancelled on Jul 3
const OVERRIDES = { '2026-07-03': s => s.filter(x => x.course !== 'GCGC1021') };

const TODAY = fmt(new Date());

function buildSem(semStart, semEnd) {
  const start = parseDate(semStart);
  const end   = parseDate(semEnd);
  if (isNaN(start) || isNaN(end) || end < start) return [];
  const out = [];
  const d = new Date(start);
  while (d <= end) {
    const w = d.getDay();
    if (w >= 1 && w <= 5) out.push({ date:fmt(d), dow:w, day:d.getDate(), month:d.getMonth() });
    d.setDate(d.getDate()+1);
  }
  return out;
}

function deriveCourses(schedule) {
  const seen = new Map();
  Object.values(schedule).flat().forEach(s => { if (!seen.has(s.course)) seen.set(s.course, s.label); });
  return { COURSES:[...seen.keys()], CLABEL:Object.fromEntries(seen) };
}

function dispDate(ds) {
  const d = parseDate(ds);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// state[date][slotKey] = true(present) | false(absent); missing → true
function present(state, ds, key) {
  const d = state[ds];
  return !d || d[key] === undefined ? true : d[key];
}

// ─── Tone helpers — literal class-name branches so Tailwind's static scan finds them ──
function pillClass(p) {
  return p < 60 ? { bg:'bg-reddim', c:'text-red' }
       : p < 67 ? { bg:'bg-amberdim', c:'text-amber' }
       :           { bg:'bg-cyandim', c:'text-cyan' };
}
function mixClass(mix) {
  if (mix === 'none')    return { bg:'bg-reddim', text:'text-red' };
  if (mix === 'partial') return { bg:'bg-amberdim', text:'text-amber' };
  return { bg:'bg-cyandim', text:'text-cyan' };
}
function barTone(pct) {
  return pct < 75 ? { text:'text-red', bg:'bg-red' }
       : pct < 82 ? { text:'text-amber', bg:'bg-amber' }
       :             { text:'text-cyan', bg:'bg-cyan' };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function App() {
  const { width } = useWindowDimensions();

  const [state,    setState]    = useState({});
  const [sel,      setSel]      = useState(null);   // selected date string
  const [dayModal, setDayModal] = useState(false);
  const [status,   setStatus]   = useState('');
  const [config,   setConfig]   = useState(EMPTY_CONFIG);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [tabLocked, setTabLocked] = useState(false);
  const [closeAttempted, setCloseAttempted] = useState(false);
  const autoOpenedWizard = useRef(false);
  const tabId = useRef(Math.random().toString(36).slice(2) + Date.now()).current;

  const saveTimer   = useRef(null);
  const didInit     = useRef(false);
  const cfgSaveTimer = useRef(null);
  const didInitCfg  = useRef(false);
  const stateRef    = useRef(state);
  const configRef   = useRef(config);
  const lastStateAt  = useRef(0);
  const lastConfigAt = useRef(0);
  const suppressStatePush  = useRef(false);
  const suppressConfigPush = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { configRef.current = config; }, [config]);

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

  // ── AsyncStorage: load attendance once on mount ──
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then(raw => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) {
              setState(parsed);
              flash('✓ loaded');
            }
          } catch(_) {}
        }
        didInit.current = true;
        setStateLoaded(true);
      })
      .catch(() => { didInit.current = true; setStateLoaded(true); });
  }, []);

  // ── AsyncStorage: auto-save attendance on every state change ──
  useEffect(() => {
    if (!didInit.current) return;   // never overwrite on the initial empty render
    const isRemote = suppressStatePush.current;
    suppressStatePush.current = false;
    if (!isRemote) setStatus('saving…');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORE_KEY, JSON.stringify(state))
        .then(() => {
          if (isRemote) return;
          flash('✓ saved');
          if (user && !tabLocked) {
            pushState(user.uid, state)
              .then(updatedAt => {
                lastStateAt.current = updatedAt;
                return AsyncStorage.setItem(STATE_SYNCED_KEY, String(updatedAt));
              })
              .catch(() => {});
          }
        })
        .catch(() => setStatus(''));
    }, 400);
  }, [state, user, tabLocked]);

  // ── AsyncStorage: load semester config once on mount ──
  useEffect(() => {
    AsyncStorage.getItem(CONFIG_KEY)
      .then(raw => {
        if (raw) {
          try {
            const migrated = migrateConfig(JSON.parse(raw));
            if (migrated) setConfig(migrated);
          } catch(_) {}
        }
        didInitCfg.current = true;
        setConfigLoaded(true);
      })
      .catch(() => { didInitCfg.current = true; setConfigLoaded(true); });
  }, []);

  // ── AsyncStorage: auto-save semester config on every change ──
  useEffect(() => {
    if (!didInitCfg.current) return;
    const isRemote = suppressConfigPush.current;
    suppressConfigPush.current = false;
    clearTimeout(cfgSaveTimer.current);
    cfgSaveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config))
        .then(() => {
          if (isRemote) return;
          if (user && !tabLocked) {
            pushConfig(user.uid, config)
              .then(updatedAt => {
                lastConfigAt.current = updatedAt;
                return AsyncStorage.setItem(CONFIG_SYNCED_KEY, String(updatedAt));
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }, 400);
  }, [config, user, tabLocked]);

  // ── Firebase: track signed-in user ──
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthResolved(true); }), []);

  // ── Firebase: live sync via Firestore listeners, not just once at login ──
  // A one-time pull isn't enough: a device left open across an edit made on another device
  // would never learn the cloud moved on, and its next save would blindly overwrite the newer
  // data with its now-stale copy. Live listeners keep every open device continuously current.
  // Also waits for both local AsyncStorage loads first - otherwise this could read the still-
  // empty initial state/config (auth can restore faster than the local read) and treat that as
  // authoritative.
  useEffect(() => {
    if (!user || !stateLoaded || !configLoaded) return;
    let cancelled = false;
    let unsubState = () => {};
    let unsubConfig = () => {};

    (async () => {
      const [localStateAt, localConfigAt] = await Promise.all([
        AsyncStorage.getItem(STATE_SYNCED_KEY),
        AsyncStorage.getItem(CONFIG_SYNCED_KEY),
      ]);
      if (cancelled) return;
      lastStateAt.current = Number(localStateAt || 0);
      lastConfigAt.current = Number(localConfigAt || 0);

      unsubState = subscribeState(user.uid, cloud => {
        if (cloud) {
          if (cloud.updatedAt > lastStateAt.current) {
            lastStateAt.current = cloud.updatedAt;
            suppressStatePush.current = true;
            setState(cloud.data || {});
            AsyncStorage.setItem(STATE_SYNCED_KEY, String(cloud.updatedAt)).catch(() => {});
          }
        } else if (lastStateAt.current === 0) {
          // No cloud doc at all yet - seed it from whatever's currently local.
          pushState(user.uid, stateRef.current)
            .then(updatedAt => {
              lastStateAt.current = updatedAt;
              return AsyncStorage.setItem(STATE_SYNCED_KEY, String(updatedAt));
            })
            .catch(() => {});
        }
      });

      unsubConfig = subscribeConfig(user.uid, cloud => {
        if (cloud) {
          if (cloud.updatedAt > lastConfigAt.current) {
            const migrated = migrateConfig(cloud.data);
            if (migrated) {
              lastConfigAt.current = cloud.updatedAt;
              suppressConfigPush.current = true;
              setConfig(migrated);
              AsyncStorage.setItem(CONFIG_SYNCED_KEY, String(cloud.updatedAt)).catch(() => {});
            }
          }
        } else if (lastConfigAt.current === 0) {
          // First sync ever for this account: seed the real GITAM schedule for the owner, blank for everyone else.
          const seed = user.email === OWNER_EMAIL ? DEFAULT_CONFIG : configRef.current;
          if (seed !== configRef.current) { suppressConfigPush.current = true; setConfig(seed); }
          pushConfig(user.uid, seed)
            .then(updatedAt => {
              lastConfigAt.current = updatedAt;
              return AsyncStorage.setItem(CONFIG_SYNCED_KEY, String(updatedAt));
            })
            .catch(() => {});
        }
      });
    })();

    return () => { cancelled = true; unsubState(); unsubConfig(); };
  }, [user, stateLoaded, configLoaded]);

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

  function flash(msg, ms=3000) { setStatus(msg); setTimeout(() => setStatus(''), ms); }

  // ── Firebase: sign out and wipe the local cache so the next login on this device starts clean ──
  async function handleSignOut() {
    await signOut(auth);
    await AsyncStorage.multiRemove([STORE_KEY, CONFIG_KEY, STATE_SYNCED_KEY, CONFIG_SYNCED_KEY]);
    setState({});
    setConfig(EMPTY_CONFIG);
    lastStateAt.current = 0;
    lastConfigAt.current = 0;
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

  // ── Config-derived helpers (close over the current `config`) ──
  function lockedStatus(ds) {
    const h = config.holidays.find(x => ds >= x.date && ds <= (x.endDate || x.date));
    if (h) return { type:'holiday', lbl:h.label };
    const ex = config.exams.find(e => ds >= e.startDate && ds <= e.endDate);
    if (ex) return { type:'exam', lbl:ex.name };
    return null;
  }
  function slotsFor(ds, dow) {
    const base = config.schedule[dow] || [];
    return user?.email === OWNER_EMAIL && OVERRIDES[ds] ? OVERRIDES[ds](base) : base;
  }
  function dayMix(state, ds, dow) {
    const slots = slotsFor(ds, dow);
    if (!slots.length) return 'full';
    const n = slots.filter(s => present(state, ds, s.key)).length;
    return n === slots.length ? 'full' : n === 0 ? 'none' : 'partial';
  }
  function calcStats(state, cutoff) {
    const h = {}, a = {};
    COURSES.forEach(c => { h[c]=0; a[c]=0; });
    for (const d of SEM) {
      if (cutoff && d.date > cutoff) continue;
      if (lockedStatus(d.date)) continue;
      for (const s of slotsFor(d.date, d.dow)) {
        h[s.course]++;
        if (present(state, d.date, s.key)) a[s.course]++;
      }
    }
    let th=0, ta=0;
    COURSES.forEach(c => { th+=h[c]; ta+=a[c]; });
    return { h, a, th, ta };
  }
  function cellClass(d) {
    const lk = lockedStatus(d.date);
    if (lk?.type === 'holiday') return { bg:'bg-holidaybg', text:'text-muted2' };
    if (lk?.type === 'exam')    return { bg:'bg-violetdim', text:'text-violet' };
    return null;
  }

  // ── Stats ──
  const full = calcStats(state);
  const sf   = calcStats(state, TODAY);
  const pct   = full.th ? full.ta / full.th * 100 : 0;
  const sfPct = sf.th   ? sf.ta   / sf.th   * 100 : 100;
  const tone  = barTone(pct);

  const GATES = [
    ...config.exams.map(e => {
      const cutoffDate = addDays(e.startDate, -1);
      const st = calcStats(state, cutoffDate);
      return { label:e.name, cutoff:dispDate(cutoffDate), pct: st.th ? st.ta/st.th*100 : 100, known:true };
    }),
    { label:'End Semester', cutoff:dispDate(config.semEnd), pct, known:true },
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

        {/* ── Gauge ── */}
        <View className="bg-panel border border-border rounded-xl p-3.5 mb-3">
          <View className="flex-row items-center justify-between gap-1.5">
            <Text className={`font-sans text-4xl font-extrabold leading-[42px] ${tone.text}`}>
              {pct.toFixed(1)}<Text className="font-sans text-sm font-normal text-muted">%</Text>
            </Text>
            <Text className="font-mono text-[10px] text-muted">target 82% · floor 75%</Text>
          </View>
          {/* Bar track */}
          <View className="h-2.5 rounded-md overflow-hidden bg-track my-2">
            <View className={`h-full rounded-md ${tone.bg}`} style={{ width:`${Math.min(100,pct)}%` }} />
          </View>
          <View className="flex-row items-center gap-1.5">
            {[['HELD',full.th],['PRESENT',full.ta],['ABSENT',full.th-full.ta]].map(([l,v])=>(
              <Text key={l} className="font-mono text-[10px] text-muted2">{l} <Text className="text-ink">{v}</Text></Text>
            ))}
          </View>
          <View className="border-t border-border mt-2">
            <Text className="font-mono text-[10px] text-muted mt-2">
              {TODAY < config.semStart ? "Semester hasn't started yet" :
               TODAY > config.semEnd   ? 'Semester over' :
               `Actual so far: ${sfPct.toFixed(1)}% (${sf.ta}/${sf.th} through today)`}
            </Text>
          </View>
        </View>

        {/* ── Eligibility Gates ── */}
        <Text className="font-mono text-[10px] tracking-[2px] uppercase mb-2 text-muted">Exam Eligibility · need ≥75%</Text>
        <View className="flex-row items-center gap-2 mb-[18px]">
          {GATES.map(({ label, cutoff, pct:p, known }) => {
            const eligible   = known && p != null && p >= THRESHOLD;
            const textClass  = !known ? 'text-muted2' : eligible ? 'text-cyan' : 'text-red';
            const borderClass= !known ? 'border-border' : eligible ? 'border-cyan' : 'border-red';
            const badgeBg    = !known ? 'bg-holidaybg' : eligible ? 'bg-cyandim' : 'bg-reddim';
            return (
              <View key={label} className={`bg-panel border rounded-xl p-2.5 flex-1 ${borderClass}`}>
                <Text className="font-mono text-[10px] text-muted2 mb-0.5">{label}</Text>
                <Text className={`font-mono-bold text-xl mb-[3px] ${textClass}`}>{known && p!=null ? p.toFixed(1)+'%' : '—'}</Text>
                <View className={`px-[7px] py-0.5 rounded-full self-start ${badgeBg}`}>
                  <Text className={`font-mono text-[10px] ${textClass}`}>
                    {!known ? 'TBD' : eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                  </Text>
                </View>
                <Text className="font-mono text-[10px] text-muted2 mt-[3px]">{cutoff}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Course Ledger ── */}
        <Text className="font-mono text-[10px] tracking-[2px] uppercase mb-2 text-muted">Course Ledger</Text>
        <View className="bg-panel border border-border rounded-xl p-0 mb-[18px] overflow-hidden">
          <View className="flex-row items-center bg-panel2 border-b border-border">
            {['Course','Held','Present','%'].map((h,i)=>(
              <Text key={h} className={`font-mono text-[10px] text-muted2 p-2 ${i===0?'flex-[2]':'flex-1'}`}>{h.toUpperCase()}</Text>
            ))}
          </View>
          {COURSES.map((c,i) => {
            const h=full.h[c], a=full.a[c], p=h?a/h*100:100;
            const { bg, c:col } = pillClass(p);
            return (
              <View key={c} className={`flex-row items-center ${i<COURSES.length-1?'border-b border-border':''}`}>
                <Text className="flex-[2] p-2 text-xs font-semibold text-ink font-sans">{CLABEL[c]}</Text>
                <Text className="flex-1 p-2 font-mono text-[10px] text-muted">{h}</Text>
                <Text className="flex-1 p-2 font-mono text-[10px] text-muted">{a}</Text>
                <View className="flex-1 p-2">
                  <View className={`px-[7px] py-0.5 rounded-full self-start ${bg}`}>
                    <Text className={`font-mono-bold text-[10px] ${col}`}>{p.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Calendar Header ── */}
        <View className="flex-row items-center flex-wrap gap-1.5 mb-2">
          <Text className="font-mono text-[10px] tracking-[2px] uppercase text-muted flex-1">Calendar</Text>
          {status ? <Text className="font-mono text-[10px] text-muted self-center">{status}</Text> : null}
          <Pressable onPress={resetAll} className="border px-2.5 py-1.5 rounded-[7px] border-red bg-reddim"><Text className="font-mono text-[10px] text-red">Reset</Text></Pressable>
        </View>

        {/* ── Calendar Grid ── */}
        <View className="bg-panel border border-border rounded-xl p-2.5">
          <View className="flex-row items-center gap-1 mb-1.5">
            {['MON','TUE','WED','THU','FRI'].map(d=>(
              <Text key={d} className="font-mono text-[10px] flex-1 text-center text-muted2 tracking-[1px]">{d}</Text>
            ))}
          </View>
          {weeks.map((week,wi)=>(
            <View key={wi} className="flex-row items-center gap-1 mb-1">
              {week.map((d, di) => {
                if (!d) return (
                  <View key={`blank-${di}`} className="flex-1 rounded-[7px] p-[5px] border border-transparent bg-panel2 items-center justify-center">
                    <Text className="font-mono text-[12px] text-muted2">✕</Text>
                  </View>
                );
                const lk       = lockedStatus(d.date);
                const isToday  = d.date === TODAY;
                const isFuture = d.date > TODAY;
                const mix      = !lk ? dayMix(state, d.date, d.dow) : 'full';
                const tc       = cellClass(d) || mixClass(mix);
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => { if (lk) return; setSel(d.date); setDayModal(true); }}
                    onLongPress={() => { if (lk) return; handleLongPress(d.date, d.dow); }}
                    delayLongPress={600}
                    className={`flex-1 rounded-[7px] p-[5px] items-center ${tc.bg} ${isFuture?'opacity-60':'opacity-100'} ${isToday?'border-2 border-ink':'border border-transparent'}`}
                  >
                    <Text className={`font-mono-bold text-[12px] ${tc.text}`}>{d.day}</Text>
                    <Text className={`font-mono text-[8px] opacity-70 ${tc.text}`}>{MONTHS[d.month]}</Text>
                    {mix === 'partial' && !lk && (
                      <View className="flex-row gap-[1px] mt-0.5 flex-wrap justify-center">
                        {slotsFor(d.date, d.dow).map(s=>(
                          <View key={s.key} className={`w-[3px] h-[3px] rounded-[2px] ${present(state,d.date,s.key)?'bg-cyan':'bg-red'}`} />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {/* Legend */}
          <View className="flex-row flex-wrap gap-2.5 pt-2 border-t border-border mt-1">
            {[['bg-cyan','All present'],['bg-amber','Partial'],['bg-red','All absent'],['bg-holidaydot','Holiday'],['bg-violet','Exam']].map(([c,l])=>(
              <View key={l} className="flex-row items-center gap-1.5">
                <View className={`w-2 h-2 rounded-[2px] mr-1 ${c}`} />
                <Text className="font-mono text-[10px] text-muted2">{l}</Text>
              </View>
            ))}
            <Text className="font-mono text-[10px] text-muted2">Long-press = toggle all</Text>
          </View>
        </View>

        <Text className="font-sans text-[11px] leading-[17px] mt-3 text-muted2">
          Tap the ⚙ icon to edit the semester length, holidays, exams, and weekly schedule.
        </Text>
      </ScrollView>

      {/* ══ Day Detail Modal ══ */}
      <Modal visible={dayModal} transparent animationType="slide" onRequestClose={()=>setDayModal(false)}>
        <View className="flex-1 justify-end bg-black/75 sm:justify-center sm:p-6">
          <View className="bg-panel2 rounded-t-[20px] p-5 max-h-[80%] sm:max-w-[560px] sm:w-full sm:mx-auto sm:rounded-[20px]">
            {selDay && (
              <>
                <View className="flex-row flex-wrap gap-2 mb-3.5">
                  <View className="flex-1">
                    <Text className="font-sans text-[17px] font-bold text-ink">{DAYNAME[selDay.dow]}</Text>
                    <Text className="font-mono text-[10px] text-muted">{MONTHS[selDay.month]} {selDay.day}</Text>
                    {selLocked && <Text className="font-mono text-[10px] text-violet">{selLocked.lbl}</Text>}
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    {!selLocked && <>
                      <Pressable onPress={()=>markAll(selDay.date,selDay.dow,true)} className="border px-2.5 py-1.5 rounded-[7px] border-cyan bg-cyandim">
                        <Text className="font-mono text-[10px] text-cyan">All Present</Text>
                      </Pressable>
                      <Pressable onPress={()=>markAll(selDay.date,selDay.dow,false)} className="border px-2.5 py-1.5 rounded-[7px] border-red bg-reddim">
                        <Text className="font-mono text-[10px] text-red">All Absent</Text>
                      </Pressable>
                    </>}
                    <Pressable onPress={()=>setDayModal(false)} className="border px-2.5 py-1.5 rounded-[7px] border-border">
                      <Text className="font-mono text-[10px] text-muted">✕</Text>
                    </Pressable>
                  </View>
                </View>
                {selLocked ? (
                  <Text className="font-sans text-[13px] text-muted">
                    {selLocked.type==='holiday'?`${selLocked.lbl} — no classes`:'Exam period — attendance frozen'}
                  </Text>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {selSlots.map(sl => {
                      const pr = present(state, selDay.date, sl.key);
                      return (
                        <Pressable key={sl.key} onPress={()=>toggleSlot(selDay.date,sl.key)}
                          className={`flex-row items-center justify-between p-3 rounded-lg mb-1.5 border ${pr?'bg-cyandim border-cyan':'bg-reddim border-red'}`}>
                          <View className="flex-row items-center gap-1.5">
                            <Text className="font-mono text-[10px] text-muted min-w-[46px]">{sl.time}</Text>
                            <Text className="font-sans text-[13px] font-semibold text-ink">{sl.label}</Text>
                          </View>
                          <View className={`px-[7px] py-0.5 rounded-full self-start ${pr?'bg-presentbadge':'bg-absentbadge'}`}>
                            <Text className={`font-mono-bold text-[10px] ${pr?'text-cyan':'text-red'}`}>
                              {pr?'PRESENT':'ABSENT'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ══ Settings Modal ══ */}
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
