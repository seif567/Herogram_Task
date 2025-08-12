import React from 'react';

type Painting = {
  id: string | number;
  prompt?: string;
  status: string;
  image_url?: string | null;
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

interface PaintingDetailsModalProps {
  painting: Painting | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PaintingDetailsModal({ painting, isOpen, onClose }: PaintingDetailsModalProps) {
  if (!isOpen || !painting) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Painting Prompt Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Section - Image */}
          <div className="lg:w-1/2 p-6">
            {painting.image_url ? (
              <img
                src={painting.image_url}
                alt="Generated painting"
                className="w-full h-auto rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                No image available
              </div>
            )}
          </div>

          {/* Right Section - Details */}
          <div className="lg:w-1/2 p-6 overflow-y-auto">
            {/* Prompt Summary */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Prompt Summary</h3>
              <p className="text-gray-700 mb-4">
                {painting.promptDetails?.summary || painting.summary || painting.prompt || 'No summary available'}
              </p>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div><strong>Title:</strong> {painting.promptDetails?.title || 'Untitled'}</div>
                <div><strong>Custom Instructions:</strong> {painting.promptDetails?.instructions || 'No instructions'}</div>
                <div><strong>References:</strong> {painting.promptDetails?.referenceCount || 0} images used</div>
                <div className="text-xs text-gray-500">
                  {painting.promptDetails?.referenceCount === 0 ? 'No reference images used' : 'Reference images used'}
                </div>
              </div>
            </div>

            {/* Full Prompt */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Full Prompt</h3>
              <div className="bg-gray-50 p-4 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-gray-700 text-sm leading-relaxed">
                  {painting.promptDetails?.fullPrompt || 'No full prompt available'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
