import React from 'react';
import ProgressBar from './ProgressBar';

export type Painting = {
  id: string | number;
  prompt: string;
  status: string;
  imageUrl?: string | null;
  error?: string | null;
  summary?: string;
  promptDetails?: any;
};

interface PaintingCardProps {
  painting: Painting;
  onRetry?: (id: string | number) => void;
  onRegeneratePrompt?: (id: string | number) => void;
  onDownload?: (url?: string | null) => void;
  onClick?: () => void;
}

export default function PaintingCard({ 
  painting, 
  onRetry, 
  onRegeneratePrompt, 
  onDownload, 
  onClick 
}: PaintingCardProps) {
  const isCompleted = painting.status === 'completed';
  const isFailed = painting.status === 'failed';
  const isSafetyViolation = painting.status === 'safety_violation';
  const isPending = painting.status === 'pending';
  const isGenerating = painting.status === 'generating_image';
  
  // Map backend status to frontend status
  const mapStatus = (status: string): string => {
    switch (status) {
      case 'completed': return 'done';
      case 'failed': return 'failed';
      case 'safety_violation': return 'failed';
      case 'pending': return 'creating_prompt';
      case 'generating_image': return 'creating_image';
      default: return status;
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isFailed || isSafetyViolation) return; // Don't open modal for failed paintings
    onClick?.();
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer ${
        isFailed || isSafetyViolation ? 'cursor-default opacity-75' : 'hover:scale-[1.02]'
      }`}
      onClick={handleCardClick}
    >
      {/* Image Container */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {painting.imageUrl ? (
          <img 
            src={painting.imageUrl || ''} 
            alt={painting.prompt || 'Generated painting'} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">
                {isPending ? 'Generating prompt...' : 'Processing...'}
              </p>
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        {isCompleted && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            ✓ Complete
          </div>
        )}
        
        {isFailed && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            ✗ Failed
          </div>
        )}
        
        {isSafetyViolation && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            ⚠ Safety
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Prompt Summary */}
        <div className="mb-3">
          <p className="text-sm text-gray-800 font-medium line-clamp-2 leading-tight">
            {painting.summary || painting.prompt || 'Generating...'}
          </p>
        </div>

        {/* Progress Bar - Only show when not completed */}
        {!isCompleted && (
          <div className="mb-3">
            <ProgressBar status={mapStatus(painting.status) as any} />
          </div>
        )}

        {/* Status Text - Only show when not completed */}
        {!isCompleted && (
          <p className="text-xs text-gray-500 mb-3">
            {isPending && 'Creating prompt...'}
            {isGenerating && 'Generating image...'}
            {isFailed && 'Generation failed'}
            {isSafetyViolation && 'Safety violation detected'}
          </p>
        )}

        {/* Error Message */}
        {isFailed && painting.error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {painting.error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isCompleted && (
            <button
              onClick={(e) => handleButtonClick(e, () => onDownload?.(painting.imageUrl))}
              className="flex-1 bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              Download
            </button>
          )}
          
          {isFailed && !isSafetyViolation && onRetry && (
            <button
              onClick={(e) => handleButtonClick(e, () => onRetry(painting.id))}
              className="flex-1 bg-gray-600 text-white text-xs px-3 py-2 rounded hover:bg-gray-700 transition-colors duration-200 font-medium"
            >
              Regenerate
            </button>
          )}
          
          {isSafetyViolation && onRegeneratePrompt && (
            <button
              onClick={(e) => handleButtonClick(e, () => onRegeneratePrompt(painting.id))}
              className="flex-1 bg-orange-600 text-white text-xs px-3 py-2 rounded hover:bg-orange-700 transition-colors duration-200 font-medium"
            >
              Regenerate Prompt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
