import React, { useState } from 'react';
import ssmlTTS from '../utils/ssmlTTS';
import {
  example1_basicText,
  example2_emphasis,
  example3_breaks,
  example4_prosody,
  example5_article,
  example6_mixedLanguage,
  example7_storytelling,
  example8_newsHeadline,
  example9_commandFeedback,
  example10_customSections
} from '../utils/ssmlTTS.examples';

const SSMLTTSDemo = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [customText, setCustomText] = useState('');
  const [useSSML, setUseSSML] = useState(true);

  const handleSpeak = (callback) => {
    setIsSpeaking(true);
    callback();
    // Monitor speaking state
    const checkInterval = setInterval(() => {
      if (!ssmlTTS.speaking) {
        setIsSpeaking(false);
        clearInterval(checkInterval);
      }
    }, 100);
  };

  const handleCustomSpeak = () => {
    if (!customText.trim()) return;
    
    setIsSpeaking(true);
    ssmlTTS.speak(customText, {
      lang: 'en-IN',
      useSSML: useSSML,
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  };

  const handleStop = () => {
    ssmlTTS.cancel();
    setIsSpeaking(false);
  };

  const handlePause = () => {
    ssmlTTS.pause();
  };

  const handleResume = () => {
    ssmlTTS.resume();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🎤 SSML Text-to-Speech Demo</h1>
      
      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Controls</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handlePause} disabled={!isSpeaking}>⏸️ Pause</button>
          <button onClick={handleResume} disabled={!isSpeaking}>▶️ Resume</button>
          <button onClick={handleStop} disabled={!isSpeaking}>⏹️ Stop</button>
        </div>
        <div style={{ marginTop: '10px' }}>
          Status: {isSpeaking ? '🔊 Speaking...' : '🔇 Idle'}
        </div>
      </div>

      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px' }}>
        <h3>Custom Text</h3>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Enter text to speak (can include SSML tags)..."
          rows="5"
          style={{ width: '100%', padding: '10px', fontSize: '14px' }}
        />
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label>
            <input
              type="checkbox"
              checked={useSSML}
              onChange={(e) => setUseSSML(e.target.checked)}
            />
            Enable SSML Parsing
          </label>
          <button 
            onClick={handleCustomSpeak}
            disabled={isSpeaking || !customText.trim()}
            style={{ padding: '8px 16px' }}
          >
            🎙️ Speak
          </button>
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
          <strong>Try:</strong> <code>&lt;emphasis level="strong"&gt;Hello!&lt;/emphasis&gt; &lt;break time="500ms"/&gt; How are you?</code>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>📚 Example Demonstrations</h3>
        <p>Click any example to hear SSML in action:</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
        <ExampleButton
          title="1. Basic Text"
          description="Simple text without SSML"
          onClick={() => handleSpeak(example1_basicText)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="2. Emphasis"
          description="Strong, moderate, and reduced emphasis"
          onClick={() => handleSpeak(example2_emphasis)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="3. Breaks & Pauses"
          description="Timed pauses between sentences"
          onClick={() => handleSpeak(example3_breaks)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="4. Prosody Control"
          description="Rate, pitch, and volume variations"
          onClick={() => handleSpeak(example4_prosody)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="5. Article Reading"
          description="Structured content with proper pacing"
          onClick={() => handleSpeak(example5_article)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="6. Mixed Languages"
          description="Hindi and English content"
          onClick={() => handleSpeak(example6_mixedLanguage)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="7. Storytelling"
          description="Dramatic reading with varied prosody"
          onClick={() => handleSpeak(example7_storytelling)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="8. News Headline"
          description="Professional news broadcasting"
          onClick={() => handleSpeak(example8_newsHeadline)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="9. Command Feedback"
          description="Interactive voice responses"
          onClick={() => handleSpeak(example9_commandFeedback)}
          disabled={isSpeaking}
        />
        
        <ExampleButton
          title="10. Custom Sections"
          description="Article with title, intro, and conclusion"
          onClick={() => handleSpeak(example10_customSections)}
          disabled={isSpeaking}
        />
      </div>

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
        <h3>ℹ️ SSML Tag Reference</h3>
        <div style={{ fontSize: '14px' }}>
          <p><strong>Break:</strong> <code>&lt;break time="500ms"/&gt;</code> or <code>&lt;break strength="medium"/&gt;</code></p>
          <p><strong>Emphasis:</strong> <code>&lt;emphasis level="strong"&gt;text&lt;/emphasis&gt;</code></p>
          <p><strong>Prosody:</strong> <code>&lt;prosody rate="slow" pitch="high" volume="loud"&gt;text&lt;/prosody&gt;</code></p>
          <p><strong>Language:</strong> <code>&lt;lang xml:lang="hi-IN"&gt;हिंदी&lt;/lang&gt;</code></p>
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
        <p>Check the browser console for detailed voice information and debugging.</p>
        <p>For complete documentation, see <code>SSML_TTS_GUIDE.md</code></p>
      </div>
    </div>
  );
};

const ExampleButton = ({ title, description, onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '15px',
        textAlign: 'left',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: disabled ? '#f5f5f5' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: disabled ? 0.6 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#f8f9fa';
          e.currentTarget.style.borderColor = '#007bff';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#fff';
          e.currentTarget.style.borderColor = '#ddd';
        }
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#007bff' }}>
        {title}
      </div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        {description}
      </div>
    </button>
  );
};

export default SSMLTTSDemo;
