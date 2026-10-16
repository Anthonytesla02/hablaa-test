const NAMES: Record<string, string> = {
  es: "Spanish", spanish: "Spanish",
  fr: "French", french: "French",
  de: "German", german: "German",
  ru: "Russian", russian: "Russian",
};
export const langName = (id: string) =>
  NAMES[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);
