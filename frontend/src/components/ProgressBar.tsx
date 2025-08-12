import React from 'react';
import clsx from 'clsx';

export type Status = 'prompting' | 'generating' | 'done' | 'failed' | 'queued' | 'cancelled';

export default function ProgressBar({ status }: { status: Status }) {
  const getProps = () => {
    switch (status) {
      case 'prompting':   return { pct: '30%', color: 'bg-yellow-400' };
      case 'generating':  return { pct: '70%', color: 'bg-blue-500' };
      case 'done':        return { pct: '100%', color: 'bg-green-500' };
      case 'failed':      return { pct: '100%', color: 'bg-red-500' };
      case 'queued':      return { pct: '10%', color: 'bg-gray-400' };
      case 'cancelled':   return { pct: '100%', color: 'bg-gray-500' };
      default:            return { pct: '0%', color: 'bg-gray-300' };
    }
  };

  const { pct, color } = getProps();
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className={clsx('h-2 transition-all duration-500', color)}
        style={{ width: pct }}
        data-status={status}
      />
    </div>
  );
}
