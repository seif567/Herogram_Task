import React, { useEffect, useMemo, useState, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import PaintingCard from '../components/PaintingCard';
import PaintGrid from '../components/PaintGrid';
import PaintingDetailsModal from '../components/PaintingDetailsModal';
import {
  getTitles,
  createTitle,
  getReferences,
  uploadReference,
  generatePaintings,
  getPaintings,
  retryPainting,
  regeneratePrompt,
  getTitle
} from '../services/api'; // adjust path if necessary
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

type Title = { id: string | number; title: string; instructions?: string; };

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Button press effect state
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  // Track placeholder cards by generation batch
  const [placeholderBatches, setPlaceholderBatches] = useState<Array<{count: number, timestamp: number}>>([]);

  // left sidebar state
  const [titles, setTitles] = useState<Title[]>([]);
  const [activeTitleId, setActiveTitleId] = useState<string | number | null>(null);

  // reference images
  const [useGlobalRefs, setUseGlobalRefs] = useState<boolean>(false);
  const [refs, setRefs] = useState<any[]>([]); // array of {id, image_data}
  const fileRef = useRef<HTMLInputElement | null>(null);

  // form state
  const [titleInput, setTitleInput] = useState('');
  const [instructions, setInstructions] = useState('');
  const [numImages, setNumImages] = useState<number>(5);

  // generated paintings state
  const [paintings, setPaintings] = useState<any[]>([]);
  const pollingRef = useRef<number | null>(null); // for setInterval id
  
  // modal state
  const [selectedPainting, setSelectedPainting] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // SSE toggle - set to true if your backend supports event streams
  const USE_SSE = false;

  // --- load titles ---
  useEffect(() => {
    (async () => {
      try {
        const res = await getTitles();
        setTitles(res || []);
        if ((res || []).length) {
          // Try to restore the last active title from localStorage
          const lastActiveTitleId = localStorage.getItem('lastActiveTitleId');
          let titleToSelect = null;
          
          if (lastActiveTitleId && res.find((t: any) => t.id.toString() === lastActiveTitleId)) {
            // Restore the last active title
            titleToSelect = parseInt(lastActiveTitleId);
          } else {
            // Fallback to the most recent title
            titleToSelect = res[0].id;
          }
          
          // Set the active title ID - this will trigger the useEffect that loads title details
          setActiveTitleId(titleToSelect);
        }
      } catch (err) {
        console.error('getTitles error', err);
      }
    })();
  }, []);

  // when active title changes, fetch refs and paintings
  useEffect(() => {
    if (!activeTitleId) return;
    
    // Save the active title ID to localStorage for persistence
    localStorage.setItem('lastActiveTitleId', activeTitleId.toString());
    
    (async () => {
      try {
        // Load title details (title and instructions) into form fields
        const titleDetails = await getTitle(activeTitleId);
        if (titleDetails) {
          setTitleInput(titleDetails.title || '');
          setInstructions(titleDetails.instructions || '');
        }
        
        const refsRes = await getReferences(activeTitleId);
        console.log('References fetched:', refsRes);
        setRefs(refsRes || []);
      } catch (err) {
        console.warn('Error loading title details or refs:', err);
        setRefs([]);
      }

      await fetchPaintingsOnce(activeTitleId);
      startPolling(activeTitleId);

    })();

    return () => stopPolling();
  }, [activeTitleId]);

  // fetch paintings once
  async function fetchPaintingsOnce(titleId: string | number | null) {
    if (!titleId) return;
    try {
      const res = await getPaintings(titleId);
      if (res && res.length > 0) {
        // Replace placeholders with real data using the same logic as polling
        setPaintings(prev => {
          const placeholderPaintings = prev.filter((p: any) => p.id.toString().startsWith('placeholder-'));
          
          // Calculate the total expected cards (original placeholders)
          const totalExpectedCards = prev.length;
          
          if (placeholderPaintings.length > 0 && res.length > 0) {
            // Sort placeholders by timestamp (oldest first)
            const sortedPlaceholders = placeholderPaintings.sort((a, b) => {
              const aTimestamp = parseInt(a.id.toString().split('-')[1]);
              const bTimestamp = parseInt(b.id.toString().split('-')[1]);
              return aTimestamp - bTimestamp;
            });
            
            // Calculate how many placeholders to replace
            const placeholdersToReplace = Math.min(res.length, sortedPlaceholders.length);
            const placeholdersToKeep = sortedPlaceholders.slice(placeholdersToReplace);
            
            // Ensure we maintain the total count
            const result = [...res, ...placeholdersToKeep];
            console.log(`fetchPaintingsOnce: Replacing ${placeholdersToReplace} placeholders, keeping ${placeholdersToKeep.length} placeholders. Total cards: ${result.length} (expected: ${totalExpectedCards})`);
            
            return result;
          }
          
          // If we have real paintings but no placeholders, we need to add placeholders to maintain count
          if (res.length > 0 && placeholderPaintings.length === 0) {
            const placeholdersNeeded = Math.max(0, totalExpectedCards - res.length);
            const additionalPlaceholders = Array.from({ length: placeholdersNeeded }, (_, index) => ({
              id: `placeholder-maintained-${Date.now()}-${index}`,
              status: 'pending',
              summary: 'Waiting for generation...',
              image_url: null,
              error_message: null,
              promptDetails: {
                summary: 'Waiting for generation...',
                title: 'Maintaining count',
                instructions: 'Placeholder to maintain total count',
                referenceCount: 0,
                referenceImages: [],
                fullPrompt: ''
              }
            }));
            
            const result = [...res, ...additionalPlaceholders];
            console.log(`fetchPaintingsOnce: Added ${placeholdersNeeded} maintenance placeholders. Total cards: ${result.length} (expected: ${totalExpectedCards})`);
            return result;
          }
          
          // If no real paintings, keep existing placeholders
          return prev;
        });
      } else {
        // Don't clear paintings if we have placeholders - they might still be processing
        setPaintings(prev => {
          const hasPlaceholders = prev.some((p: any) => p.id.toString().startsWith('placeholder-'));
          if (hasPlaceholders) {
            console.log('API returned no paintings, but keeping placeholders');
            return prev;
          }
          return res || [];
        });
      }
    } catch (err) {
      console.error('getPaintings error', err);
    }
  }

  // polling
  function startPolling(titleId: string | number | null) {
    if (!titleId) return;
    stopPolling();
    if (USE_SSE) {
      // SSE logic — leave as optional; change endpoint if your backend supports it
      const ev = new EventSource(`${window.location.origin}/api/paintings/stream?titleId=${titleId}`);
      ev.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          // expected payload { paintingId, status, imageUrl, prompt, ... }
          setPaintings((prev) => {
            const idx = prev.findIndex((p) => p.id === parsed.id);
            if (idx === -1) return prev;
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...parsed };
            return copy;
          });
        } catch (err) {
          console.warn('SSE parse', err);
        }
      };
      // save eventsource on ref? Not necessary here
    } else {
      const id = window.setInterval(async () => {
        try {
          const res = await getPaintings(titleId);
          
          if (res && res.length > 0) {
            // Update paintings by replacing placeholders with real data
            setPaintings(prev => {
              const realPaintings = res;
              const placeholderPaintings = prev.filter((p: any) => p.id.toString().startsWith('placeholder-'));
              
              // Calculate the total expected cards (original placeholders)
              const totalExpectedCards = prev.length;
              
              // If we have real paintings and placeholders, replace only the appropriate number
              if (realPaintings.length > 0 && placeholderPaintings.length > 0) {
                // Sort placeholders by timestamp (oldest first)
                const sortedPlaceholders = placeholderPaintings.sort((a, b) => {
                  const aTimestamp = parseInt(a.id.toString().split('-')[1]);
                  const bTimestamp = parseInt(b.id.toString().split('-')[1]);
                  return aTimestamp - bTimestamp;
                });
                
                // Calculate how many placeholders to replace
                // We want to maintain the total count, so replace up to the number of real paintings
                const placeholdersToReplace = Math.min(realPaintings.length, sortedPlaceholders.length);
                const placeholdersToKeep = sortedPlaceholders.slice(placeholdersToReplace);
                
                // Ensure we maintain the total count
                const result = [...realPaintings, ...placeholdersToKeep];
                console.log(`Replacing ${placeholdersToReplace} placeholders, keeping ${placeholdersToKeep.length} placeholders. Total cards: ${result.length} (expected: ${totalExpectedCards})`);
                
                return result;
              }
              
              // If we have real paintings but no placeholders, we need to add placeholders to maintain count
              if (realPaintings.length > 0 && placeholderPaintings.length === 0) {
                const placeholdersNeeded = Math.max(0, totalExpectedCards - realPaintings.length);
                const additionalPlaceholders = Array.from({ length: placeholdersNeeded }, (_, index) => ({
                  id: `placeholder-maintained-${Date.now()}-${index}`,
                  status: 'pending',
                  summary: 'Waiting for generation...',
                  image_url: null,
                  error_message: null,
                  promptDetails: {
                    summary: 'Waiting for generation...',
                    title: 'Maintaining count',
                    instructions: 'Placeholder to maintain total count',
                    referenceCount: 0,
                    referenceImages: [],
                    fullPrompt: ''
                  }
                }));
                
                const result = [...realPaintings, ...additionalPlaceholders];
                console.log(`Added ${placeholdersNeeded} maintenance placeholders. Total cards: ${result.length} (expected: ${totalExpectedCards})`);
                return result;
              }
              
              // If no real paintings, keep existing placeholders
              return prev;
            });
            
            // Check if all real paintings are completed (ignore placeholders)
            const realPaintings = res.filter((p: any) => !p.id.toString().startsWith('placeholder-'));
            if (realPaintings.length > 0 && realPaintings.every((painting: any) => painting.status === 'completed' || painting.status === 'failed')) {
              window.clearInterval(id);
              pollingRef.current = null;
              return;
            }
          } else {
            // If no real paintings returned, check if we have placeholders to preserve
            setPaintings(prev => {
              const hasPlaceholders = prev.some((p: any) => p.id.toString().startsWith('placeholder-'));
              if (hasPlaceholders) {
                console.log('Polling: No real paintings yet, keeping placeholders');
                return prev;
              }
              return res || [];
            });
          }
        } catch (err) {
          console.warn('poll error', err);
        }
      }, 2000);
      pollingRef.current = id;
    }
  }

  function stopPolling() {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  // create a new title tab (local only, not saved to database yet)
  function handleNewTitle() {
    // Clear current inputs and create a new local tab
    setTitleInput('');
    setInstructions('');
    setActiveTitleId(null);
    setPaintings([]);
    setRefs([]);
    
    // Stop any existing polling
    stopPolling();
  }

  // select a title from sidebar
  async function handleSelectTitle(id: string | number) {
    setActiveTitleId(id);
    // optionally load specific title details
    try {
      const t = await getTitle(id);
      setTitleInput(t?.title || '');
      setInstructions(t?.instructions || '');
    } catch (_) {}
  }

  // upload reference image (simple base64 or file)
  async function handleUploadRef(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !activeTitleId) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const uploadResult = await uploadReference(activeTitleId, base64, useGlobalRefs);
        console.log('Upload result:', uploadResult);
        // refresh references
        const r = await getReferences(activeTitleId);
        console.log('References after upload:', r);
        setRefs(r || []);
      } catch (err) {
        console.error('uploadReference failed', err);
      }
    };
    reader.readAsDataURL(f);
    // reset input
    if (fileRef.current) fileRef.current.value = '';
  }

  // generate paintings
  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    
    // Validate title
    if (!titleInput || titleInput.trim() === '' || titleInput.trim().toLowerCase() === 'untitled') {
      alert('Please enter a valid title (not "Untitled")');
      return;
    }
    
    // Add button press effect
    setIsButtonPressed(true);
    setTimeout(() => setIsButtonPressed(false), 200); // Reset after 200ms
    
    // Create placeholder cards and add them to existing paintings
    const batchTimestamp = Date.now();
    const placeholderPaintings = Array.from({ length: numImages }, (_, index) => ({
      id: `placeholder-${batchTimestamp}-${index}`,
      status: 'pending',
      summary: 'Generating prompt...',
      image_url: null,
      error_message: null,
      promptDetails: {
        summary: 'Generating prompt...',
        title: titleInput.trim(),
        instructions: instructions || 'No custom instructions provided',
        referenceCount: refs.length,
        referenceImages: [],
        fullPrompt: ''
      }
    }));
    
    // Add new placeholder cards to existing paintings instead of replacing them
    setPaintings(prev => {
      const newPaintings = [...prev, ...placeholderPaintings];
      console.log(`Added ${numImages} placeholder cards. Total paintings now: ${newPaintings.length}`);
      return newPaintings;
    });
    
    // Track this batch of placeholders
    setPlaceholderBatches(prev => [...prev, { count: numImages, timestamp: batchTimestamp }]);
  
    try {
      let currentTitleId = activeTitleId;
      
      if (!currentTitleId) {
        const res = await createTitle(titleInput.trim(), instructions || '');
        currentTitleId = res?.id || null;
        setActiveTitleId(currentTitleId);
        
        // Refresh the titles list to show the new title in the sidebar
        try {
          const updatedTitles = await getTitles();
          setTitles(updatedTitles || []);
        } catch (err) {
          console.error('Failed to refresh titles list:', err);
        }
      }
            
      if (!currentTitleId) {
        throw new Error('Failed to get or create title ID');
      }
  
      console.log('Generating paintings with references:', refs);
      const res = await generatePaintings(currentTitleId, numImages);
      
      // Don't replace paintings here - let the polling handle it gradually
      startPolling(currentTitleId);
    } catch (err) {
      console.error('generatePaintings error', err);
      // If there's an error, remove placeholder cards
      setPaintings([]);
    }
  }
  

  // retry a painting
  async function handleRetry(id: string | number) {
    try {
      await retryPainting(id);
      // update UI: set painting status to queued/prompting
      setPaintings((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'queued' } : p)));
      startPolling(activeTitleId);
    } catch (err) {
      console.error('retry failed', err);
    }
  }

  // regenerate prompt for safety violations
  async function handleRegeneratePrompt(id: string | number) {
    try {
      await regeneratePrompt(id);
      // update UI: set painting status to pending
      setPaintings((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'pending' } : p)));
      startPolling(activeTitleId);
    } catch (err) {
      console.error('regenerate prompt failed', err);
    }
  }

  // modal handlers
  const handlePaintingClick = (painting: any) => {
    setSelectedPainting(painting);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPainting(null);
  };

  function handleDownload(url?: string | null) {
    if (!url) return;
    // open in new tab to trigger download or use fetch blob
    window.open(url, '_blank');
  }

  // logout
  const onLogout = async () => {
    await logout();
    router.push('/login');
  };

  // small helper to render refs as thumbnails
  const refsList = useMemo(() => refs || [], [refs]);

  return (
    <div className="flex">
      <Sidebar
        titles={titles}
        activeId={activeTitleId}
        onSelect={handleSelectTitle}
        onNew={handleNewTitle}
        onLogout={onLogout}
        userEmail={user?.email}
      />

      <main className="flex-1 p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">AI Image Generator</h2>

          {/* Reference Images */}
          <section className="mb-6 bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Reference Images</h3>
              <label className="flex items-center gap-2 text-sm">
                <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                  <input
                    type="checkbox"
                    checked={useGlobalRefs}
                    onChange={(e) => setUseGlobalRefs(e.target.checked)}
                    className="sr-only"
                  />
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useGlobalRefs ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                  <span className={`inline-block h-6 w-11 rounded-full transition-colors ${
                    useGlobalRefs ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Use global references</span>
              </label>
            </div>

            <div className="mt-3 border border-dashed border-gray-200 rounded p-6">
              <div className="flex flex-col items-center justify-center">
                <p className="text-sm text-gray-500">Drop reference images here or</p>
                <div className="mt-3">
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleUploadRef} />
                </div>
              </div>

              <div className="mt-4">
                {refsList.length === 0 ? (
                  <p className="text-sm text-gray-400">No reference images uploaded</p>
                ) : (
                  <div className="flex gap-2 overflow-auto mt-2">
                    {refsList.map((r: any) => (
                      <img key={r.id} src={r.image_data} alt="ref" className="w-28 h-20 object-cover rounded" />
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  {refsList.length > 0 ? `${refsList.length} reference image(s) will be used for generation` : ''}
                </div>
              </div>
            </div>
          </section>

          {/* Create Paintings Form */}
          <section className="mb-6 bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Create Paintings</h3>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Title</label>
                <input
                  className="w-full mt-1 px-3 py-2 border rounded"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="Enter title (eg. a girl crying)"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Custom Instructions</label>
                <textarea
                  className="w-full mt-1 px-3 py-2 border rounded min-h-[100px]"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Make all the images in style of Mona Lisa..."
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Number of Paintings</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numImages}
                  onChange={(e) => setNumImages(Number(e.target.value))}
                  className="w-32 mt-1 px-3 py-2 border rounded"
                />
              </div>

              <div>
                <button 
                  type="submit" 
                  className={`bg-blue-600 text-white px-4 py-2 rounded transition-all duration-200 ${
                    isButtonPressed ? 'scale-95 bg-blue-700 shadow-inner' : 'hover:bg-blue-700 hover:shadow-md'
                  }`}
                >
                  Generate Paintings
                </button>
              </div>
            </form>
          </section>

          {/* Generated Paintings */}
          <section className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-4">Generated Paintings</h3>

            <PaintGrid>
              {paintings.length === 0 ? (
                <div className="text-sm text-gray-500 col-span-full">No paintings yet</div>
              ) : (
                paintings.map((p: any) => (
                    <PaintingCard
                      key={p.id}
                      painting={{
                        id: p.id,
                        prompt: p.summary, // Backend returns 'summary' not 'prompt'
                        status: p.status,
                        imageUrl: p.image_url, // Backend returns 'image_url' not 'imageUrl'
                        error: p.error_message, // Backend returns 'error_message' not 'error'
                        summary: p.summary,
                        promptDetails: p.promptDetails
                      }}
                      onRetry={handleRetry}
                      onRegeneratePrompt={handleRegeneratePrompt}
                      onDownload={handleDownload}
                      onClick={() => handlePaintingClick(p)}
                    />
                  ))
              )}
            </PaintGrid>
            
            {/* Generate More Paintings Button */}
            {paintings.length > 0 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    // For "Generate More", we don't need to create new title
                    if (activeTitleId) {
                      // Add button press effect
                      setIsButtonPressed(true);
                      setTimeout(() => setIsButtonPressed(false), 200);
                      
                      // Create placeholder cards for additional paintings
                      const additionalPlaceholders = Array.from({ length: numImages }, (_, index) => ({
                        id: `placeholder-${Date.now()}-${index}`,
                        status: 'pending',
                        summary: 'Generating prompt...',
                        image_url: null,
                        error_message: null,
                        promptDetails: {
                          summary: 'Generating prompt...',
                          title: titleInput.trim() || 'Current Title',
                          instructions: instructions || 'No custom instructions provided',
                          referenceCount: refs.length,
                          referenceImages: [],
                          fullPrompt: ''
                        }
                      }));
                      
                      // Add new placeholders to existing paintings
                      setPaintings(prev => [...prev, ...additionalPlaceholders]);
                      
                      // Start the actual generation
                      generatePaintings(activeTitleId, numImages)
                        .then(() => {
                          // Start polling to get real data as it comes in
                          startPolling(activeTitleId);
                        })
                        .catch(err => {
                          console.error('generatePaintings error', err);
                          // Remove only the placeholder cards that were just added
                          setPaintings(prev => prev.filter((p: any) => !p.id.toString().startsWith('placeholder-')));
                        });
                    }
                  }}
                  className={`bg-blue-600 text-white px-6 py-3 rounded-lg transition-all duration-200 ${
                    isButtonPressed ? 'scale-95 bg-blue-700 shadow-inner' : 'hover:bg-blue-700 hover:shadow-md'
                  }`}
                >
                  Generate More Paintings
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
      
      {/* Painting Details Modal */}
      <PaintingDetailsModal
        painting={selectedPainting}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
