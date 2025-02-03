// Determine the API URL based on the current environment
const getApiUrl = () => {
  const currentUrl = window.location.origin;
  
  // If we're on a dev tunnel
  if (currentUrl.includes('devtunnels.ms')) {
    return 'https://r4mb4ww9-3001.inc1.devtunnels.ms';
  }
  
  // Local development
  return 'http://localhost:3001';
};

// Socket.IO configuration
const getSocketConfig = () => ({
  withCredentials: false,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 60000
});

export const API_URL = getApiUrl();
export const SOCKET_CONFIG = getSocketConfig();
