// AI Service for Google Gemini API integration
// Using fetch API for compatibility

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Rate limiting: Track API calls to avoid exceeding limits
// Free tier: 15 requests/minute, 1500 requests/day (using conservative limits)
let apiCallTimes = [];
const MAX_CALLS_PER_MINUTE = 10; // Very conservative to avoid 503 errors
const MINUTE_IN_MS = 60000;

// Retry configuration
const MAX_RETRIES = 1; // Single retry to avoid cascading failures
const INITIAL_RETRY_DELAY = 3000; // 3 seconds between retries

// Cache for repeated requests (longer-lived for efficiency)
const requestCache = new Map();
const CACHE_DURATION = 120000; // 2 minutes cache
const CACHE_VERSION = 'v6'; // Increment to invalidate old cache

// Clear cache on module load to ensure fresh start
requestCache.clear();

/**
 * Check if we can make an API call based on rate limits
 */
const canMakeApiCall = () => {
  const now = Date.now();
  // Remove calls older than 1 minute
  apiCallTimes = apiCallTimes.filter(time => now - time < MINUTE_IN_MS);
  
  if (apiCallTimes.length >= MAX_CALLS_PER_MINUTE) {
    // eslint-disable-next-line no-console
    console.warn(`Rate limit: ${apiCallTimes.length}/${MAX_CALLS_PER_MINUTE} calls in last minute`);
    return false;
  }
  return true;
};

/**
 * Record an API call
 */
const recordApiCall = () => {
  apiCallTimes.push(Date.now());
};

/**
 * Get cached response if available
 */
const getCachedResponse = (cacheKey) => {
  const versionedKey = `${CACHE_VERSION}:${cacheKey}`;
  const cached = requestCache.get(versionedKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.response;
  }
  return null;
};

/**
 * Cache a response
 */
const cacheResponse = (cacheKey, response) => {
  const versionedKey = `${CACHE_VERSION}:${cacheKey}`;
  requestCache.set(versionedKey, {
    response,
    timestamp: Date.now()
  });
  
  // Clean old cache entries
  if (requestCache.size > 50) {
    const oldestKey = requestCache.keys().next().value;
    requestCache.delete(oldestKey);
  }
};

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Call Google Gemini API with retry logic and rate limiting
 * @param {string} prompt - The prompt to send to Gemini
 * @param {object} options - Configuration options
 * @returns {Promise<string>} - The generated text
 */
const callGeminiAPI = async (prompt, options = {}) => {
  const {
    model = 'gemini-2.5-flash', // Working model verified for v1beta API
    temperature = 0.7,
    maxTokens = 500, // Reduced for efficiency
  } = options;

  // Check cache first
  const cacheKey = `${model}:${temperature}:${prompt.substring(0, 100)}`;
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return cached;
  }

  // Rate limiting check with longer wait
  if (!canMakeApiCall()) {
    // eslint-disable-next-line no-console
    console.warn('Rate limit reached. Waiting 10 seconds...');
    await sleep(10000);
    
    // Check again after wait
    if (!canMakeApiCall()) {
      throw new Error('Rate limit exceeded. Please wait before trying again.');
    }
  }

  let lastError;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      recordApiCall();
      
      const response = await fetch(
        `${GEMINI_API_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `API error: ${response.status}`;
        
        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), 10000);
          // eslint-disable-next-line no-console
          console.warn(`Rate limited (429). Waiting ${retryDelay}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(retryDelay);
          continue;
        }
        
        // Handle quota exceeded
        if (response.status === 403 && errorMessage.includes('quota')) {
          // eslint-disable-next-line no-console
          console.error('API quota exceeded for today');
          throw new Error('AI features temporarily unavailable. Daily quota exceeded.');
        }
        
        // Handle other 4xx errors (don't retry)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(errorMessage);
        }
        
        // Handle 5xx errors (retry)
        if (response.status >= 500) {
          lastError = new Error(errorMessage);
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          // eslint-disable-next-line no-console
          console.warn(`Server error. Retrying in ${retryDelay}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(retryDelay);
          continue;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
      // Cache successful response
      if (result) {
        cacheResponse(cacheKey, result);
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on network errors after MAX_RETRIES
      if (attempt === MAX_RETRIES - 1) {
        // eslint-disable-next-line no-console
        console.error('Gemini API Error after retries:', error.message);
        throw error;
      }
      
      // Exponential backoff for retries
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      // eslint-disable-next-line no-console
      console.warn(`API call failed: ${error.message}. Retrying in ${retryDelay}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(retryDelay);
    }
  }
  
  throw lastError || new Error('API call failed after retries');
};

/**
 * Get writing suggestions based on current context
 * @param {string} currentText - The current text being written
 * @param {number} cursorPosition - Position of cursor in text
 * @returns {Promise<string>} - Suggested continuation
 */
export const getWritingSuggestion = async (currentText, cursorPosition) => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
      // eslint-disable-next-line no-console
      console.warn('Gemini API key not configured. Suggestions disabled.');
      return '';
    }

    if (!currentText.trim() || currentText.length < 10) {
      return '';
    }

    const textBeforeCursor = currentText.substring(0, cursorPosition);
    const lastSentence = textBeforeCursor.split(/[.!?]\s/).pop() || textBeforeCursor;

    // Only get suggestions if we have meaningful context
    if (lastSentence.trim().length < 5) {
      return '';
    }

    const prompt = 'You are a writing assistant. Provide a brief, natural continuation (5-10 words) of this text. Only return the suggested text, nothing else.\n\nText: "' + lastSentence + '"\n\nContinuation:';

    return await callGeminiAPI(prompt, { maxTokens: 100 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting writing suggestion:', error);
    return '';
  }
};

/**
 * Check spelling and get corrections using AI
 * @param {string} text - Text to check
 * @returns {Promise<Array>} - Array of corrections with original, corrected, and position
 */
export const checkSpellingWithAI = async (text) => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
      // eslint-disable-next-line no-console
      console.warn('Gemini API key not configured. Spell check disabled.');
      return [];
    }

    if (!text.trim() || text.length < 3) {
      return [];
    }

    const prompt = 'You are a spelling correction assistant. Identify spelling mistakes and provide corrections. Return ONLY a JSON array of objects with this exact format: [{"original": "misspelled word", "corrected": "correct word"}]. If no mistakes, return empty array []. Do not include any other text or explanation.\n\nText to check: "' + text + '"\n\nJSON response:';

    const response = await callGeminiAPI(prompt, { 
      temperature: 0.3,
      maxTokens: 400 
    });

    if (!response) return [];

    // Clean up the response to extract JSON
    let jsonStr = response.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Remove any leading/trailing text before/after the JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      // eslint-disable-next-line no-console
      console.warn('No valid JSON array found in response');
      return [];
    }
    
    jsonStr = arrayMatch[0];

    // Parse the JSON response
    const corrections = JSON.parse(jsonStr);
    
    // Add position information for each correction
    return corrections.map(correction => {
      const regex = new RegExp('\\b' + correction.original + '\\b', 'gi');
      const match = regex.exec(text);
      return {
        ...correction,
        position: match ? match.index : -1
      };
    }).filter(c => c.position !== -1);

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error checking spelling:', error);
    return [];
  }
};

/**
 * Get grammar and style improvements
 * @param {string} text - Text to improve
 * @returns {Promise<string>} - Improved text
 */
export const getGrammarSuggestions = async (text) => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
      // eslint-disable-next-line no-console
      console.warn('Gemini API key not configured.');
      throw new Error('AI service not configured');
    }

    if (!text.trim() || text.length < 5) {
      return text;
    }

    // Detect if text contains Hindi/Devanagari characters
    const hasHindi = /[\u0900-\u097F]/.test(text);
    
    const prompt = hasHindi 
      ? `You are a grammar and style editor for Hindi and English text. Correct any spelling mistakes, grammar errors, and improve the flow while preserving the original meaning and tone. Handle both Hindi (Devanagari) and English text. Return ONLY the corrected text, nothing else - no explanations, no quotes, just the corrected text.\n\nText: ${text}\n\nCorrected text:`
      : `You are a grammar and style editor. Correct spelling mistakes, fix grammar errors, and improve sentence structure while keeping the meaning and tone. Return ONLY the corrected text, nothing else - no explanations, no quotes, just the corrected text.\n\nText: ${text}\n\nCorrected text:`;

    const response = await callGeminiAPI(prompt, { 
      temperature: 0.2,
      maxTokens: 2000 
    });

    if (!response || response === text) {
      // eslint-disable-next-line no-console
      console.log('AI returned same text or empty response');
    }

    return response || text;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting grammar suggestions:', error);
    throw error; // Re-throw to be caught by the UI
  }
};

/**
 * Generate title suggestions based on content
 * @param {string} content - The content to generate title from
 * @param {string} subtitle - Optional subtitle for context
 * @returns {Promise<string>} - Suggested title
 */
export const generateTitleSuggestion = async (content, subtitle = '') => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
      // eslint-disable-next-line no-console
      console.warn('Gemini API key not configured. Title suggestions disabled.');
      return '';
    }

    if (!content.trim() || content.length < 50) {
      return '';
    }

    // Take first 500 characters for context
    const contentPreview = content.substring(0, 500);
    
    const prompt = 'You are a creative title generator for blog posts and articles. Based on the content below, suggest a compelling, catchy title (maximum 60 characters). Return ONLY the title text, nothing else.\n\n' + (subtitle ? 'Subtitle: ' + subtitle + '\n\n' : '') + 'Content: ' + contentPreview + '\n\nTitle:';

    const response = await callGeminiAPI(prompt, { 
      temperature: 0.8,
      maxTokens: 100 
    });

    return response || '';
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error generating title suggestion:', error);
    return '';
  }
};
