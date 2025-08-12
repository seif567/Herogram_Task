import React from 'react';
import ProgressBar, { Status } from './ProgressBar';

type Painting = {
  id: string | number;
  prompt?: string;
  status: string; // Backend returns string status like 'completed', 'pending', 'safety_violation', etc.
  imageUrl?: string | null;
  error?: string | null;
  summary?: string;
  promptDetails?: {
    summary: string;
    title: string;
    instructions: string;
    referenceCount: number;
    referenceImages: any[];
    fullPrompt: string;
  };
};

export default function PaintingCard({
  painting,
  onRetry,
  onRegeneratePrompt,
  onDownload,
  onClick
}: {
  painting: Painting;
  onRetry?: (id: string | number) => void;
  onRegeneratePrompt?: (id: string | number) => void;
  onDownload?: (url?: string | null | undefined) => void;
  onClick?: () => void;
}) {
  // Map backend status to frontend status
  const mapStatus = (status: string): Status => {
    switch (status) {
      case 'pending': return 'prompting';
      case 'processing': return 'generating';
      case 'completed': return 'done';
      case 'failed': return 'failed';
      case 'safety_violation': return 'failed';
      default: return 'prompting';
    }
  };

  const frontendStatus = mapStatus(painting.status);
  const isCompleted = frontendStatus === 'done';
  const hasImage = painting.imageUrl && painting.imageUrl.trim() !== '';
  const isSafetyViolation = painting.status === 'safety_violation';

    return (
    <div 
      className={`bg-white rounded-lg shadow p-3 flex flex-col transition-shadow ${
        frontendStatus === 'failed' ? '' : 'cursor-pointer hover:shadow-lg'
      }`}
      onClick={frontendStatus === 'failed' ? undefined : onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold leading-tight">
            {painting.prompt ? 
              (painting.prompt.length > 100 ? 
                `${painting.prompt.substring(0, 100)}...` : 
                painting.prompt
              ) : 
              'Generating prompt...'
            }
          </h4>
          {/* Only show status when not completed */}
          {!isCompleted && (
            <p className="text-xs text-gray-500 mt-1 capitalize">{painting.status}</p>
          )}
        </div>
      </div>

      {/* Only show progress bar when not completed */}
      {!isCompleted && (
        <div className="mt-3">
          <ProgressBar status={frontendStatus} />
        </div>
      )}

      <div className="mt-3 flex-1">
        {isCompleted && hasImage ? (
          <img src={painting.imageUrl || ''} alt="painting" className="w-full h-40 object-cover rounded" />
        ) : frontendStatus === 'failed' ? (
          <div className="w-full h-40 rounded bg-red-50 border border-red-100 flex items-center justify-center text-red-600 text-sm">
            {isSafetyViolation ? 'Safety violation detected' : (painting.error || 'Generation failed')}
          </div>
        ) : (
          <div className="w-full h-40 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-sm text-gray-400">
            {frontendStatus === 'prompting' ? 'Creating prompt…' : 'Generating image…'}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          {isSafetyViolation && onRegeneratePrompt && (
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click when regenerating prompt
                onRegeneratePrompt(painting.id);
              }} 
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Regenerate Prompt
            </button>
          )}
          {frontendStatus === 'failed' && !isSafetyViolation && onRetry && (
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click when regenerating
                onRetry(painting.id);
              }} 
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Regenerate
            </button>
          )}
        </div>
        <div>
          {isCompleted && hasImage && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click when downloading
                onDownload && onDownload(painting.imageUrl || undefined);
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
