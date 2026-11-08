/**
 * Words whose everyday Hinglish spelling no rule set can derive (nahi -> नहीं, mein -> में, hai -> है).
 * When the letters typed are exactly one of these, that word is offered first. Keys are lowercase.
 * Shared by the live typing engine (src/typing) and the older at-the-space converter (utils/transliterate).
 */
export const PINS = {
  // pronouns
  main: 'मैं', hum: 'हम', tum: 'तुम', aap: 'आप', ye: 'ये', yeh: 'यह',
  wo: 'वो', woh: 'वह', vo: 'वो', is: 'इस', us: 'उस', in: 'इन', un: 'उन',
  itna: 'इतना', itni: 'इतनी', jitna: 'जितना', apna: 'अपना', apni: 'अपनी',
  // common verbs & particles
  hai: 'है', hain: 'हैं', tha: 'था', the: 'थे', thi: 'थी', thin: 'थीं',
  hua: 'हुआ', hue: 'हुए', hui: 'हुई', hota: 'होता', hoti: 'होती', hote: 'होते',
  hona: 'होना', kar: 'कर', karna: 'करना', karne: 'करने', karti: 'करती',
  karta: 'करता', karte: 'करते', kiya: 'किया', kiye: 'किए', karke: 'करके',
  gaya: 'गया', gayi: 'गयी', gaye: 'गए', ja: 'जा', jao: 'जाओ', jana: 'जाना',
  de: 'दे', dena: 'देना', diya: 'दिया', liya: 'लिया', lena: 'लेना',
  raha: 'रहा', rahe: 'रहे', rahi: 'रही', sakta: 'सकता', sakte: 'सकते', sakti: 'सकती',
  // postpositions & conjunctions
  ka: 'का', ki: 'की', ke: 'के', ko: 'को', se: 'से', par: 'पर',
  mein: 'में', me: 'में', aur: 'और', ya: 'या', lekin: 'लेकिन', magar: 'मगर',
  kyunki: 'क्योंकि', agar: 'अगर', to: 'तो', toh: 'तो', bhi: 'भी', hi: 'ही',
  nahi: 'नहीं', nahin: 'नहीं', na: 'ना', haan: 'हाँ', han: 'हाँ',
  // question words & time
  kya: 'क्या', kyu: 'क्यों', kyun: 'क्यों', kyo: 'क्यों', kab: 'कब',
  kahan: 'कहाँ', yahan: 'यहाँ', wahan: 'वहाँ', jab: 'जब', tab: 'तब',
  ab: 'अब', abhi: 'अभी', phir: 'फिर', fir: 'फिर', tabhi: 'तभी', jabki: 'जबकि',
  kal: 'कल', aaj: 'आज', raat: 'रात', din: 'दिन', subah: 'सुबह', shaam: 'शाम',
  // frequent nouns & adjectives
  kuch: 'कुछ', sab: 'सब', sabhi: 'सभी', ek: 'एक',
  ghar: 'घर', log: 'लोग', logon: 'लोगों', baat: 'बात', baatein: 'बातें',
  kaam: 'काम', naam: 'नाम', dil: 'दिल', mann: 'मन', haath: 'हाथ',
  raah: 'राह', rasta: 'रास्ता', raaste: 'रास्ते', aankh: 'आँख',
  achha: 'अच्छा', achcha: 'अच्छा', theek: 'ठीक', bura: 'बुरा', bada: 'बड़ा',
  chhota: 'छोटा', naya: 'नया', purana: 'पुराना', saccha: 'सच्चा', sach: 'सच',
  kahani: 'कहानी', kahaani: 'कहानी', zindagi: 'ज़िंदगी', duniya: 'दुनिया',
  pyaar: 'प्यार', pyar: 'प्यार', dard: 'दर्द', khush: 'खुश', khwaab: 'ख्वाब',
  sapna: 'सपना', saal: 'साल', pal: 'पल', lamha: 'लम्हा', ladki: 'लड़की',
  ladka: 'लड़का', maa: 'माँ', papa: 'पापा', bhai: 'भाई', behen: 'बहन',
  dost: 'दोस्त', prem: 'प्रेम', vikas: 'विकास', topi: 'टोपी',
  priya: 'प्रिया', chhoti: 'छोटी', krishna: 'कृष्ण', raja: 'राजा',
  // words readers use when responding to a story (the rules alone mis-spell
  // them: silent final "a", nasal before d/t, "ya" endings)
  sundar: 'सुंदर', shukriya: 'शुक्रिया', dhanyavad: 'धन्यवाद', dhanyawad: 'धन्यवाद',
  dhanyavaad: 'धन्यवाद', badhai: 'बधाई', badhiya: 'बढ़िया', lajawab: 'लाजवाब',
  shandaar: 'शानदार', umda: 'उम्दा', adbhut: 'अद्भुत', behtareen: 'बेहतरीन',
  khoobsurat: 'खूबसूरत', bhavuk: 'भावुक', marmik: 'मार्मिक', prerna: 'प्रेरणा',
  sahmat: 'सहमत', sachmuch: 'सचमुच', pasand: 'पसंद', hindi: 'हिंदी',
  kavita: 'कविता', rachna: 'रचना', kavi: 'कवि', lekhak: 'लेखक', shabd: 'शब्द',
  padh: 'पढ़', padha: 'पढ़ा', padhi: 'पढ़ी', padhna: 'पढ़ना', padhkar: 'पढ़कर',
  likha: 'लिखा', likhna: 'लिखना', lagta: 'लगता', lagna: 'लगना',
  mera: 'मेरा', tera: 'तेरा', hamara: 'हमारा', tumhara: 'तुम्हारा',
  aapka: 'आपका', aapko: 'आपको', tumhe: 'तुम्हें', mujhe: 'मुझे',
  achhi: 'अच्छी', achchi: 'अच्छी', acchi: 'अच्छी', accha: 'अच्छा', achhe: 'अच्छे',
  acche: 'अच्छे', janta: 'जनता',

  // spellings the rules cannot reach (a y glide, a nasal that is never typed, Sanskrit endings)
  kai: 'कई', singh: 'सिंह', hoon: 'हूँ', hun: 'हूँ', hu: 'हूँ', hame: 'हमें', unhe: 'उन्हें', inhe: 'इन्हें',
  unhone: 'उन्होंने', inhone: 'इन्होंने', jinhone: 'जिन्होंने', maine: 'मैंने', humne: 'हमने', tumne: 'तुमने',
  usne: 'उसने', isne: 'इसने', aapne: 'आपने', kisne: 'किसने', mai: 'मैं', mei: 'में', nhi: 'नहीं',
  gai: 'गई', liye: 'लिए', diye: 'दिए', huye: 'हुए', naye: 'नए',
  chai: 'चाय', gaon: 'गाँव', delhi: 'दिल्ली', jungle: 'जंगल', shayad: 'शायद', zaroor: 'ज़रूर', zarur: 'ज़रूर', jaroor: 'ज़रूर', swayam: 'स्वयं', evam: 'एवं',
  // English words people write the way they sound; the Devanagari is how Hindi writes them
  school: 'स्कूल', college: 'कॉलेज', station: 'स्टेशन', doctor: 'डॉक्टर', phone: 'फ़ोन', hotel: 'होटल',
  office: 'ऑफिस', mobile: 'मोबाइल', computer: 'कंप्यूटर', internet: 'इंटरनेट', class: 'क्लास',
  teacher: 'टीचर', friend: 'फ्रेंड', family: 'फैमिली', photo: 'फोटो', video: 'वीडियो', time: 'टाइम',
  ok: 'ओके', okay: 'ओके', sorry: 'सॉरी', thanks: 'थैंक्स', please: 'प्लीज़', hello: 'हैलो', bye: 'बाय',
  bus: 'बस', train: 'ट्रेन', film: 'फ़िल्म', cricket: 'क्रिकेट', match: 'मैच', game: 'गेम', shop: 'शॉप',
  market: 'मार्केट', ticket: 'टिकट', bank: 'बैंक', road: 'रोड', car: 'कार', pen: 'पेन', paper: 'पेपर',
  book: 'बुक', table: 'टेबल', chair: 'चेयर', bag: 'बैग', box: 'बॉक्स', light: 'लाइट', fan: 'फैन',
  facebook: 'फेसबुक', whatsapp: 'व्हाट्सऐप', instagram: 'इंस्टाग्राम', youtube: 'यूट्यूब', google: 'गूगल',
  email: 'ईमेल', online: 'ऑनलाइन', offline: 'ऑफ़लाइन', charger: 'चार्जर', battery: 'बैटरी', screen: 'स्क्रीन',
  selfie: 'सेल्फ़ी', party: 'पार्टी', birthday: 'बर्थडे', gift: 'गिफ्ट', cake: 'केक', coffee: 'कॉफ़ी',
  pizza: 'पिज़्ज़ा', burger: 'बर्गर', restaurant: 'रेस्टोरेंट', cinema: 'सिनेमा', movie: 'मूवी', song: 'सॉन्ग',
  music: 'म्यूज़िक', dance: 'डांस', team: 'टीम', boss: 'बॉस', manager: 'मैनेजर', job: 'जॉब', salary: 'सैलरी',
  meeting: 'मीटिंग', project: 'प्रोजेक्ट', report: 'रिपोर्ट', exam: 'एग्ज़ाम', result: 'रिज़ल्ट', marks: 'मार्क्स',
  degree: 'डिग्री', university: 'यूनिवर्सिटी', hospital: 'हॉस्पिटल', medicine: 'मेडिसिन', nurse: 'नर्स',
  police: 'पुलिस', court: 'कोर्ट', judge: 'जज', lawyer: 'लॉयर', bill: 'बिल', card: 'कार्ड', cash: 'कैश',
  petrol: 'पेट्रोल', taxi: 'टैक्सी', metro: 'मेट्रो', flight: 'फ्लाइट', airport: 'एयरपोर्ट', passport: 'पासपोर्ट',
  visa: 'वीज़ा', seat: 'सीट', window: 'विंडो', garden: 'गार्डन', park: 'पार्क', tower: 'टावर', mall: 'मॉल',
  lift: 'लिफ्ट', floor: 'फ्लोर', room: 'रूम', flat: 'फ्लैट', house: 'हाउस', english: 'अंग्रेज़ी',
};
