# Google Analytics Integration Guide

## Setup Instructions

### 1. Get Your Google Analytics Tracking ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new property or use an existing one
3. Go to **Admin** → **Property** → **Data Streams**
4. Click on your web data stream
5. Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)

### 2. Configure Environment Variable

Add your tracking ID to the `.env` file:

```env
REACT_APP_GA_TRACKING_ID=G-XXXXXXXXXX
```

### 3. Features Included

✅ **Automatic Page Tracking**: Tracks all route changes
✅ **User Authentication Tracking**: Login, register, logout events
✅ **Custom Event Tracking**: Easy-to-use functions for custom events

## Usage Examples

### Track Custom Events

```javascript
import { trackEvent } from './utils/analytics';

// Track button clicks
const handleButtonClick = () => {
  trackEvent('button_click', {
    button_name: 'create_story',
    page: 'editor'
  });
};

// Track form submissions
const handleFormSubmit = (formData) => {
  trackEvent('form_submit', {
    form_name: 'contact_form',
    fields_count: Object.keys(formData).length
  });
};

// Track feature usage
const handleVoiceRecording = () => {
  trackEvent('feature_use', {
    feature: 'voice_recording',
    duration: recordingLength
  });
};
```

### Track E-commerce Events (if applicable)

```javascript
// Track story creation
trackEvent('create_story', {
  story_id: storyId,
  category: 'fiction',
  word_count: contentLength
});

// Track story views
trackEvent('view_story', {
  story_id: storyId,
  author_id: authorId
});
```

### Track Errors

```javascript
// Track JavaScript errors
window.addEventListener('error', (event) => {
  trackEvent('javascript_error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno
  });
});

// Track API errors
const handleApiError = (error) => {
  trackEvent('api_error', {
    endpoint: '/api/stories',
    status_code: error.response?.status,
    error_type: error.name
  });
};
```

## Available Functions

### `initGA()`
Initializes Google Analytics. Called automatically in App.jsx.

### `pageview(url)`
Tracks page views. Called automatically on route changes.

### `trackEvent(eventName, parameters)`
Tracks custom events with optional parameters.

### `event({ action, category, label, value })`
Legacy event tracking function (Google Analytics 3 style).

## Event Categories Tracked

- **Authentication**: `login`, `sign_up`, `logout`
- **Navigation**: Automatic page views
- **User Interactions**: Button clicks, form submissions
- **Feature Usage**: Voice recording, story creation
- **Errors**: JavaScript errors, API failures

## Testing

To test if Google Analytics is working:

1. Open browser developer tools
2. Go to **Network** tab
3. Look for requests to `google-analytics.com` or `googletagmanager.com`
4. Check Google Analytics real-time reports

## Privacy Considerations

- Google Analytics collects user data according to their privacy policy
- Consider implementing cookie consent if required by law
- Data is sent to Google for analysis
- User IDs are tracked for authenticated users

## Troubleshooting

**Analytics not working?**
- Check that `REACT_APP_GA_TRACKING_ID` is set correctly
- Verify the tracking ID format (should start with `G-`)
- Check browser console for errors
- Ensure you're not blocking Google Analytics in ad blockers

**Events not showing up?**
- Events appear in real-time reports within seconds
- Custom reports may take 24-48 hours
- Check event parameters are properly formatted