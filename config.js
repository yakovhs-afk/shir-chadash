/* =====================================================================
   קובץ ההגדרות של האתר – כאן משנים את כל התוכן, בלי לגעת בקוד.
   כל טקסט מופיע בעברית (he) ובאנגלית (en).
   ===================================================================== */

const HOUR = 3600000, DAY = 86400000;
const NOW = Date.now();

const CONFIG = {
  // ---------- פרטים כלליים ----------
  name: { he: 'בית כנסת "שיר חדש"', en: 'Shir Chadash Synagogue' },
  shortName: { he: 'שיר חדש', en: 'Shir Chadash' },
  tagline: { he: 'בונים יחד בית לתפילה, לתורה ולקהילה באבן שמואל', en: 'Together we build a home for prayer, Torah and community in Even Shmuel' },
  location: { he: 'אבן שמואל', en: 'Even Shmuel, Israel' },
  orgName: { he: 'עמותת "שיר חדש אבן שמואל"', en: 'Shir Chadash Even Shmuel (R.A.)' },
  orgNumber: '580756575',          // מספר עמותה
  section46: false,                // האם יש אישור סעיף 46 – כשיתקבל: לשנות ל-true ולעדכן את השאלה על מס בשאלות הנפוצות
  theme: 'classic',               // ערכת צבע: classic / stone / bordeaux / olive / sky (נבחרת בבק אופיס ← הגדרות)
  progressStyle: 'bar',           // תצוגת ההתקדמות: bar / thick / ring / thermo / building (בק אופיס ← קמפיין)
  hideGoal: false,                // true = קמפיין בלי יעד גלוי: האתר לא מציג יעד, אחוזים ויעדי בונוס
  fonts: 'classic',               // זוג גופנים (נבחר בבק אופיס ← הגדרות ← גופנים)

  // ---------- נגישות (מוצג בעמוד "הצהרת נגישות"; נערך בבק אופיס ← הגדרות) ----------
  // כל עוד אין פרטי רכז נגישות, ההצהרה מפנה לפרטי יצירת הקשר הכלליים.
  a11y: {
    coordName: '', phone: '', email: '',
    updated: '',                                  // תאריך עדכון ההצהרה, לדוגמה: 'נובמבר 2026'
    physical: { he: '', en: '' },                 // הסדרי נגישות במבנה בית הכנסת (ריק = לא יוצג)
    limits: { he: '', en: '' }                    // מגבלות נגישות ידועות נוספות (ריק = לא יוצג)
  },

  // ---------- יעד ותאריכים ----------
  goal: 2500000,                   // יעד הקמפיין בש"ח
  baseRaised: 1180000,             // סכום שגויס כבר מחוץ לאתר (צ'קים, העברות)
  baseDonors: 640,                 // מספר תורמים שכבר תרמו מחוץ לאתר
  multiplier: 2,                   // הכפלה: 1 = ללא, 2 = כפול, 3 = משולש
  // ⚠️ להדגמה – הקמפיין "חי" עכשיו. לשימוש אמיתי החליפו בתאריכים קבועים, לדוגמה:
  // startsAt: new Date('2026-12-01T20:00:00+02:00').getTime(),
  startsAt: NOW - 20 * HOUR,
  endsAt: NOW + 28 * HOUR,
  usdRate: 3.65,                   // שער דולר להצגה ולתרומות בדולר

  // ---------- וידאו ----------
  // קישור הטמעה של יוטיוב, לדוגמה: 'https://www.youtube.com/embed/XXXXXXXXXXX'
  videoUrl: '',

  // ---------- יצירת קשר ----------
  contact: {
    phone: '050-000-0000',
    email: 'info@example.org',
    address: { he: 'אבן שמואל', en: 'Even Shmuel, Israel' },
    bank: {
      he: 'בנק ______, סניף ___, חשבון ______ – על שם עמותת "שיר חדש אבן שמואל"',
      en: 'Bank ______, branch ___, account ______ – "Shir Chadash Even Shmuel"'
    }
  },

  // ---------- הסיפור ----------
  story: {
    he: [
      'הסיפור שלנו מתחיל בימי הקורונה. בתי הכנסת היו סגורים, ואנחנו התפללנו ברחוב.',
      'סביב רחוב הורד התגבש מניין נחמד של אנשים טובים ושכנים נחמדים.',
      'בהמשך הפך המניין לבית כנסת, שנבנה באוהל זמני.',
      'המרקם החברתי של המתפללים והקשרים שנוצרו בינינו הביאו אותנו לרצון לייסד ולמסד את בית הכנסת – ולבנות מבנה של קבע.',
      'אנחנו מזמינים אתכם להיות שותפים בבנייה.'
    ],
    en: [
      'Our story begins in the days of COVID. The synagogues were closed, and we prayed out on the street.',
      'Around HaVered Street, a lovely minyan formed – good people and warm neighbors.',
      'In time, the minyan became a synagogue, housed in a temporary tent.',
      'The social fabric of our congregation and the bonds formed between us led us to want to establish the synagogue on a firm footing – and to build a permanent home.',
      'We invite you to be our partners in building it.'
    ]
  },

  // ---------- שלבי הבנייה ----------
  // status: done = הושלם, active = עכשיו, todo = בעתיד. date ריק = לא מוצג תאריך
  milestones: [
    { he: 'מניין ברחוב בימי הקורונה', en: 'A street minyan during COVID', date: { he: '2020', en: '2020' }, status: 'done' },
    { he: 'בית כנסת באוהל זמני', en: 'A synagogue in a temporary tent', date: { he: '', en: '' }, status: 'done' },
    { he: 'ייסוד העמותה וגיוס לבניית מבנה קבע', en: 'Founding the association and raising funds for a permanent building', date: { he: 'עכשיו', en: 'Now' }, status: 'active' },
    { he: 'מגרש, תכנון והיתר בנייה', en: 'Plot, planning and building permit', date: { he: '', en: '' }, status: 'todo' },
    { he: 'בניית בית הכנסת', en: 'Constructing the synagogue', date: { he: '', en: '' }, status: 'todo' },
    { he: 'חנוכת הבית 🎉', en: 'Dedication ceremony 🎉', date: { he: '', en: '' }, status: 'todo' }
  ],

  // ---------- יעדי ביניים (מה כל סכום מאפשר) ----------
  stretch: [
    { amount: 1000000, he: 'השלמת היסודות', en: 'Completing the foundations' },
    { amount: 1800000, he: 'שלד הבניין והגג', en: 'Structure and roof' },
    { amount: 2500000, he: 'גמר ופתיחת בית הכנסת', en: 'Finishing and opening the synagogue' },
    { amount: 3200000, he: 'יעד בונוס: בית מדרש וספרייה', en: 'Bonus goal: Beit Midrash and library' }
  ],

  // ---------- "מה התרומה שלך בונה" ----------
  impact: [
    { amount: 36, icon: '🧱', he: 'לבנה בקיר בית הכנסת', en: 'A brick in the synagogue wall' },
    { amount: 180, icon: '📖', he: 'סט סידורים וחומשים', en: 'A set of siddurim and chumashim' },
    { amount: 360, icon: '🪟', he: 'מטר רבוע של חלונות', en: 'A square meter of windows' },
    { amount: 1000, icon: '💡', he: 'גוף תאורה באולם התפילה', en: 'A light fixture in the sanctuary' }
  ],

  // ---------- הזדמנויות הקדשה ----------
  // total = כמה יחידות יש, taken = כמה כבר נתפסו מחוץ לאתר
  dedications: [
    { id: 'building', icon: '🏛️', amount: 1000000, total: 1, taken: 0, he: 'הקדשת הבניין כולו', en: 'Naming the entire building', descHe: 'שם בית הכנסת ייקרא על שמכם או על שם יקיריכם.', descEn: 'The synagogue will bear your name or that of your loved ones.' },
    { id: 'aron', icon: '🕍', amount: 180000, total: 1, taken: 0, he: 'ארון הקודש', en: 'The Aron Kodesh (Holy Ark)', descHe: 'לב בית הכנסת – עם לוח הקדשה מוזהב.', descEn: 'The heart of the synagogue – with a gilded dedication plaque.' },
    { id: 'torah', icon: '📜', amount: 120000, total: 2, taken: 1, he: 'ספר תורה', en: 'A Sefer Torah', descHe: 'כתיבת ספר תורה מהודר והכנסתו בשמחה.', descEn: 'Writing an exquisite Torah scroll and its festive inauguration.' },
    { id: 'bima', icon: '🪑', amount: 72000, total: 1, taken: 0, he: 'הבימה', en: 'The Bimah', descHe: 'הבימה שממנה ייקרא ספר התורה.', descEn: 'The bimah from which the Torah will be read.' },
    { id: 'midrash', icon: '📚', amount: 150000, total: 1, taken: 0, he: 'בית המדרש', en: 'The Beit Midrash', descHe: 'אולם הלימוד, פתוח מהבוקר ועד הלילה.', descEn: 'The study hall, open from morning to night.' },
    { id: 'window', icon: '🪟', amount: 18000, total: 12, taken: 5, he: 'חלון ויטראז\' – שבטי ישראל', en: 'Stained-glass window – Tribes of Israel', descHe: '12 חלונות, כל אחד על שם שבט.', descEn: '12 windows, each for one of the tribes.' },
    { id: 'seat', icon: '💺', amount: 3600, total: 350, taken: 212, he: 'מקום ישיבה קבוע', en: 'A permanent seat', descHe: 'שלט שמי על מקום בבית הכנסת.', descEn: 'A name plate on a seat in the synagogue.' },
    { id: 'memorial', icon: '🕯️', amount: 1800, total: 200, taken: 64, he: 'לוח זיכרון', en: 'Memorial plaque', descHe: 'שם יקירכם על לוח הזיכרון, עם הדלקת נר ביום הזיכרון.', descEn: 'Your loved one\'s name on the memorial wall, with a candle lit on the yahrzeit.' }
  ],

  // ---------- תורמים מכפילים ----------
  matchers: [
    { name: { he: 'משפחת אלמוג', en: 'The Almog Family' }, amount: 500000 },
    { name: { he: 'קרן "דורות"', en: 'Dorot Foundation' }, amount: 400000 },
    { name: { he: 'תורם אנונימי לעילוי נשמת הוריו', en: 'Anonymous, in memory of his parents' }, amount: 250000 },
    { name: { he: 'בוני השכונה בע"מ', en: 'Neighborhood Builders Ltd.' }, amount: 100000 }
  ],

  // ---------- צוותי שגרירים ----------
  teams: [
    { id: 't1', name: { he: 'צוות הגבאים', en: 'The Gabbaim Team' }, leader: { he: 'הרב יוסף כהן', en: 'Rabbi Yosef Cohen' }, goal: 150000, raised: 112400, donors: 96 },
    { id: 't2', name: { he: 'נשות הקהילה', en: 'Women of the Community' }, leader: { he: 'רחל לוי', en: 'Rachel Levi' }, goal: 120000, raised: 98300, donors: 141 },
    { id: 't3', name: { he: 'הנוער של שיר חדש', en: 'Shir Chadash Youth' }, leader: { he: 'איתי מזרחי', en: 'Itai Mizrahi' }, goal: 50000, raised: 57200, donors: 188 },
    { id: 't4', name: { he: 'משפחת פרץ והחברים', en: 'The Peretz Family & Friends' }, leader: { he: 'דוד פרץ', en: 'David Peretz' }, goal: 80000, raised: 41500, donors: 52 },
    { id: 't5', name: { he: 'החברים מחו"ל', en: 'Friends Abroad' }, leader: { he: 'מיכאל פרידמן', en: 'Michael Friedman' }, goal: 200000, raised: 133000, donors: 74 },
    { id: 't6', name: { he: 'שיעור הדף היומי', en: 'Daf Yomi Shiur' }, leader: { he: 'אליהו ביטון', en: 'Eliyahu Biton' }, goal: 60000, raised: 22800, donors: 31 }
  ],

  // ---------- הגרלה ----------
  raffle: {
    enabled: true,
    ticketPrice: 360,     // כל ₪360 בתרומה = כרטיס אחד
    drawDate: { he: 'במוצאי הקמפיין, בשידור חי', en: 'Right after the campaign, live' },
    prizes: [
      { icon: '✈️', he: 'זוג כרטיסי טיסה לחו"ל', en: 'Two round-trip flight tickets' },
      { icon: '📜', he: 'מגילת אסתר מהודרת', en: 'An exquisite Megillat Esther' },
      { icon: '🍷', he: 'סט כלי כסף לשבת', en: 'A silver Shabbat set' },
      { icon: '🏨', he: 'סוף שבוע זוגי במלון', en: 'A couple\'s weekend at a hotel' }
    ]
  },

  // ---------- גלריה ----------
  // src: קישור לתמונה (למשל 'images/front.jpg'). אם ריק – מוצג רקע צבעוני עם אייקון.
  gallery: [
    { src: '', emoji: '🕍', colors: ['#1e3a8a', '#3b82f6'], he: 'הדמיית חזית בית הכנסת', en: 'Front facade rendering' },
    { src: '', emoji: '🕯️', colors: ['#92400e', '#f59e0b'], he: 'אולם התפילה', en: 'The sanctuary' },
    { src: '', emoji: '📚', colors: ['#065f46', '#10b981'], he: 'בית המדרש והספרייה', en: 'Beit Midrash and library' },
    { src: '', emoji: '🌳', colors: ['#3f6212', '#84cc16'], he: 'חצר ומגרש משחקים לילדים', en: 'Courtyard and playground' },
    { src: '', emoji: '🙏', colors: ['#7c2d12', '#ea580c'], he: 'התפילות ברחוב בימי הקורונה', en: 'Praying on the street during COVID' },
    { src: '', emoji: '⛺', colors: ['#334155', '#94a3b8'], he: 'בית הכנסת באוהל', en: 'Our synagogue in the tent' }
  ],

  // ---------- שאלות נפוצות ----------
  faq: [
    { q: { he: 'איך עובדת ההכפלה?', en: 'How does matching work?' },
      a: { he: 'תורמים נדיבים התחייבו מראש להכפיל כל תרומה במהלך הקמפיין, עד להשגת היעד. כך ₪100 שלכם הופכים ל-₪200 לבניין.', en: 'Generous donors have pledged in advance to match every gift during the campaign, up to the goal. Your ₪100 becomes ₪200 for the building.' } },
    // ⚠️ כשיתקבל אישור סעיף 46 – לעדכן את התשובה הזו
    { q: { he: 'האם התרומה מוכרת לצורכי מס?', en: 'Is my donation tax-deductible?' },
      a: { he: 'לעמותה עדיין אין אישור לפי סעיף 46, ולכן כרגע התרומות אינן מזכות בזיכוי ממס הכנסה. כל תורם יקבל קבלה על תרומתו לאימייל.', en: 'The association does not yet hold Section 46 approval, so donations are currently not tax-deductible in Israel. Every donor receives an emailed receipt.' } },
    { q: { he: 'אפשר לתרום בהוראת קבע או בתשלומים?', en: 'Can I give monthly or in installments?' },
      a: { he: 'כן – אפשר לבחור הוראת קבע ל-12, 24 או 36 חודשים. כל הסכום נספר לקמפיין ומוכפל.', en: 'Yes – choose a monthly gift for 12, 24 or 36 months. The full amount counts toward the campaign and is matched.' } },
    { q: { he: 'איך מקדישים חלק בבית הכנסת?', en: 'How do I dedicate part of the synagogue?' },
      a: { he: 'בחרו פריט ברשימת ההקדשות ולחצו "להקדשה". נחזור אליכם לתיאום נוסח השלט.', en: 'Choose an item in the dedications list and click "Dedicate". We will contact you to arrange the plaque wording.' } },
    { q: { he: 'מה קורה אחרי שהקמפיין נגמר?', en: 'What happens after the campaign ends?' },
      a: { he: 'אפשר להמשיך לתרום גם אחרי הקמפיין, אבל התרומות כבר לא יוכפלו.', en: 'You can keep donating after the campaign, but gifts will no longer be matched.' } },
    { q: { he: 'אפשר לתרום בהעברה בנקאית או בצ\'ק?', en: 'Can I give by bank transfer or check?' },
      a: { he: 'בהחלט – פרטי החשבון מופיעים בתחתית העמוד. אחרי ההעברה עדכנו אותנו כדי שנוסיף אתכם לרשימת התורמים.', en: 'Certainly – bank details are at the bottom of the page. After transferring, let us know so we can add you to the donor list.' } }
  ]
};
