/**
 * SSML TTS Usage Examples
 * 
 * This file demonstrates how to use SSML markup with the TTS engine
 */

import ssmlTTS from './ssmlTTS';

/**
 * Example 1: Basic text without SSML
 */
export const example1_basicText = () => {
  ssmlTTS.speak("Hello! This is a simple text-to-speech example.", {
    lang: 'en-IN',
    useSSML: false
  });
};

/**
 * Example 2: Text with emphasis
 */
export const example2_emphasis = () => {
  const text = `
    <prosody rate="medium">
      This is normal text.
      <emphasis level="strong">This is strongly emphasized!</emphasis>
      <emphasis level="moderate">This is moderately emphasized.</emphasis>
      <emphasis level="reduced">This is less emphasized.</emphasis>
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    useSSML: true
  });
};

/**
 * Example 3: Text with pauses/breaks
 */
export const example3_breaks = () => {
  const text = `
    Welcome to our application.
    <break time="500ms"/>
    Here is the first point.
    <break time="1000ms"/>
    And here is the second point.
    <break strength="strong"/>
    Thank you for listening!
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    useSSML: true
  });
};

/**
 * Example 4: Controlling speech rate, pitch, and volume
 */
export const example4_prosody = () => {
  const text = `
    <prosody rate="slow" pitch="low" volume="soft">
      This is spoken slowly, in a low pitch, and softly.
    </prosody>
    <break time="500ms"/>
    <prosody rate="fast" pitch="high" volume="loud">
      This is spoken quickly, in a high pitch, and loudly!
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    useSSML: true
  });
};

/**
 * Example 5: Article reading with structured content
 */
export const example5_article = () => {
  const text = `
    <prosody rate="medium" pitch="medium">
      <emphasis level="strong">Breaking News: Technology Advances</emphasis>
      <break time="800ms"/>
      <prosody rate="slow">
        Scientists have made a groundbreaking discovery in artificial intelligence.
      </prosody>
      <break time="500ms"/>
      The research team, led by Dr. Smith, announced their findings yesterday.
      <break time="1000ms"/>
      <emphasis level="moderate">This could change the future of computing.</emphasis>
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    voicePreferences: ['lekha', 'heera'],
    useSSML: true
  });
};

/**
 * Example 6: Mixed language content (Hindi + English)
 */
export const example6_mixedLanguage = () => {
  const text = `
    <prosody rate="medium">
      नमस्ते! Welcome to our bilingual demonstration.
      <break time="500ms"/>
      <lang xml:lang="hi-IN">यह हिंदी में है।</lang>
      <break time="300ms"/>
      <lang xml:lang="en-IN">And this is in English.</lang>
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'hi-IN',
    useSSML: true
  });
};

/**
 * Example 7: Dramatic storytelling with varied prosody
 */
export const example7_storytelling = () => {
  const text = `
    <prosody rate="slow" pitch="low" volume="soft">
      Once upon a time, in a far away land...
    </prosody>
    <break time="1000ms"/>
    <prosody rate="medium" volume="medium">
      There lived a brave warrior.
    </prosody>
    <break time="500ms"/>
    <prosody rate="fast" pitch="high" volume="loud">
      <emphasis level="x-strong">Suddenly, a dragon appeared!</emphasis>
    </prosody>
    <break time="800ms"/>
    <prosody rate="slow" pitch="low">
      The warrior raised his sword...
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    useSSML: true
  });
};

/**
 * Example 8: News headline with proper pacing
 */
export const example8_newsHeadline = () => {
  const text = `
    <prosody rate="medium" pitch="medium">
      <emphasis level="strong">Today's Top Story</emphasis>
      <break time="800ms"/>
      <prosody rate="slow">
        Markets reached an all-time high today.
      </prosody>
      <break time="500ms"/>
      Investors are celebrating as the index crossed the ten thousand mark.
      <break time="1000ms"/>
      <emphasis level="moderate">More details at eleven.</emphasis>
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    useSSML: true,
    onEnd: () => console.log('News reading complete!')
  });
};

/**
 * Example 9: Interactive voice command feedback
 */
export const example9_commandFeedback = () => {
  const text = `
    <prosody rate="fast" volume="loud">
      <emphasis level="strong">Command received!</emphasis>
    </prosody>
    <break time="300ms"/>
    <prosody rate="medium">
      Processing your request now.
    </prosody>
    <break time="500ms"/>
    <prosody rate="slow" pitch="high">
      Done! Your document has been saved.
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    useSSML: true
  });
};

/**
 * Example 10: Custom prosody for different sections
 */
export const example10_customSections = () => {
  const text = `
    <prosody rate="0.9" pitch="1.1">
      <emphasis level="strong">Article Title: The Future of AI</emphasis>
      <break time="1s"/>
      <prosody rate="medium">
        Introduction: Artificial Intelligence is transforming our world.
      </prosody>
      <break time="800ms"/>
      <prosody rate="slow" volume="soft">
        Key Point One: Machine learning enables computers to learn from data.
      </prosody>
      <break time="500ms"/>
      <prosody rate="fast" volume="loud">
        <emphasis level="moderate">Key Point Two: Neural networks mimic the human brain!</emphasis>
      </prosody>
      <break time="1s"/>
      <prosody rate="0.8" pitch="0.9">
        Conclusion: The possibilities are endless.
      </prosody>
    </prosody>
  `;
  
  ssmlTTS.speak(text, {
    lang: 'en-IN',
    voicePreferences: ['lekha', 'heera', 'veena'],
    useSSML: true,
    onEnd: () => console.log('Article reading finished'),
    onError: (err) => console.error('Error:', err)
  });
};

// Usage in React component:
/*
import { 
  example1_basicText, 
  example2_emphasis, 
  example3_breaks,
  example5_article 
} from './utils/ssmlTTS.examples';

// In your component:
<button onClick={example1_basicText}>Basic Text</button>
<button onClick={example2_emphasis}>With Emphasis</button>
<button onClick={example3_breaks}>With Pauses</button>
<button onClick={example5_article}>Read Article</button>
*/
