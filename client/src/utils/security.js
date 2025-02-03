// New file for security utilities
import DOMPurify from 'dompurify';

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input.trim(), {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [] // No attributes allowed
  });
};

export const validateUsername = (username) => {
  if (!username) return false;
  // Only allow alphanumeric characters and basic punctuation
  const usernameRegex = /^[a-zA-Z0-9_\-\.]{3,30}$/;
  return usernameRegex.test(username);
};

export const rateLimit = (() => {
  const messageTimestamps = new Map();
  const MAX_MESSAGES = 5;
  const TIME_WINDOW = 5000; // 5 seconds

  return (userId) => {
    const now = Date.now();
    const userTimestamps = messageTimestamps.get(userId) || [];
    
    // Remove old timestamps
    const recentTimestamps = userTimestamps.filter(ts => now - ts < TIME_WINDOW);
    
    if (recentTimestamps.length >= MAX_MESSAGES) {
      return false; // Rate limit exceeded
    }

    recentTimestamps.push(now);
    messageTimestamps.set(userId, recentTimestamps);
    return true;
  };
})(); 