import React from 'react';
import { View, Text } from 'react-native';

export default function Gauge({ pct, tone, held, presentCount, threshold, statusLine }) {
  return (
    <View className="bg-panel border border-border rounded-xl p-3.5 mb-3">
      <View className="flex-row items-center justify-between gap-1.5">
        <Text className={`font-sans text-4xl font-extrabold leading-[42px] ${tone.text}`}>
          {pct.toFixed(1)}<Text className="font-sans text-sm font-normal text-muted">%</Text>
        </Text>
        <Text className="font-mono text-[10px] text-muted">target {threshold + 7}% · floor {threshold}%</Text>
      </View>
      <View className="h-2.5 rounded-md overflow-hidden bg-track my-2">
        <View className={`h-full rounded-md ${tone.bg}`} style={{ width:`${Math.min(100,pct)}%` }} />
      </View>
      <View className="flex-row items-center gap-1.5">
        {[['HELD',held],['PRESENT',presentCount],['ABSENT',held-presentCount]].map(([l,v])=>(
          <Text key={l} className="font-mono text-[10px] text-muted2">{l} <Text className="text-ink">{v}</Text></Text>
        ))}
      </View>
      <View className="border-t border-border mt-2">
        <Text className="font-mono text-[10px] text-muted mt-2">{statusLine}</Text>
      </View>
    </View>
  );
}
