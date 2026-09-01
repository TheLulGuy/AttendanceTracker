import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MONTHS } from '../lib/constants';
import { present, mixClass } from '../lib/attendance';

// Fixed height (not content-derived) so every cell — blank, today, partial-attendance dots or not —
// is exactly the same size by construction. border-2 always, so the today outline never grows the box.
const CELL_BASE = 'flex-1 h-[46px] rounded-[7px] p-[5px] items-center justify-center border-2';

export default function CalendarGrid({
  weeks, today, state, lockedStatus, slotsFor, dayMix, cellClass,
  onSelectDay, onLongPressDay, status, onReset,
}) {
  return (
    <>
      <View className="flex-row items-center flex-wrap gap-1.5 mb-2">
        <Text className="font-mono text-[10px] tracking-[2px] uppercase text-muted flex-1">Calendar</Text>
        {status ? <Text className="font-mono text-[10px] text-muted self-center">{status}</Text> : null}
        <Pressable onPress={onReset} className="border px-2.5 py-1.5 rounded-[7px] border-red bg-reddim"><Text className="font-mono text-[10px] text-red">Reset</Text></Pressable>
      </View>

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
                <View key={`blank-${di}`} className={`${CELL_BASE} border-transparent bg-panel2 opacity-60`}>
                  <Text className="font-mono-bold text-[12px] text-muted2">✕</Text>
                </View>
              );
              const lk       = lockedStatus(d.date);
              const isToday  = d.date === today;
              const isFuture = d.date > today;
              const mix      = !lk ? dayMix(state, d.date, d.dow) : 'full';
              const tc       = cellClass(d) || mixClass(mix);
              return (
                <Pressable
                  key={d.date}
                  onPress={() => { if (lk) return; onSelectDay(d.date); }}
                  onLongPress={() => { if (lk) return; onLongPressDay(d.date, d.dow); }}
                  delayLongPress={600}
                  className={`${CELL_BASE} ${tc.bg} ${isFuture?'opacity-60':'opacity-100'} ${isToday?'border-ink':'border-transparent'}`}
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
    </>
  );
}
