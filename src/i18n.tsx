/** Gives screens the text of the chosen language. The language itself is a setting kept on the device. */
import React, { createContext, useCallback, useContext } from "react";
import { translate, type Language, type TextKey } from "./domain/text";

const LanguageContext = createContext<Language>("ko");

export function LanguageProvider({ language, children }: { language: Language; children: React.ReactNode }) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

/** The language the screens are shown in. */
export const useLanguage = (): Language => useContext(LanguageContext);

export type Translate = (key: TextKey, values?: Record<string, string | number>) => string;

/** Returns the function that turns a text key into the text of the current language. */
export function useT(): Translate {
  const language = useContext(LanguageContext);
  return useCallback((key, values) => translate(language, key, values), [language]);
}
