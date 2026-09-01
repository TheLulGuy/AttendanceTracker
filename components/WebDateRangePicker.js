import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmt, parseDate } from '../lib/dates';
import { MONTHS } from '../lib/constants';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function buildGrid(year, month) {
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// One calendar, click a start date then an end date — the days between highlight as a range.
// Clicking before the current start restarts the range from that new date.
export default function WebDateRangePicker({ visible, from, to, onChange, onClose }) {
  const anchor = parseDate(from || to || fmt(new Date()));
  const [year, setYear] = useState(anchor.getFullYear());
  const [month, setMonth] = useState(anchor.getMonth());
  const [draftFrom, setDraftFrom] = useState(from || null);
  const [draftTo, setDraftTo] = useState(to && to !== from ? to : null);

  useEffect(() => {
    if (!visible) return;
    setDraftFrom(from || null);
    setDraftTo(to && to !== from ? to : null);
    const a = parseDate(from || to || fmt(new Date()));
    setYear(a.getFullYear());
    setMonth(a.getMonth());
  }, [visible]);

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  }

  function pick(day) {
    const dateStr = fmt(new Date(year, month, day, 12));
    if (!draftFrom || draftTo) {
      setDraftFrom(dateStr);
      setDraftTo(null);
    } else if (dateStr < draftFrom) {
      setDraftFrom(dateStr);
      setDraftTo(null);
    } else {
      setDraftTo(dateStr);
    }
  }

  function apply() {
    if (!draftFrom) return;
    onChange(draftFrom, draftTo || draftFrom);
    onClose();
  }

  const cells = buildGrid(year, month);
  const todayStr = fmt(new Date());

  function cellState(dateStr) {
    const isFrom = dateStr === draftFrom;
    const isTo = dateStr === draftTo;
    const inRange = draftFrom && draftTo && dateStr > draftFrom && dateStr < draftTo;
    return { isFrom, isTo, inRange };
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/75 px-6">
        <View className="bg-panel2 border border-border rounded-xl p-3 w-full max-w-[320px]">
          <View className="flex-row items-center justify-between mb-2.5">
            <Pressable onPress={() => shiftMonth(-1)} className="p-1.5">
              <Ionicons name="chevron-back" size={16} color="#7C8B9B" />
            </Pressable>
            <Text className="font-mono text-[12px] text-ink tracking-[1px]">{MONTHS[month]} {year}</Text>
            <Pressable onPress={() => shiftMonth(1)} className="p-1.5">
              <Ionicons name="chevron-forward" size={16} color="#7C8B9B" />
            </Pressable>
          </View>

          <View className="flex-row items-center mb-1">
            {WEEKDAYS.map(w => (
              <Text key={w} className="font-mono text-[9px] flex-1 text-center text-muted2 tracking-[1px]">{w}</Text>
            ))}
          </View>

          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, wi) => cells.slice(wi * 7, wi * 7 + 7)).map((week, wi) => (
            <View key={wi} className="flex-row items-center mb-1">
              {week.map((day, di) => {
                if (day == null) return (
                  <View key={di} className="flex-1 rounded-[7px] p-[5px] border border-transparent bg-panel2 items-center justify-center">
                    <Text className="font-mono text-[12px] text-muted2">✕</Text>
                  </View>
                );
                const dateStr = fmt(new Date(year, month, day, 12));
                const isToday = dateStr === todayStr;
                const { isFrom, isTo, inRange } = cellState(dateStr);
                const endpoint = isFrom || isTo;
                return (
                  <Pressable
                    key={di}
                    onPress={() => pick(day)}
                    className={`flex-1 p-[5px] items-center
                      ${endpoint ? 'bg-cyan rounded-[7px]' : inRange ? 'bg-cyandim' : 'border border-transparent rounded-[7px]'}
                      ${isToday && !endpoint ? 'border border-ink rounded-[7px]' : ''}`}
                  >
                    <Text className={`font-mono-bold text-[12px] ${endpoint ? 'text-bg' : inRange ? 'text-cyan' : 'text-ink'}`}>{day}</Text>
                  </Pressable>
                );
              })}
              {Array.from({ length: 7 - week.length }, (_, i) => (
                <View key={`pad-${i}`} className="flex-1 rounded-[7px] p-[5px] border border-transparent bg-panel2 items-center justify-center">
                  <Text className="font-mono text-[12px] text-muted2">✕</Text>
                </View>
              ))}
            </View>
          ))}

          <Text className="font-mono text-[10px] text-muted2 text-center mt-1.5">
            {draftFrom && draftTo ? `${draftFrom} → ${draftTo}` : draftFrom ? 'Pick an end date' : 'Pick a start date'}
          </Text>

          <View className="flex-row gap-1.5 mt-1.5">
            <Pressable onPress={onClose} className="flex-1 border border-border rounded-[7px] py-1.5 items-center">
              <Text className="font-mono text-[10px] text-muted">Cancel</Text>
            </Pressable>
            <Pressable onPress={apply} disabled={!draftFrom} className={`flex-1 border rounded-[7px] py-1.5 items-center ${draftFrom ? 'border-cyan bg-cyandim' : 'border-border opacity-50'}`}>
              <Text className={`font-mono text-[10px] ${draftFrom ? 'text-cyan' : 'text-muted'}`}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
