import axios from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://161.35.89.78:3000',
  withCredentials: true
});

let inMemoryToken: string | null = null;

// Helper function to safely access localStorage
const getStorageItem = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

const setStorageItem = (key: string, value: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

const removeStorageItem = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
};

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
  if (token) {
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Also store in localStorage for persistence
    setStorageItem('accessToken', token);
  } else {
    delete API.defaults.headers.common['Authorization'];
    removeStorageItem('accessToken');
  }
}

// Get token from localStorage on initialization
export function initializeToken() {
  const token = getStorageItem('accessToken');
  if (token) {
    setAccessToken(token);
  }
}

// Initialize token when module loads (only in browser)
if (typeof window !== 'undefined') {
  initializeToken();
}

// Request interceptor to ensure token is always set
API.interceptors.request.use(
  (config) => {
    // If we have a token in memory, ensure it's set in headers
    if (inMemoryToken) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling 401 errors
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If it's a 401 error, clear token and redirect to login
    if (error.response?.status === 401) {
      setAccessToken(null);
      
      // If we're in a browser environment, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth functions
export const register = async (username: string, email: string, password: string) => {
  const response = await API.post('/api/auth/register', { username, email, password });
  return response.data;
};

export const login = async (email: string, password: string) => {
  const response = await API.post('/api/auth/login', { email, password });
  return response.data;
};

// Title functions
export const getTitles = async () => {
  const response = await API.get('/api/titles');
  return response.data.titles || response.data || [];
};

export const createTitle = async (title: string, instructions: string) => {
  const response = await API.post('/api/titles', { title, instructions });
  console.log(response.data);
  return response.data;
};

export const getTitle = async (id: string | number) => {
  const response = await API.get(`/api/titles/${id}`);
  return response.data;
};

// Reference functions
export const getReferences = async (titleId: string | number) => {
  const response = await API.get(`/api/references/${titleId}`);
  return response.data.references || response.data || [];
};

export const uploadReference = async (titleId: string | number, imageData: string, isGlobal: boolean) => {
  const response = await API.post('/api/references', { titleId, imageData, isGlobal });
  return response.data;
};

// Painting functions
export const generatePaintings = async (titleId: string | number | null, quantity: number) => {
  const response = await API.post('/api/paintings/generate', { titleId, quantity });
  return response.data;
};

export const getPaintings = async (titleId: string | number | null) => {
  if (!titleId) return [];
  const response = await API.get(`/api/paintings/${titleId}`);
  // The response has { paintings: [...], referenceDataMap: {} }
  // We need to return just the paintings array and construct full image URLs
  const paintings = response.data.paintings || [];
  return paintings.map((painting: any) => ({
    ...painting,
    image_url: painting.image_url ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/${painting.image_url}` : null
  }));
};

export const retryPainting = async (paintingId: string | number) => {
  const response = await API.post(`/api/paintings/${paintingId}/retry`);
  return response.data;
};

export const regeneratePrompt = async (paintingId: string | number) => {
  const response = await API.post(`/api/paintings/${paintingId}/regenerate-prompt`);
  return response.data;
};

export default API;
