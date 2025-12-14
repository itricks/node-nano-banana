
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
  thinking: string;
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
  chatModelStandard: string;
  chatModelPro: string;
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
  selectMode: string;
  selectionCount: string;
  modeImage: string;
  modeChat: string;
  copyText: string;
}

export const translations: Record<Language, Translations> = {
  ar: {
    appName: "Nano Banana",
    writePrompt: "اكتب هنا... (للرسم أو المحادثة)",
    settings: "الإعدادات",
    apiKey: "مفتاح API",
    apiKeyDesc: "أدخل مفتاح Gemini API الخاص بك لتشغيل النموذج",
    close: "إغلاق",
    run: "إرسال",
    generating: "جاري التلوين...",
    thinking: "جاري الكتابة...",
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
    errorPermissionDenied: "تم رفض الإذن. تحقق من القيود أو تفعيل API.",
    errorGeneric: "حدث خطأ",
    errorQuotaExceeded: "تم تجاوز الحصة (429).",
    images: "صور",
    delete: "حذف",
    apply: "تطبيق",
    saved: "تم الحفظ",
    modelStandard: "نانو بنانا (سريع)",
    modelPro: "نانو بنانا برو 2 (جودة عالية)",
    chatModelStandard: "جيمناي 2.5 فلاش",
    chatModelPro: "جيمناي 3 برو",
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
    selectMode: "وضع التحديد",
    selectionCount: "عناصر محددة",
    modeImage: "رسم",
    modeChat: "محادثة",
    copyText: "نسخ النص",
  },
  en: {
    appName: "Nano Banana",
    writePrompt: "Write here... (Generate or Chat)",
    settings: "Settings",
    apiKey: "API Key",
    apiKeyDesc: "Enter your Gemini API Key to enable generation",
    close: "Close",
    run: "Send",
    generating: "Painting...",
    thinking: "Thinking...",
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
    errorPermissionDenied: "Permission Denied. Check API restrictions.",
    errorGeneric: "Error generating",
    errorQuotaExceeded: "Quota Exceeded (429).",
    images: "images",
    delete: "Delete",
    apply: "Apply",
    saved: "Saved",
    modelStandard: "Nano Banana (Fast)",
    modelPro: "Nano Banana Pro 2 (High Quality)",
    chatModelStandard: "Gemini 2.5 Flash",
    chatModelPro: "Gemini 3 Pro",
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
    selectMode: "Select Mode",
    selectionCount: "selected items",
    modeImage: "Image",
    modeChat: "Chat",
    copyText: "Copy Text",
  }
};
