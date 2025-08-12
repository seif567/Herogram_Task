import React from 'react';

interface PaintGridProps {
  children: React.ReactNode;
}

export default function PaintGrid({ children }: PaintGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 auto-rows-fr">
      {children}
    </div>
  );
}
