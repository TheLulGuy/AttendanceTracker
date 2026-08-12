import React, { useState } from 'react';
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

export default function WebDatePicker({ visible, value, onChange, onClose }) {
  const selected = parseDate(value);
  const [year, setYear] = useState(selected.getFullYear());
  const [month, setMonth] = useState(selected.getMonth());

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  }

  function pick(day) {
    const d = new Date(year, month, day, 12);
    onChange(fmt(d));
    onClose();
  }

  const cells = buildGrid(year, month);
  const todayStr = fmt(new Date());

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
                if (day == null) return <View key={di} className="flex-1 rounded-[7px] p-[5px] border border-transparent" />;
                const dateStr = fmt(new Date(year, month, day, 12));
                const isSel = dateStr === value;
                const isToday = dateStr === todayStr;
                return (
                  <Pressable
                    key={di}
                    onPress={() => pick(day)}
                    className={`flex-1 rounded-[7px] p-[5px] items-center ${isSel ? 'bg-cyandim border border-cyan' : 'border border-transparent'} ${isToday && !isSel ? 'border border-ink' : ''}`}
                  >
                    <Text className={`font-mono-bold text-[12px] ${isSel ? 'text-cyan' : 'text-ink'}`}>{day}</Text>
                  </Pressable>
                );
              })}
              {Array.from({ length: 7 - week.length }, (_, i) => <View key={`pad-${i}`} className="flex-1 rounded-[7px] p-[5px] border border-transparent" />)}
            </View>
          ))}

          <Pressable onPress={onClose} className="border border-border rounded-[7px] py-1.5 items-center mt-1.5">
            <Text className="font-mono text-[10px] text-muted">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
