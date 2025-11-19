# AI-Powered Editor Features

## Overview
The editor now uses Google Gemini 1.5 Flash to provide intelligent writing assistance including:
- **Real-time Writing Suggestions**: AI-powered contextual suggestions as you write
- **Automatic Spelling Correction**: Smart spell checking with AI that understands context
- **Hover to Revert**: Easily undo any automatic correction with a hover tooltip

## Why Google Gemini?
- 🆓 **FREE**: Generous free tier with 60 requests/min and 1,500 requests/day
- ⚡ **Fast**: Gemini 1.5 Flash is optimized for speed
- 💰 **Cost-Effective**: 10x cheaper than OpenAI when you exceed free tier
- 🧠 **Smart**: Excellent at understanding context and natural language

## Setup Instructions

### 1. Get a Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy your API key (it will start with `AIza...`)

### 2. Configure the Application
1. Copy `.env.example` to `.env` in the frontend folder:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Edit `.env` and add your Gemini API key:
   ```
   REACT_APP_GEMINI_API_KEY=your-actual-api-key-here
   ```

### 3. Restart the Frontend Server
After adding your API key, restart the frontend server:
```bash
./start-frontend.sh
```

## Features

### 1. Writing Suggestions
- **Trigger**: Automatically appears after 1.5 seconds of no typing
- **Usage**: Press the **right arrow key** to accept the suggestion
- **Model**: Uses Gemini 1.5 Flash for fast, contextual suggestions
- **Customization**: Suggestions are based on your writing style and context

### 2. Spelling Correction
- **Trigger**: Automatically checks spelling after 2 seconds of no typing
- **Auto-correction**: Misspelled words are automatically corrected
- **Capitalization**: Preserves original capitalization patterns
- **Visual Feedback**: Corrected words show with a green underline

### 3. Revert Corrections
- **Hover**: Hover over any green-underlined corrected word
- **Tooltip**: Shows original → corrected transformation
- **Undo**: Click "Undo correction" to revert to original spelling
- **Track Changes**: See count of all corrections applied

## AI Service API

The `aiService.js` module provides the following functions:

### `getWritingSuggestion(currentText, cursorPosition)`
Returns a contextual writing suggestion based on current text.

### `checkSpellingWithAI(text)`
Analyzes text and returns spelling corrections with positions.

### `autoCorrectWord(word)`
Corrects a single misspelled word.

### `getGrammarSuggestions(text)`
Provides grammar and style improvements (can be integrated as needed).

## Important Notes

### Security Considerations
⚠️ **Development Only**: The current implementation exposes the API key in the browser. This is acceptable for development and testing but **NOT recommended for production**.

**For Production:**
1. Create a backend API endpoint that proxies OpenAI requests
2. Store the API key securely on the server
3. Implement rate limiting and authentication
4. Example backend endpoint structure:
   ```
   POST /api/ai/suggest
   POST /api/ai/spell-check
   POST /api/ai/correct
   ```

### Cost Management
- **FREE Tier**: 60 requests per minute, 1,500 requests per day
- **Beyond Free**: ~$0.00025 per 1K tokens (10x cheaper than OpenAI)
- **Debouncing**: 1.5-2 second delays reduce API calls significantly
- **Caching**: Consider implementing for common corrections
- **Monitor**: Track usage at https://aistudio.google.com/app/apikey

### Performance Tips
1. **Longer debounce times** = fewer API calls but slower response
2. **Shorter debounce times** = faster response but more API calls  
3. **Current settings** (1.5s for suggestions, 2s for spell check) provide good balance
4. **Free tier** is very generous - most users won't exceed it

## Customization

### Adjust Debounce Timing
In `Editor.jsx`, modify the timeout values:
```javascript
// For suggestions (default: 1500ms)
suggestionTimeoutRef.current = setTimeout(async () => {
  // ...
}, 1500);

// For spell checking (default: 2000ms)
spellCheckTimeoutRef.current = setTimeout(async () => {
  // ...
}, 2000);
```

### Change AI Model
In `aiService.js`, you can switch Gemini models:
```javascript
model: 'gemini-1.5-pro',  // More capable but slower
// or
model: 'gemini-1.5-flash',  // Fast and efficient (default, recommended)
```

### Customize AI Behavior
Modify the system prompts in `aiService.js` to change how the AI responds:
```javascript
{
  role: 'system',
  content: 'Your custom instructions here...'
}
```

## Troubleshooting

### API Key Not Working
- Ensure the key starts with `AIza`
- Check if the key is active at https://aistudio.google.com/app/apikey
- Verify you've enabled the Generative Language API
- Restart the frontend server after adding the key

### No Suggestions Appearing
- Check browser console for errors
- Verify API key is set correctly in `.env`
- Ensure you haven't exceeded free tier limits (60/min, 1500/day)
- Check network tab for API responses

### CORS Errors
- Gemini API supports browser requests by default (no CORS issues)
- If you see CORS errors, check your API key is valid

### Rate Limiting
If you hit rate limits:
- Free tier: 60 requests/min is very generous
- Increase debounce timeouts (1.5s → 3s)
- Implement client-side caching
- Consider using backend proxy for production

## Future Enhancements

Potential features to add:
- [ ] Grammar checking and suggestions
- [ ] Style improvements (tone, clarity, conciseness)
- [ ] Content expansion/summarization
- [ ] Multi-language support
- [ ] Custom vocabulary/terminology
- [ ] Plagiarism detection
- [ ] Citation suggestions
- [ ] Backend proxy for secure API access
- [ ] User preference settings (enable/disable features)
- [ ] Offline fallback with local dictionary
