import React from 'react';
import { View, Text } from 'react-native';
import { pillClass } from '../lib/attendance';

export default function CourseLedger({ courses, clabel, stats }) {
  return (
    <>
      <Text className="font-mono text-[10px] tracking-[2px] uppercase mb-2 text-muted">Course Ledger</Text>
      <View className="bg-panel border border-border rounded-xl p-0 mb-[18px] overflow-hidden">
        <View className="flex-row items-center bg-panel2 border-b border-border">
          {['Course','Held','Present','%'].map((h,i)=>(
            <Text key={h} className={`font-mono text-[10px] text-muted2 p-2 ${i===0?'flex-[2]':'flex-1'}`}>{h.toUpperCase()}</Text>
          ))}
        </View>
        {courses.map((c,i) => {
          const h=stats.h[c], a=stats.a[c], p=h?a/h*100:100;
          const { bg, c:col } = pillClass(p);
          return (
            <View key={c} className={`flex-row items-center ${i<courses.length-1?'border-b border-border':''}`}>
              <Text className="flex-[2] p-2 text-xs font-semibold text-ink font-sans">{clabel[c]}</Text>
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
    </>
  );
}
