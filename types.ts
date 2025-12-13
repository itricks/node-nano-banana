

export type Language = 'ar' | 'en';
export type Theme = 'dark-blue' | 'white-apple' | 'orange';

export interface Translations {
  appName: string;
  writePrompt: string;
  settings: string;
  apiKey: string;
  apiKeyDesc: string;
  close: string;
  run: string;
  generating: string;
  zoomIn: string;
  zoomOut: string;
  fitView: string;
  clearCanvas: string;
  userNode: string;
  modelNode: string;
  model: string;
  aspectRatio: string;
  style: string;
  imageCount: string;
  quality: string;
  errorMissingKey: string;
  errorInvalidKey: string;
  errorPermissionDenied: string;
  errorGeneric: string;
  errorQuotaExceeded: string;
  images: string;
  delete: string;
  apply: string;
  saved: string;
  modelStandard: string;
  modelPro: string;
  ratioSquare: string;
  ratioLandscape: string;
  ratioPortrait: string;
  ratioWide: string;
  ratioTall: string;
  attachImage: string;
  removeImage: string;
  maxImagesReached: string;
  dragDropHint: string;
  theme: string;
  editImage: string;
  linkedToImage: string;
  retry: string;
  regenerate: string;
}

export const translations: Record<Language, Translations> = {
  ar: {
    appName: "Nano Banana",
    writePrompt: "اكتب وصف الصورة هنا... (أو الصق صورة Ctrl+V)",
    settings: "الإعدادات",
    apiKey: "مفتاح API",
    apiKeyDesc: "أدخل مفتاح Gemini API الخاص بك لتشغيل النموذج",
    close: "إغلاق",
    run: "تشغيل",
    generating: "جاري التلوين...",
    zoomIn: "تكبير",
    zoomOut: "تصغير",
    fitView: "ملاءمة العرض",
    clearCanvas: "مسح اللوحة",
    userNode: "طلب المستخدم",
    modelNode: "النتيجة",
    model: "النموذج",
    aspectRatio: "الأبعاد",
    style: "النمط",
    imageCount: "عدد الصور",
    quality: "الجودة",
    errorMissingKey: "مفقود API Key",
    errorInvalidKey: "مفتاح API غير صالح",
    errorPermissionDenied: "تم رفض الإذن. تحقق من: 1. قيود المفتاح (Restrictions). 2. تفعيل Generative Language API. 3. هذا الموديل يتطلب حساب Google Cloud مربوط ببطاقة دفع (Paid Billing).",
    errorGeneric: "حدث خطأ أثناء التوليد",
    errorQuotaExceeded: "تم تجاوز الحصة (429). يرجى الانتظار قليلاً أو تقليل عدد الصور.",
    images: "صور",
    delete: "حذف",
    apply: "تطبيق",
    saved: "تم الحفظ",
    modelStandard: "نانو بنانا (سريع)",
    modelPro: "نانو بنانا برو 2 (جودة عالية)",
    ratioSquare: "مربع (1:1)",
    ratioLandscape: "أفقي (4:3)",
    ratioPortrait: "عمودي (3:4)",
    ratioWide: "عريض (16:9)",
    ratioTall: "طويل (9:16)",
    attachImage: "إرفاق صورة",
    removeImage: "إزالة الصورة",
    maxImagesReached: "الحد الأقصى للصور",
    dragDropHint: "اسحب الصور هنا",
    theme: "المظهر",
    editImage: "تعديل / ريمكس",
    linkedToImage: "مرتبط بالصورة السابقة",
    retry: "إعادة المحاولة",
    regenerate: "توليد مرة أخرى",
  },
  en: {
    appName: "Nano Banana",
    writePrompt: "Describe image here... (or Paste image Ctrl+V)",
    settings: "Settings",
    apiKey: "API Key",
    apiKeyDesc: "Enter your Gemini API Key to enable generation",
    close: "Close",
    run: "Run",
    generating: "Painting...",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    fitView: "Fit View",
    clearCanvas: "Clear Canvas",
    userNode: "User Prompt",
    modelNode: "Result",
    model: "Model",
    aspectRatio: "Aspect Ratio",
    style: "Style",
    imageCount: "Count",
    quality: "Quality",
    errorMissingKey: "Missing API Key",
    errorInvalidKey: "Invalid API Key",
    errorPermissionDenied: "Permission Denied. Check: 1. Key Restrictions (Referrer/IP). 2. API Enabled. 3. This model requires a Paid Billing Account.",
    errorGeneric: "Error generating image",
    errorQuotaExceeded: "Quota Exceeded (429). Please wait or reduce image count.",
    images: "images",
    delete: "Delete",
    apply: "Apply",
    saved: "Saved",
    modelStandard: "Nano Banana (Fast)",
    modelPro: "Nano Banana Pro 2 (High Quality)",
    ratioSquare: "Square (1:1)",
    ratioLandscape: "Landscape (4:3)",
    ratioPortrait: "Portrait (3:4)",
    ratioWide: "Widescreen (16:9)",
    ratioTall: "Tall (9:16)",
    attachImage: "Attach Image",
    removeImage: "Remove Image",
    maxImagesReached: "Max images reached",
    dragDropHint: "Drop images here",
    theme: "Theme",
    editImage: "Edit / Remix",
    linkedToImage: "Linked to previous image",
    retry: "Retry",
    regenerate: "Regenerate",
  }
};
