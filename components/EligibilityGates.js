import React from 'react';
import { View, Text } from 'react-native';

export default function EligibilityGates({ gates, threshold }) {
  return (
    <>
      <Text className="font-mono text-[10px] tracking-[2px] uppercase mb-2 text-muted">Exam Eligibility · need ≥{threshold}%</Text>
      <View className="flex-row items-center gap-2 mb-[18px]">
        {gates.map(({ label, cutoff, pct:p, known }) => {
          const eligible   = known && p != null && p >= threshold;
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
    </>
  );
}
