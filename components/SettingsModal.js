import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt, parseDate } from '../lib/dates';
import { DAYNAME, OWNER_EMAIL } from '../lib/constants';
import { DEFAULT_CONFIG, EMPTY_CONFIG } from '../lib/defaultConfig';
import { parseScheduleText } from '../lib/scheduleImport';
import WebDatePicker from './WebDatePicker';
import WebDateRangePicker from './WebDateRangePicker';

function openDatePicker(value, onChange) {
  DateTimePickerAndroid.open({
    value: parseDate(value),
    mode: 'date',
    display: 'calendar',
    onChange: (event, selected) => {
      if (event.type === 'set' && selected) onChange(fmt(selected));
    },
  });
}

function DateChip({ label, value, onChange }) {
  const [webPickerOpen, setWebPickerOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => Platform.OS === 'web' ? setWebPickerOpen(true) : openDatePicker(value || fmt(new Date()), onChange)}
        className="border border-border rounded-lg px-2.5 py-2 bg-panel2 flex-1"
      >
        <Text className="font-mono text-[9px] text-muted2 uppercase tracking-[1px] mb-0.5">{label}</Text>
        <Text className={`font-mono text-[12px] ${value ? 'text-ink' : 'text-muted2'}`}>{value || 'Select date'}</Text>
      </Pressable>
      {Platform.OS === 'web' && (
        <WebDatePicker
          visible={webPickerOpen}
          value={value}
          onChange={onChange}
          onClose={() => setWebPickerOpen(false)}
        />
      )}
    </>
  );
}

// Single calendar for picking a from/to pair (web); falls back to two separate DateChips on native,
// since DateTimePickerAndroid has no range mode.
function DateRangeChip({ fromLabel='Start', toLabel='End', from, to, onChange }) {
  const [open, setOpen] = useState(false);

  if (Platform.OS !== 'web') {
    return (
      <View className="flex-row gap-2 flex-1">
        <DateChip label={fromLabel} value={from} onChange={d => onChange(d, d > to ? d : to)} />
        <DateChip label={toLabel}   value={to}   onChange={d => onChange(d < from ? d : from, d)} />
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} className="border border-border rounded-lg px-2.5 py-2 bg-panel2 flex-1 flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="font-mono text-[9px] text-muted2 uppercase tracking-[1px] mb-0.5">{fromLabel}</Text>
          <Text className={`font-mono text-[12px] ${from ? 'text-ink' : 'text-muted2'}`}>{from || 'Select'}</Text>
        </View>
        <Ionicons name="arrow-forward" size={12} color="#566373" />
        <View className="flex-1 items-end">
          <Text className="font-mono text-[9px] text-muted2 uppercase tracking-[1px] mb-0.5">{toLabel}</Text>
          <Text className={`font-mono text-[12px] ${to ? 'text-ink' : 'text-muted2'}`}>{to || 'Select'}</Text>
        </View>
      </Pressable>
      <WebDateRangePicker visible={open} from={from} to={to} onChange={onChange} onClose={() => setOpen(false)} />
    </>
  );
}

function SectionLabel({ children }) {
  return <Text className="font-mono text-[10px] tracking-[2px] uppercase mb-2 text-muted">{children}</Text>;
}

function RemoveBtn({ onPress }) {
  return (
    <Pressable onPress={onPress} className="border border-red bg-reddim rounded-[7px] p-1.5">
      <Ionicons name="trash-outline" size={13} color="#E5484D" />
    </Pressable>
  );
}

function AccountSection({ user, onSignOut }) {
  return (
    <View className="mb-5">
      <SectionLabel>Account</SectionLabel>
      <View className="bg-panel border border-border rounded-xl p-3 flex-row items-center justify-between">
        <Text className="font-sans text-[12px] text-ink flex-1" numberOfLines={1}>{user.email}</Text>
        <Pressable onPress={onSignOut} className="border border-red bg-reddim rounded-[7px] px-2.5 py-1.5">
          <Text className="font-mono text-[10px] text-red">Log Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ThresholdSection({ config, setConfig }) {
  const [text, setText] = useState(String(config.threshold));
  useEffect(() => setText(String(config.threshold)), [config.threshold]);

  function commit() {
    const n = parseInt(text, 10);
    const clamped = isNaN(n) ? config.threshold : Math.min(100, Math.max(0, n));
    setText(String(clamped));
    setConfig(c => ({ ...c, threshold: clamped }));
  }

  return (
    <View className="mb-5">
      <SectionLabel>Attendance Threshold</SectionLabel>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={commit}
          keyboardType="number-pad"
          className="border border-border rounded-lg px-2.5 py-2 bg-panel2 text-ink font-mono text-[12px] w-[60px] text-center"
        />
        <Text className="font-mono text-[10px] text-muted2 flex-1">% minimum required to stay exam-eligible (default 75)</Text>
      </View>
    </View>
  );
}

export default function SettingsModal({ visible, onClose, config, setConfig, user, onSignOut }) {
  const insets = useSafeAreaInsets();
  const [newHolidayDate,    setNewHolidayDate]    = useState(null);
  const [newHolidayEnd,     setNewHolidayEnd]     = useState(null);
  const [newHolidayMulti,   setNewHolidayMulti]   = useState(false);
  const [newHolidayLabel,   setNewHolidayLabel]   = useState('');
  const [newExamName,  setNewExamName]  = useState('');
  const [newExamStart, setNewExamStart] = useState(null);
  const [newExamEnd,   setNewExamEnd]   = useState(null);
  const [selDay, setSelDay] = useState(1);
  const [newSlotTime,   setNewSlotTime]   = useState('');
  const [newSlotCourse, setNewSlotCourse] = useState('');
  const [newSlotLabel,  setNewSlotLabel]  = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg,  setBulkMsg]  = useState('');

  function update(patch) { setConfig(c => ({ ...c, ...patch })); }

  function addHoliday() {
    if (!newHolidayLabel.trim() || !newHolidayDate) return;
    const entry = { date:newHolidayDate, label:newHolidayLabel.trim() };
    if (newHolidayMulti && newHolidayEnd && newHolidayEnd > newHolidayDate) entry.endDate = newHolidayEnd;
    setConfig(c => ({
      ...c,
      holidays: [...c.holidays, entry].sort((a,b) => a.date.localeCompare(b.date)),
    }));
    setNewHolidayLabel('');
    setNewHolidayMulti(false);
    setNewHolidayDate(null);
    setNewHolidayEnd(null);
  }
  function removeHoliday(idx) {
    setConfig(c => ({ ...c, holidays: c.holidays.filter((_,i) => i!==idx) }));
  }
  function updateHoliday(idx, patch) {
    setConfig(c => ({ ...c, holidays: c.holidays.map((h,i) => i===idx ? { ...h, ...patch } : h) }));
  }

  function addExam() {
    if (!newExamName.trim() || !newExamStart || !newExamEnd) return;
    setConfig(c => ({ ...c, exams: [...c.exams, { name:newExamName.trim(), startDate:newExamStart, endDate:newExamEnd }] }));
    setNewExamName('');
    setNewExamStart(null);
    setNewExamEnd(null);
  }
  function removeExam(idx) {
    setConfig(c => ({ ...c, exams: c.exams.filter((_,i) => i!==idx) }));
  }
  function updateExam(idx, patch) {
    setConfig(c => ({ ...c, exams: c.exams.map((e,i) => i===idx ? { ...e, ...patch } : e) }));
  }

  function addSlot() {
    if (!newSlotTime.trim() || !newSlotCourse.trim()) return;
    const course = newSlotCourse.trim().toUpperCase();
    const slot = { key:`${selDay}-${Date.now()}`, time:newSlotTime.trim(), course, label:newSlotLabel.trim() || course };
    setConfig(c => ({
      ...c,
      schedule: {
        ...c.schedule,
        [selDay]: [...(c.schedule[selDay]||[]), slot].sort((a,b) => a.time.localeCompare(b.time)),
      },
    }));
    setNewSlotTime(''); setNewSlotCourse(''); setNewSlotLabel('');
  }
  function removeSlot(key) {
    setConfig(c => ({ ...c, schedule: { ...c.schedule, [selDay]: c.schedule[selDay].filter(s => s.key!==key) } }));
  }

  function importBulkSchedule() {
    const parsed = parseScheduleText(bulkText);
    const dows = Object.keys(parsed);
    if (!dows.length) { setBulkMsg('No classes found — check the format.'); return; }
    const count = dows.reduce((n, d) => n + parsed[d].length, 0);
    setConfig(c => ({ ...c, schedule: { ...c.schedule, ...parsed } }));
    setBulkText('');
    setBulkMsg(`Added ${count} class${count===1?'':'es'} across ${dows.length} day${dows.length===1?'':'s'}.`);
  }

  const isOwner = user?.email === OWNER_EMAIL;
  const hasConfigured = Object.values(config.schedule).some(day => day.length > 0);

  function resetDefault() {
    const target = isOwner ? DEFAULT_CONFIG : EMPTY_CONFIG;
    Alert.alert(
      'Reset Settings',
      isOwner ? 'Restore the default GITAM Bengaluru semester? This discards your schedule, exam, and holiday edits.'
              : 'Clear your semester setup? This discards your schedule, exam, and holiday edits.',
      [
        { text:'Cancel', style:'cancel' },
        { text:'Reset', style:'destructive', onPress: () => setConfig(target) },
      ]
    );
  }

  const daySlots = config.schedule[selDay] || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/75 sm:justify-center sm:p-6">
        <View className="bg-panel2 rounded-t-[20px] p-5 max-h-[92%] sm:max-w-[560px] sm:w-full sm:mx-auto sm:rounded-[20px]" style={{ paddingTop: Math.max(20, insets.top + 14) }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-sans text-[17px] font-bold text-ink">Settings</Text>
            <Pressable onPress={onClose} className="border px-2.5 py-1.5 rounded-[7px] border-border">
              <Text className="font-mono text-[10px] text-muted">✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            <AccountSection user={user} onSignOut={onSignOut} />

            {!hasConfigured && (
              <View className="bg-cyandim border border-cyan rounded-xl p-3 mb-5">
                <Text className="font-sans text-[12px] text-cyan">Welcome — set up your semester below to get started.</Text>
              </View>
            )}

            {/* ── Semester Length ── */}
            <View className="mb-5">
              <SectionLabel>Semester Length</SectionLabel>
              <View className="flex-row gap-2">
                <DateRangeChip from={config.semStart} to={config.semEnd} onChange={(s,e) => update({ semStart:s, semEnd:e })} />
              </View>
            </View>

            <ThresholdSection config={config} setConfig={setConfig} />

            {/* ── Holidays ── */}
            <View className="mb-5">
              <SectionLabel>Holidays</SectionLabel>
              {config.holidays.map((h, i) => (
                <View key={h.date+i} className="flex-row flex-wrap items-center gap-1.5 mb-1.5">
                  {h.endDate != null ? (
                    <DateRangeChip fromLabel="Date" toLabel="Through" from={h.date} to={h.endDate}
                      onChange={(s,e) => updateHoliday(i, { date:s, endDate:e })} />
                  ) : (
                    <DateChip label="Date" value={h.date} onChange={d => updateHoliday(i, { date:d })} />
                  )}
                  <TextInput
                    value={h.label}
                    onChangeText={t => updateHoliday(i, { label:t })}
                    className="flex-1 min-w-[110px] font-sans text-[12px] border border-border rounded-lg px-2.5 py-2 bg-panel text-ink"
                  />
                  <Pressable
                    onPress={() => updateHoliday(i, h.endDate != null ? { endDate:undefined } : { endDate:h.date })}
                    className="border border-border rounded-[7px] p-1.5 shrink-0"
                  >
                    <Ionicons name={h.endDate != null ? 'contract-outline' : 'expand-outline'} size={13} color="#7C8B9B" />
                  </Pressable>
                  <RemoveBtn onPress={() => removeHoliday(i)} />
                </View>
              ))}
              <View className="flex-row flex-wrap items-center gap-1.5 mt-1">
                {newHolidayMulti ? (
                  <DateRangeChip fromLabel="Date" toLabel="Through" from={newHolidayDate} to={newHolidayEnd}
                    onChange={(s,e) => { setNewHolidayDate(s); setNewHolidayEnd(e); }} />
                ) : (
                  <DateChip label="Date" value={newHolidayDate} onChange={setNewHolidayDate} />
                )}
                <TextInput
                  value={newHolidayLabel}
                  onChangeText={setNewHolidayLabel}
                  placeholder="Holiday name"
                  placeholderTextColor="#566373"
                  className="flex-1 min-w-[110px] font-sans text-[12px] border border-border rounded-lg px-2.5 py-2 bg-panel text-ink"
                />
                <Pressable
                  onPress={() => setNewHolidayMulti(m => !m)}
                  className={`border rounded-[7px] p-1.5 shrink-0 ${newHolidayMulti ? 'border-cyan bg-cyandim' : 'border-border'}`}
                >
                  <Ionicons name={newHolidayMulti ? 'contract-outline' : 'expand-outline'} size={13} color={newHolidayMulti ? '#2DD4BF' : '#7C8B9B'} />
                </Pressable>
                <Pressable onPress={addHoliday} className="border border-cyan bg-cyandim rounded-[7px] p-1.5 shrink-0">
                  <Ionicons name="add" size={16} color="#2DD4BF" />
                </Pressable>
              </View>
              <Text className="font-mono text-[9px] text-muted2 mt-1">Tap the expand icon for a multi-day holiday (e.g. Winter Break).</Text>
            </View>

            {/* ── Exams ── */}
            <View className="mb-5">
              <SectionLabel>Exams</SectionLabel>
              {config.exams.map((e, i) => (
                <View key={e.name+i} className="bg-panel border border-border rounded-xl p-2.5 mb-1.5">
                  <View className="flex-row flex-wrap items-center justify-between mb-1.5 gap-1.5">
                    <TextInput
                      value={e.name}
                      onChangeText={t => updateExam(i, { name:t })}
                      className="flex-1 min-w-[110px] font-sans text-[13px] font-semibold text-ink"
                    />
                    <RemoveBtn onPress={() => removeExam(i)} />
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <DateRangeChip from={e.startDate} to={e.endDate} onChange={(s,en) => updateExam(i, { startDate:s, endDate:en })} />
                  </View>
                </View>
              ))}
              <View className="bg-panel border border-border rounded-xl p-2.5">
                <TextInput
                  value={newExamName}
                  onChangeText={setNewExamName}
                  placeholder="Exam name (e.g. Sessional 2)"
                  placeholderTextColor="#566373"
                  className="font-sans text-[13px] text-ink mb-1.5"
                />
                <View className="flex-row flex-wrap items-center gap-2">
                  <DateRangeChip from={newExamStart} to={newExamEnd} onChange={(s,e) => { setNewExamStart(s); setNewExamEnd(e); }} />
                  <Pressable onPress={addExam} className="border border-cyan bg-cyandim rounded-[7px] p-1.5 shrink-0">
                    <Ionicons name="add" size={16} color="#2DD4BF" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* ── Weekly Schedule ── */}
            <View className="mb-3">
              <SectionLabel>Weekly Schedule</SectionLabel>
              <View className="flex-row gap-1.5 mb-2.5">
                {[1,2,3,4,5].map(dow => (
                  <Pressable
                    key={dow}
                    onPress={() => setSelDay(dow)}
                    className={`flex-1 items-center py-1.5 rounded-[7px] border ${selDay===dow ? 'border-cyan bg-cyandim' : 'border-border'}`}
                  >
                    <Text className={`font-mono text-[10px] ${selDay===dow ? 'text-cyan' : 'text-muted'}`}>{DAYNAME[dow].slice(0,3).toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              {daySlots.map(s => (
                <View key={s.key} className="flex-row items-center gap-1.5 mb-1.5">
                  <Text className="font-mono text-[10px] text-muted min-w-[42px]">{s.time}</Text>
                  <Text className="flex-1 font-sans text-[12px] text-ink">{s.label}</Text>
                  <RemoveBtn onPress={() => removeSlot(s.key)} />
                </View>
              ))}
              {!daySlots.length && (
                <Text className="font-sans text-[12px] text-muted2 mb-1.5">No classes scheduled.</Text>
              )}

              <View className="flex-row flex-wrap items-center gap-1.5 mt-1">
                <TextInput
                  value={newSlotTime}
                  onChangeText={setNewSlotTime}
                  placeholder="HH:MM"
                  placeholderTextColor="#566373"
                  className="font-mono text-[11px] border border-border rounded-lg px-2 py-2 bg-panel text-ink w-[64px]"
                />
                <TextInput
                  value={newSlotCourse}
                  onChangeText={setNewSlotCourse}
                  placeholder="Course code"
                  placeholderTextColor="#566373"
                  className="flex-1 min-w-[110px] font-sans text-[12px] border border-border rounded-lg px-2.5 py-2 bg-panel text-ink"
                />
                <TextInput
                  value={newSlotLabel}
                  onChangeText={setNewSlotLabel}
                  placeholder="Label (optional)"
                  placeholderTextColor="#566373"
                  className="flex-1 min-w-[110px] font-sans text-[12px] border border-border rounded-lg px-2.5 py-2 bg-panel text-ink"
                />
                <Pressable onPress={addSlot} className="border border-cyan bg-cyandim rounded-[7px] p-1.5 shrink-0">
                  <Ionicons name="add" size={16} color="#2DD4BF" />
                </Pressable>
              </View>

              <Pressable onPress={() => setBulkOpen(o => !o)} className="flex-row items-center gap-1 mt-2.5">
                <Ionicons name={bulkOpen ? 'chevron-down' : 'chevron-forward'} size={12} color="#7C8B9B" />
                <Text className="font-mono text-[10px] text-muted">Bulk Import(Prompt Message Included)</Text>
              </Pressable>

              {bulkOpen && (
                <View className="bg-panel border border-border rounded-xl p-2.5 mt-1.5">
                  <Text className="font-mono text-[9px] text-muted2 mb-1.5">
                    {'One day name per line, then "HH:MM COURSE" per class:\nMonday\n08:00 ECE1021\n09:00 ECE1033'}
                  </Text>
                  <TextInput
                    value={bulkText}
                    onChangeText={setBulkText}
                    multiline
                    placeholder={'Monday\n08:00 ECE1021\n09:00 ECE1033'}
                    placeholderTextColor="#566373"
                    textAlignVertical="top"
                    className="font-mono text-[11px] border border-border rounded-lg px-2.5 py-2 bg-panel2 text-ink min-h-[100px] mb-1.5"
                  />
                  <Pressable onPress={importBulkSchedule} className="border border-cyan bg-cyandim rounded-[7px] py-2 items-center">
                    <Text className="font-mono text-[10px] text-cyan">Import</Text>
                  </Pressable>
                  {!!bulkMsg && <Text className="font-mono text-[9px] text-muted2 mt-1.5">{bulkMsg}</Text>}
                </View>
              )}
            </View>

            <Pressable onPress={resetDefault} className="border border-red bg-reddim rounded-[7px] px-2.5 py-2 items-center mt-2 mb-6">
              <Text className="font-mono text-[10px] text-red">Reset to Default</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
