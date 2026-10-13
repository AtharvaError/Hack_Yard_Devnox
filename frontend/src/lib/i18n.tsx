"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Text of the citizen screens in four languages. Administrator screens stay in English. */
const TEXT = {
  en: {
    home: "Home", map: "Live Map", alerts: "Alerts", route: "Safe Route", advisory: "Advisory", report: "Report an Issue",
    yourCity: "Your city", safe: "Safe", caution: "Caution", danger: "Danger",
    safeMsg: "No major risk to essential services right now.",
    cautionMsg: "Some services could be disrupted. Stay alert and avoid low-lying roads.",
    dangerMsg: "Many services are at risk. Avoid travel unless necessary and follow official alerts.",
    btnRoute: "Safe route to a hospital", btnReport: "Report damage",
    latestAlerts: "Latest alerts", noAlerts: "No active alerts.", allAlerts: "All alerts",
    emergency: "Emergency", call112: "Call 112", reliefPoints: "Relief points on the map",
    share: "Share on WhatsApp", services: "Essential services", zones: "Risk by area",
    offline: "Cannot reach the server. Showing the alerts saved earlier.",
  },
  hi: {
    home: "होम", map: "लाइव नक्शा", alerts: "चेतावनियाँ", route: "सुरक्षित रास्ता", advisory: "सलाह", report: "समस्या बताएँ",
    yourCity: "आपका शहर", safe: "सुरक्षित", caution: "सावधान", danger: "खतरा",
    safeMsg: "अभी ज़रूरी सेवाओं को कोई बड़ा खतरा नहीं है।",
    cautionMsg: "कुछ सेवाएँ बाधित हो सकती हैं। सतर्क रहें और निचली सड़कों से बचें।",
    dangerMsg: "कई सेवाएँ खतरे में हैं। ज़रूरी न हो तो यात्रा न करें और आधिकारिक चेतावनियों का पालन करें।",
    btnRoute: "अस्पताल का सुरक्षित रास्ता", btnReport: "नुकसान की सूचना दें",
    latestAlerts: "ताज़ा चेतावनियाँ", noAlerts: "कोई सक्रिय चेतावनी नहीं।", allAlerts: "सभी चेतावनियाँ",
    emergency: "आपातकाल", call112: "112 पर कॉल करें", reliefPoints: "नक्शे पर राहत केंद्र",
    share: "व्हाट्सऐप पर भेजें", services: "ज़रूरी सेवाएँ", zones: "क्षेत्र के अनुसार जोखिम",
    offline: "सर्वर से संपर्क नहीं हो रहा। पहले सहेजी गई चेतावनियाँ दिख रही हैं।",
  },
  mr: {
    home: "मुख्यपृष्ठ", map: "थेट नकाशा", alerts: "सूचना", route: "सुरक्षित मार्ग", advisory: "सल्ला", report: "समस्या कळवा",
    yourCity: "तुमचे शहर", safe: "सुरक्षित", caution: "सावध", danger: "धोका",
    safeMsg: "सध्या अत्यावश्यक सेवांना मोठा धोका नाही.",
    cautionMsg: "काही सेवा विस्कळीत होऊ शकतात. सतर्क राहा आणि सखल रस्ते टाळा.",
    dangerMsg: "अनेक सेवा धोक्यात आहेत. गरज नसल्यास प्रवास टाळा आणि अधिकृत सूचनांचे पालन करा.",
    btnRoute: "रुग्णालयाकडे सुरक्षित मार्ग", btnReport: "नुकसान कळवा",
    latestAlerts: "ताज्या सूचना", noAlerts: "कोणतीही सक्रिय सूचना नाही.", allAlerts: "सर्व सूचना",
    emergency: "आपत्कालीन", call112: "112 वर कॉल करा", reliefPoints: "नकाशावर मदत केंद्रे",
    share: "व्हॉट्सॲपवर पाठवा", services: "अत्यावश्यक सेवा", zones: "भागानुसार धोका",
    offline: "सर्व्हरशी संपर्क होत नाही. आधी जतन केलेल्या सूचना दाखवल्या आहेत.",
  },
  ml: {
    home: "ഹോം", map: "തത്സമയ ഭൂപടം", alerts: "മുന്നറിയിപ്പുകൾ", route: "സുരക്ഷിത വഴി", advisory: "നിർദ്ദേശം", report: "പ്രശ്നം അറിയിക്കുക",
    yourCity: "നിങ്ങളുടെ നഗരം", safe: "സുരക്ഷിതം", caution: "ജാഗ്രത", danger: "അപകടം",
    safeMsg: "ഇപ്പോൾ അവശ്യ സേവനങ്ങൾക്ക് വലിയ അപകടസാധ്യതയില്ല.",
    cautionMsg: "ചില സേവനങ്ങൾ തടസ്സപ്പെടാം. ജാഗ്രത പാലിക്കുക, താഴ്ന്ന റോഡുകൾ ഒഴിവാക്കുക.",
    dangerMsg: "പല സേവനങ്ങളും അപകടത്തിലാണ്. അത്യാവശ്യമല്ലെങ്കിൽ യാത്ര ഒഴിവാക്കുക, ഔദ്യോഗിക മുന്നറിയിപ്പുകൾ പാലിക്കുക.",
    btnRoute: "ആശുപത്രിയിലേക്ക് സുരക്ഷിത വഴി", btnReport: "നാശനഷ്ടം അറിയിക്കുക",
    latestAlerts: "പുതിയ മുന്നറിയിപ്പുകൾ", noAlerts: "സജീവ മുന്നറിയിപ്പുകളില്ല.", allAlerts: "എല്ലാ മുന്നറിയിപ്പുകളും",
    emergency: "അടിയന്തരം", call112: "112 വിളിക്കുക", reliefPoints: "ഭൂപടത്തിൽ ദുരിതാശ്വാസ കേന്ദ്രങ്ങൾ",
    share: "വാട്സ്ആപ്പിൽ പങ്കിടുക", services: "അവശ്യ സേവനങ്ങൾ", zones: "പ്രദേശം തിരിച്ചുള്ള അപകടസാധ്യത",
    offline: "സെർവറുമായി ബന്ധപ്പെടാനാകുന്നില്ല. മുമ്പ് സംരക്ഷിച്ച മുന്നറിയിപ്പുകൾ കാണിക്കുന്നു.",
  },
} as const;

export type Lang = keyof typeof TEXT;
export type TextKey = keyof (typeof TEXT)["en"];

export const LANGS: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "mr", name: "मराठी" },
  { code: "ml", name: "മലയാളം" },
];

const LANG_KEY = "infrasentinel.lang";
const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && saved in TEXT) setLangState(saved as Lang);
    } catch {}
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {}
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Returns the translator for the chosen language. */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback((key: TextKey) => TEXT[lang][key], [lang]);
}
