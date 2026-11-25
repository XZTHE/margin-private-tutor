import React from 'react';

const ar: Record<string, string> = {
  Subjects: 'المواد',
  'Create subject': 'إنشاء مادة',
  'Settings & AI Key': 'الإعدادات ومفتاح الذكاء الاصطناعي',
  Search: 'بحث',
  Import: 'استيراد',
  'New note': 'ملاحظة جديدة',
  'New folder': 'مجلد جديد',
  'New notebook': 'دفتر جديد',
  'Back to library': 'العودة للمكتبة',
  'Previous page': 'الصفحة السابقة',
  'Next page': 'الصفحة التالية',
  'Add page': 'إضافة صفحة',
  'Zoom out': 'تصغير',
  'Zoom in': 'تكبير',
  'Fit to width': 'ملاءمة للعرض',
  Whiteboard: 'لوحة بيضاء',
  'Full screen': 'ملء الشاشة',
  'Full screen study mode': 'وضع الدراسة بملء الشاشة',
  'Exit full screen': 'الخروج من ملء الشاشة',
  Settings: 'الإعدادات',
  Pen: 'قلم',
  Eraser: 'ممحاة',
  Text: 'نص',
  'Select text': 'تحديد النص',
  'Select region': 'تحديد منطقة',
  Undo: 'تراجع',
  'Previous step': 'الخطوة السابقة',
  Pause: 'إيقاف مؤقت',
  Resume: 'متابعة',
  'Keep ink': 'حفظ الكتابة',
  'Clear AI lesson': 'مسح الدرس',
  'Open AI assistant': 'فتح المساعد الذكي',
  'AI Assistant': 'المساعد الذكي',
  Explain: 'اشرح',
  'Solve Together': 'نحل معًا',
  Practice: 'تدرّب',
  'Ask about this page, select a region, or work through a problem.':
    'اسأل عن هذه الصفحة، أو حدد منطقة، أو نحل مسألة معًا.',
  'Turn AI ON when you want help. No background analysis.':
    'فعّل الذكاء الاصطناعي عندما تحتاج المساعدة. لا تحليل في الخلفية.',
  'Add Gemini API key': 'إضافة مفتاح Gemini API',
  'Thinking…': 'جارٍ التفكير…',
  'Why this step?': 'لماذا هذه الخطوة؟',
  'Explain another way': 'اشرح بطريقة أخرى',
  'Turn AI ON to ask…': 'فعّل الذكاء الاصطناعي للسؤال…',
  'Ask for a review of your written work…': 'اطلب مراجعة حلك المكتوب…',
  'Ask about this page…': 'اسأل عن هذه الصفحة…',
  'Page + subject context': 'الصفحة وسياق المادة',
  'AI is off': 'الذكاء الاصطناعي متوقف',
  'Working…': 'جارٍ العمل…',
  Ask: 'اسأل',
  'Gemini API (Bring Your Own Key)': 'واجهة Gemini API (مفتاحك الشخصي)',
  'Get a free Gemini API key at Google AI Studio':
    'احصل على مفتاح Gemini API مجاني من Google AI Studio',
  'Personal Gemini API Key': 'مفتاح Gemini API الشخصي',
  'Model (Free-tier compatible)': 'النموذج (متوافق مع الفئة المجانية)',
  'Test connection': 'اختبار الاتصال',
  'Testing…': 'جارٍ الاختبار…',
  'Remove key': 'إزالة المفتاح',
  Languages: 'اللغات',
  Interface: 'الواجهة',
  Conversation: 'المحادثة',
  Explanation: 'الشرح',
  Writing: 'الكتابة',
  English: 'الإنجليزية',
  Arabic: 'العربية',
  'Local Backup': 'النسخ الاحتياطي المحلي',
  'Export backup': 'تصدير نسخة احتياطية',
  'Restore backup': 'استعادة نسخة احتياطية',
  'Dismiss notification': 'إغلاق التنبيه',
};

function translate(s: string) {
  const trim = s.trim();
  return ar[trim] ? s.replace(trim, ar[trim]) : s;
}

export function translateTree(node: React.ReactNode, arabic: boolean): React.ReactNode {
  if (!arabic) return node;
  if (typeof node === 'string') return translate(node);
  if (Array.isArray(node))
    return node.map((v, i) => <React.Fragment key={i}>{translateTree(v, true)}</React.Fragment>);
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, any>;
    const changes: Record<string, any> = {};
    for (const key of ['placeholder', 'title', 'aria-label'])
      if (typeof props[key] === 'string') changes[key] = translate(props[key]);
    if (props.children !== undefined) changes.children = translateTree(props.children, true);
    return React.cloneElement(node, changes);
  }
  return node;
}
