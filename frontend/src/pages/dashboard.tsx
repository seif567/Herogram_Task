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
  // Store placeholder cards in localStorage for persistence across page reloads
  const [persistentPlaceholders, setPersistentPlaceholders] = useState<any[]>([]);
  // Track the original expected count when generation starts
  const [originalExpectedCount, setOriginalExpectedCount] = useState<number>(0);

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

      // Load persistent placeholders from localStorage first
      const storedPlaceholders = loadPlaceholdersFromStorage();
      
      // If we have stored placeholders, show them immediately
      if (storedPlaceholders.length > 0) {
        setPaintings(storedPlaceholders);
        console.log(`Restored ${storedPlaceholders.length} placeholder cards from localStorage`);
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
        // Replace placeholders with real data INSTANTLY using the same logic as polling (no visual gap)
        setPaintings(prev => {
          const placeholderPaintings = prev.filter((p: any) => p.id.toString().startsWith('placeholder-'));
          
          // Use the original expected count from when generation started
          const totalExpectedCards = originalExpectedCount;
          
          if (placeholderPaintings.length > 0 && res.length > 0) {
            // Sort placeholders by timestamp (oldest first)
            const sortedPlaceholders = placeholderPaintings.sort((a, b) => {
              const aTimestamp = parseInt(a.id.toString().split('-')[1]);
              const bTimestamp = parseInt(b.id.toString().split('-')[1]);
              return aTimestamp - bTimestamp;
            });
            
            // IMPORTANT: Only replace the exact number of placeholders that correspond to returned paintings
            // If API returns 1 painting, only replace 1 placeholder, keep the rest
            const placeholdersToReplace = Math.min(res.length, sortedPlaceholders.length);
            
            // Safety check: ensure we don't replace more placeholders than we have
            if (placeholdersToReplace > sortedPlaceholders.length) {
              console.warn(`fetchPaintingsOnce: Warning: API returned ${res.length} paintings but only ${sortedPlaceholders.length} placeholders exist. Adjusting replacement count.`);
            }
            
            const placeholdersToKeep = sortedPlaceholders.slice(placeholdersToReplace);
            
            // Create the final array: real paintings + remaining placeholders
            const result = [...res, ...placeholdersToKeep];
            
            console.log(`fetchPaintingsOnce: API returned ${res.length} paintings. Replacing ${placeholdersToReplace} placeholders, keeping ${placeholdersToKeep.length} placeholders. Total cards: ${result.length} (expected: ${totalExpectedCards})`);
            
            // Save remaining placeholders to localStorage
            if (placeholdersToKeep.length > 0) {
              savePlaceholdersToStorage(placeholdersToKeep);
              console.log(`fetchPaintingsOnce: Saved ${placeholdersToKeep.length} remaining placeholders to localStorage`);
            } else {
              // If no placeholders left, clear from localStorage
              clearPlaceholdersFromStorage();
              console.log('fetchPaintingsOnce: No placeholders remaining, cleared from localStorage');
            }
            
            return result;
          }
          
          // If we have real paintings but no placeholders, just return the real paintings
          // No need to add maintenance placeholders - let the user generate more if they want
          if (res.length > 0 && placeholderPaintings.length === 0) {
            return res;
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
            // Update paintings by INSTANTLY replacing placeholders with real data (no visual gap)
            setPaintings(prev => {
              const realPaintings = res;
              const placeholderPaintings = prev.filter((p: any) => p.id.toString().startsWith('placeholder-'));
              
              // Use the original expected count from when generation started
              const totalExpectedCards = originalExpectedCount;
              
              // If we have real paintings and placeholders, replace only the appropriate number
              if (realPaintings.length > 0 && placeholderPaintings.length > 0) {
                // Sort placeholders by timestamp (oldest first)
                const sortedPlaceholders = placeholderPaintings.sort((a, b) => {
                  const aTimestamp = parseInt(a.id.toString().split('-')[1]);
                  const bTimestamp = parseInt(b.id.toString().split('-')[1]);
                  return aTimestamp - bTimestamp;
                });
                
                // IMPORTANT: Only replace the exact number of placeholders that correspond to returned paintings
                // If API returns 1 painting, only replace 1 placeholder, keep the rest
                const placeholdersToReplace = Math.min(realPaintings.length, sortedPlaceholders.length);
                
                // Safety check: ensure we don't replace more placeholders than we have
                if (placeholdersToReplace > sortedPlaceholders.length) {
                  console.warn(`Warning: API returned ${realPaintings.length} paintings but only ${sortedPlaceholders.length} placeholders exist. Adjusting replacement count.`);
                }
                
                const placeholdersToKeep = sortedPlaceholders.slice(placeholdersToReplace);
                
                // Create the final array: real paintings + remaining placeholders
                const result = [...realPaintings, ...placeholdersToKeep];
                
                console.log(`API returned ${realPaintings.length} paintings. Replacing ${placeholdersToReplace} placeholders, keeping ${placeholdersToKeep.length} placeholders. Total cards: ${result.length} (expected: ${totalExpectedCards})`);
                
                // Save remaining placeholders to localStorage
                if (placeholdersToKeep.length > 0) {
                  savePlaceholdersToStorage(placeholdersToKeep);
                  console.log(`Saved ${placeholdersToKeep.length} remaining placeholders to localStorage`);
                } else {
                  // If no placeholders left, clear from localStorage
                  clearPlaceholdersFromStorage();
                  console.log('No placeholders remaining, cleared from localStorage');
                }
                
                return result;
              }
              
              // If we have real paintings but no placeholders, just return the real paintings
              // No need to add maintenance placeholders - let the user generate more if they want
              if (realPaintings.length > 0 && placeholderPaintings.length === 0) {
                return realPaintings;
              }
              
              // If no real paintings, keep existing placeholders
              return prev;
            });
            
            // Check if all real paintings are completed (ignore placeholders)
            const realPaintings = res.filter((p: any) => !p.id.toString().startsWith('placeholder-'));
            if (realPaintings.length > 0 && realPaintings.every((painting: any) => painting.status === 'completed' || painting.status === 'failed')) {
              // Clear placeholders from localStorage since all paintings are complete
              clearPlaceholdersFromStorage();
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
    setOriginalExpectedCount(0); // Reset expected count for new title
    
    // Stop any existing polling
    stopPolling();
  }

  // select a title from sidebar
  async function handleSelectTitle(id: string | number) {
    setActiveTitleId(id);
    setOriginalExpectedCount(0); // Reset expected count when switching titles
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
      
      // Save all placeholders to localStorage for persistence
      const allPlaceholders = newPaintings.filter((p: any) => p.id.toString().startsWith('placeholder-'));
      savePlaceholdersToStorage(allPlaceholders);
      
      return newPaintings;
    });
    
    // Set the original expected count for this generation batch
    setOriginalExpectedCount(prev => prev + numImages);
    
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

  // Save placeholders to localStorage
  const savePlaceholdersToStorage = (placeholders: any[]) => {
    if (typeof window !== 'undefined' && activeTitleId) {
      const key = `placeholders_${activeTitleId}`;
      localStorage.setItem(key, JSON.stringify(placeholders));
    }
  };

  // Load placeholders from localStorage
  const loadPlaceholdersFromStorage = () => {
    if (typeof window !== 'undefined' && activeTitleId) {
      const key = `placeholders_${activeTitleId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPersistentPlaceholders(parsed);
          console.log(`Loaded ${parsed.length} persistent placeholders for title ${activeTitleId}`);
          return parsed;
        } catch (err) {
          console.error('Error parsing stored placeholders:', err);
        }
      }
    }
    return [];
  };

  // Clear placeholders from localStorage when all paintings are complete
  const clearPlaceholdersFromStorage = () => {
    if (typeof window !== 'undefined' && activeTitleId) {
      const key = `placeholders_${activeTitleId}`;
      localStorage.removeItem(key);
      setPersistentPlaceholders([]);
      // Reset the expected count since all placeholders are cleared
      setOriginalExpectedCount(0);
    }
  };

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
          <section className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Reference Images
                </h3>
                <label className="flex items-center gap-3 text-sm cursor-pointer group">
                <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-in-out focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                  <input
                    type="checkbox"
                    checked={useGlobalRefs}
                    onChange={(e) => setUseGlobalRefs(e.target.checked)}
                    className="sr-only"
                  />
                  {/* Track */}
                  <span className={`inline-block h-6 w-11 rounded-full transition-all duration-300 ease-in-out ${
                    useGlobalRefs 
                      ? 'bg-blue-600 shadow-lg shadow-blue-200' 
                      : 'bg-gray-200 border border-gray-300'
                  }`} />
                  {/* Knob */}
                  <span className={`absolute inline-block h-5 w-5 transform rounded-full transition-all duration-300 ease-in-out ${
                    useGlobalRefs 
                      ? 'translate-x-6 bg-white shadow-md' 
                      : 'translate-x-0.5 bg-white shadow-sm border border-gray-200'
                  }`} />
                  {/* Inner circle indicator */}
                  <span className={`absolute inline-block h-2 w-2 transform rounded-full transition-all duration-300 ease-in-out ${
                    useGlobalRefs 
                      ? 'translate-x-6 bg-blue-600' 
                      : 'translate-x-1 bg-gray-400'
                  }`} />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors duration-200">
                  Use global references
                </span>
              </label>
              </div>
            </div>

            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 font-medium mb-2">Upload Reference Images</p>
                <p className="text-xs text-gray-500 text-center mb-4">Drop images here or click to browse</p>
                <div className="relative">
                  <input 
                    ref={fileRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={handleUploadRef}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button 
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow-md"
                  >
                    Choose Files
                  </button>
                </div>
              </div>

              <div className="mt-6">
                {refsList.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-400">No reference images uploaded yet</p>
                    <p className="text-xs text-gray-300 mt-1">Upload images to use as style references</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Reference Images ({refsList.length})</span>
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {refsList.map((r: any) => (
                        <div key={r.id} className="relative group">
                          <img 
                            src={r.image_data} 
                            alt="Reference" 
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 group-hover:border-blue-300 transition-colors duration-200" 
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-blue-800">
                          <p className="font-medium">Reference images will be used</p>
                          <p className="text-xs text-blue-600 mt-1">
                            These {refsList.length} image(s) will influence the style and composition of your generated paintings
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
