/* תרומות לדוגמה – משמשות להדגמה בלבד. אפשר למחוק אותן מהבק אופיס ("מחיקת נתוני הדגמה") */
function seedDonations() {
  const he = ['משה כהן', 'רחל לוי', 'יוסף מזרחי', 'שרה פרץ', 'דוד ביטון', 'מרים אברהם', 'אליהו דהן', 'חנה שלום', 'אברהם אזולאי', 'רבקה פרידמן', 'יעקב גבאי', 'אסתר חדד', 'שמואל עמר', 'לאה סעדה', 'נתן אוחיון', 'תמר בן דוד'];
  const en = ['Jacob Stein', 'Sarah Klein', 'Daniel Gold', 'Rebecca Adler', 'Michael Roth'];
  const msgs = ['זכות גדולה להיות שותפים!', '', 'בהצלחה, מחכים לחנוכת הבית', '', 'לעילוי נשמת סבא וסבתא', 'מזל טוב לקהילה!', '', 'Mazal tov from New York!', ''];
  const ded = ['', '', '', 'לעילוי נשמת אבי מורי', '', 'לרפואת שרה בת רבקה', '', ''];
  let seed = 11;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const now = Date.now(), out = [];
  for (let k = 0; k < 42; k++) {
    const abroad = rnd() < 0.18;
    const cur = abroad ? 'USD' : 'ILS';
    const amount = abroad ? [36, 100, 180, 500, 1000][Math.floor(rnd() * 5)] : [36, 52, 100, 180, 360, 500, 1000, 1800, 3600][Math.floor(rnd() * 9)];
    const months = rnd() < 0.2 ? [12, 24, 36][Math.floor(rnd() * 3)] : 1;
    const baseIls = Math.round(amount * months * (cur === 'USD' ? CONFIG.usdRate : 1) * 100) / 100;
    const teams = CONFIG.teams;
    const date = Math.round(now - k * HOUR * (0.15 + rnd() * 0.5));
    out.push({
      id: 'demo' + k, date, createdAt: date, source: 'online', method: 'card', status: 'paid', demo: true,
      name: abroad ? en[Math.floor(rnd() * en.length)] : he[Math.floor(rnd() * he.length)],
      email: '', phone: '',
      amount, cur, months, baseIls, credited: baseIls * CONFIG.multiplier,
      teamId: abroad ? 't5' : (rnd() < 0.55 ? teams[Math.floor(rnd() * teams.length)].id : ''),
      dedicationId: '', dedication: ded[Math.floor(rnd() * ded.length)], plaqueStatus: '', plaqueText: '',
      message: msgs[Math.floor(rnd() * msgs.length)], anon: rnd() < 0.1, hideMessage: false,
      wantsReceipt: true, receiptSent: false, notes: ''
    });
  }
  return out;
}

/* בניית מסד הנתונים הראשוני מתוך config.js (משמש בהגדרה הראשונה של הבק אופיס) */
function buildInitialDb(withDemo) {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.teams = cfg.teams.map(t => ({ ...t, status: 'approved', demo: !!withDemo, ...(withDemo ? {} : { raised: 0, donors: 0 }) }));
  cfg.settings = { approveTeams: true };
  cfg.raffle.winners = [];
  if (!withDemo) { cfg.baseRaised = 0; cfg.baseDonors = 0; }
  return { config: cfg, donations: withDemo ? seedDonations() : [] };
}
