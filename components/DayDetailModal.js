import React from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { DAYNAME, MONTHS } from '../lib/constants';
import { present } from '../lib/attendance';

export default function DayDetailModal({
  visible, onClose, selDay, selLocked, selSlots, state, onToggleSlot, onMarkAll,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
                    <Pressable onPress={()=>onMarkAll(true)} className="border px-2.5 py-1.5 rounded-[7px] border-cyan bg-cyandim">
                      <Text className="font-mono text-[10px] text-cyan">All Present</Text>
                    </Pressable>
                    <Pressable onPress={()=>onMarkAll(false)} className="border px-2.5 py-1.5 rounded-[7px] border-red bg-reddim">
                      <Text className="font-mono text-[10px] text-red">All Absent</Text>
                    </Pressable>
                  </>}
                  <Pressable onPress={onClose} className="border px-2.5 py-1.5 rounded-[7px] border-border">
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
                      <Pressable key={sl.key} onPress={()=>onToggleSlot(sl.key)}
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
  );
}
