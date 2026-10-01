import type { Locale } from "./config";

const currentEmailLabels: Record<Locale, string> = {
  ar: "البريد الإلكتروني المسجّل حاليًا",
  de: "Aktuelle registrierte E-Mail-Adresse",
  en: "Current registered email",
  es: "Correo electrónico registrado actual",
  fa: "ایمیل ثبت‌شده فعلی",
  fr: "Adresse e-mail actuelle",
  hi: "वर्तमान पंजीकृत ईमेल",
  it: "Indirizzo e-mail registrato attuale",
  ku: "ئیمەیڵی تۆمارکراوی ئێستا",
  nl: "Huidig geregistreerd e-mailadres",
  pt: "E-mail atualmente registado",
  ru: "Текущий зарегистрированный адрес электронной почты",
  tr: "Kayıtlı mevcut e-posta adresi",
  zh: "当前注册邮箱",
};

export function accountProfileText(locale: string) {
  return { currentEmail: currentEmailLabels[locale as Locale] ?? currentEmailLabels.en };
}
