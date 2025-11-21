/**
 * SSML-Enhanced Text-to-Speech Utility
 * Converts SSML-like markup to browser speech synthesis with enhanced controls
 */

/**
 * Parse SSML-like markup and convert to speech segments
 * Supported tags:
 * - <break time="500ms"/> or <break strength="medium"/>
 * - <emphasis level="strong">text</emphasis>
 * - <prosody rate="slow|medium|fast" pitch="low|medium|high" volume="soft|medium|loud">text</prosody>
 * - <say-as interpret-as="number|date|time">text</say-as>
 * - <lang xml:lang="hi-IN">text</lang>
 */
class SSMLParser {
  constructor() {
    this.breakStrengths = {
      'none': 0,
      'x-weak': 100,
      'weak': 200,
      'medium': 500,
      'strong': 1000,
      'x-strong': 2000
    };

    this.rateValues = {
      'x-slow': 0.5,
      'slow': 0.7,
      'medium': 1.0,
      'fast': 1.3,
      'x-fast': 1.5
    };

    this.pitchValues = {
      'x-low': 0.7,
      'low': 0.85,
      'medium': 1.0,
      'high': 1.15,
      'x-high': 1.3
    };

    this.volumeValues = {
      'silent': 0,
      'x-soft': 0.3,
      'soft': 0.5,
      'medium': 0.7,
      'loud': 0.9,
      'x-loud': 1.0
    };
  }

  /**
   * Strip SSML tags and return plain text
   */
  stripSSML(text) {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Remove emojis from text
   * Matches all emoji characters and removes them
   */
  removeEmojis(text) {
    // Comprehensive emoji regex pattern
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{203C}]|[\u{2049}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{260E}]|[\u{2611}]|[\u{2614}-\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}-\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}-\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{265F}-\u{2660}]|[\u{2663}]|[\u{2665}-\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267E}-\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}-\u{269C}]|[\u{26A0}-\u{26A1}]|[\u{26A7}]|[\u{26AA}-\u{26AB}]|[\u{26B0}-\u{26B1}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26C8}]|[\u{26CE}]|[\u{26CF}]|[\u{26D1}]|[\u{26D3}-\u{26D4}]|[\u{26E9}-\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu;
    
    return text.replace(emojiRegex, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse SSML and return speech segments
   */
  parseSSML(ssmlText) {
    const segments = [];
    let currentText = '';
    let currentProps = {
      rate: 1.0,
      pitch: 1.0,
      volume: 0.9
    };

    // Simple regex-based parser for SSML-like tags
    const tagRegex = /<(\/?)([\w-]+)([^>]*)>/g;
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(ssmlText)) !== null) {
      // Add text before tag
      if (match.index > lastIndex) {
        currentText += ssmlText.substring(lastIndex, match.index);
      }

      const [/* fullMatch */, closing, tagName, attributes] = match;
      
      if (closing) {
        // Closing tag - save segment if we have text
        if (currentText.trim()) {
          const cleanText = this.removeEmojis(currentText.trim());
          if (cleanText) {
            segments.push({
              text: cleanText,
              ...currentProps
            });
          }
          currentText = '';
        }
        // Reset to default properties
        currentProps = { rate: 1.0, pitch: 1.0, volume: 0.9 };
      } else {
        // Opening tag
        switch (tagName) {
          case 'break': {
            // Add break as a segment with empty text
            if (currentText.trim()) {
              segments.push({
                text: currentText.trim(),
                ...currentProps
              });
              currentText = '';
            }
            
            const timeMatch = attributes.match(/time=["'](\d+)(ms|s)["']/);
            const strengthMatch = attributes.match(/strength=["']([\w-]+)["']/);
            
            let breakDuration = 500; // default
            if (timeMatch) {
              const value = parseInt(timeMatch[1]);
              const unit = timeMatch[2];
              breakDuration = unit === 's' ? value * 1000 : value;
            } else if (strengthMatch) {
              breakDuration = this.breakStrengths[strengthMatch[1]] || 500;
            }
            
            segments.push({
              text: '',
              breakDuration,
              isBreak: true
            });
            break;
          }

          case 'emphasis': {
            const emphasisLevel = attributes.match(/level=["']([\w-]+)["']/)?.[1] || 'moderate';
            if (emphasisLevel === 'strong' || emphasisLevel === 'x-strong') {
              currentProps.rate = 0.9;
              currentProps.pitch = 1.1;
              currentProps.volume = 1.0;
            } else if (emphasisLevel === 'reduced') {
              currentProps.rate = 1.1;
              currentProps.pitch = 0.9;
              currentProps.volume = 0.7;
            }
            break;
          }

          case 'prosody': {
            const rateAttr = attributes.match(/rate=["']([\w-]+)["']/)?.[1];
            const pitchAttr = attributes.match(/pitch=["']([\w-]+)["']/)?.[1];
            const volumeAttr = attributes.match(/volume=["']([\w-]+)["']/)?.[1];
            
            if (rateAttr) currentProps.rate = this.rateValues[rateAttr] || parseFloat(rateAttr) || 1.0;
            if (pitchAttr) currentProps.pitch = this.pitchValues[pitchAttr] || parseFloat(pitchAttr) || 1.0;
            if (volumeAttr) currentProps.volume = this.volumeValues[volumeAttr] || parseFloat(volumeAttr) || 0.9;
            break;
          }

          case 'lang': {
            // Extract language code
            const langMatch = attributes.match(/xml:lang=["']([\w-]+)["']/);
            if (langMatch) {
              currentProps.lang = langMatch[1];
            }
            break;
          }

          case 'say-as':
            // For now, just pass through the text
            // Could be enhanced to format numbers, dates, etc.
            break;
          
          default:
            // Unknown tag, ignore
            break;
        }
      }

      lastIndex = tagRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < ssmlText.length) {
      currentText += ssmlText.substring(lastIndex);
    }
    
    if (currentText.trim()) {
      const cleanText = this.removeEmojis(currentText.trim());
      if (cleanText) {
        segments.push({
          text: cleanText,
          ...currentProps
        });
      }
    }

    return segments;
  }
}

/**
 * Enhanced TTS Engine with SSML support
 */
class SSMLTTSEngine {
  constructor() {
    this.parser = new SSMLParser();
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.queue = [];
    this.onEndCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Check if speech synthesis is supported
   */
  isSupported() {
    return 'speechSynthesis' in window;
  }

  /**
   * Get available voices
   */
  getVoices() {
    if (!this.isSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  /**
   * Find best voice for language
   */
  findVoice(lang = 'en-IN', preferences = []) {
    const voices = this.getVoices();
    
    // Try preference list first
    for (const pref of preferences) {
      const voice = voices.find(v => 
        v.name.toLowerCase().includes(pref.toLowerCase())
      );
      if (voice) return voice;
    }
    
    // Try exact language match
    const exactMatch = voices.find(v => v.lang === lang);
    if (exactMatch) return exactMatch;
    
    // Try language prefix match (e.g., 'en-IN' matches 'en-US')
    const langPrefix = lang.split('-')[0];
    const prefixMatch = voices.find(v => v.lang.startsWith(langPrefix));
    if (prefixMatch) return prefixMatch;
    
    // Return first voice
    return voices[0];
  }

  /**
   * Speak text with SSML support
   */
  speak(text, options = {}) {
    if (!this.isSupported()) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    this.cancel();

    const {
      lang = 'en-IN',
      voicePreferences = ['lekha', 'heera', 'veena', 'rishi'],
      rate = 0.9,
      pitch = 1.1,
      volume = 0.9,
      onEnd = null,
      onError = null,
      useSSML = true
    } = options;

    this.onEndCallback = onEnd;
    this.onErrorCallback = onError;

    // Parse SSML if enabled
    const segments = useSSML && text.includes('<') 
      ? this.parser.parseSSML(text)
      : [{ text: this.parser.removeEmojis(this.parser.stripSSML(text)), rate, pitch, volume }];

    this.queue = segments;
    this.isSpeaking = true;
    this.speakNextSegment(lang, voicePreferences);
  }

  /**
   * Speak next segment in queue
   */
  speakNextSegment(lang, voicePreferences) {
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      if (this.onEndCallback) this.onEndCallback();
      return;
    }

    const segment = this.queue.shift();

    // Handle breaks
    if (segment.isBreak) {
      setTimeout(() => {
        this.speakNextSegment(lang, voicePreferences);
      }, segment.breakDuration);
      return;
    }

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(segment.text);
    
    // Set voice
    const voice = this.findVoice(segment.lang || lang, voicePreferences);
    if (voice) {
      utterance.voice = voice;
    }

    // Set prosody
    utterance.rate = segment.rate;
    utterance.pitch = segment.pitch;
    utterance.volume = segment.volume;

    // Event handlers
    utterance.onend = () => {
      this.currentUtterance = null;
      this.speakNextSegment(lang, voicePreferences);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (this.onErrorCallback) this.onErrorCallback(event);
    };

    // Speak
    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Pause speech
   */
  pause() {
    if (this.isSupported() && this.isSpeaking) {
      window.speechSynthesis.pause();
      this.isPaused = true;
    }
  }

  /**
   * Resume speech
   */
  resume() {
    if (this.isSupported() && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
    }
  }

  /**
   * Cancel speech
   */
  cancel() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.queue = [];
    }
  }

  /**
   * Check if currently speaking
   */
  get speaking() {
    return this.isSpeaking && !this.isPaused;
  }
}

// Create singleton instance
const ssmlTTS = new SSMLTTSEngine();

export default ssmlTTS;
export { SSMLParser, SSMLTTSEngine };
