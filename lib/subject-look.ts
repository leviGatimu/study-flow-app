/**
 * The icon and pastel colour each subject gets on the Subjects pages, worked
 * out from its name, so there is nothing to set up or store. Pure, tested in
 * test/subject-look.test.mjs; components/subjects/SubjectIcon.tsx maps these
 * keys to real icons and classes.
 */

export type SubjectIconKey =
  | 'math' | 'code' | 'web' | 'database' | 'network' | 'chip' | 'physics' | 'chemistry' | 'biology'
  | 'health' | 'english' | 'language' | 'literature' | 'history' | 'geography' | 'business' | 'economics'
  | 'engineering' | 'art' | 'music' | 'religion' | 'sport' | 'social' | 'computer' | 'report' | 'book';

export type SubjectTone = 'violet' | 'rose' | 'amber' | 'emerald' | 'sky' | 'teal' | 'pink' | 'indigo';

export const SUBJECT_TONES: SubjectTone[] = ['violet', 'rose', 'amber', 'emerald', 'sky', 'teal', 'pink', 'indigo'];

/**
 * First match wins, so the more specific words come first ("embedded system"
 * is a chip before "system" anything; "web ui" is web before "ui"). Short
 * names like "C" and "PHP" are matched as whole words.
 */
const RULES: [RegExp, SubjectIconKey][] = [
  // The folder the app files daily/weekly reports into (Resources > Reports).
  [/^reports?$/, 'report'],
  [/\b(embedded|microcontroller|arduino|electronics?|circuits?|hardware)\b/, 'chip'],
  [/\b(network(ing)?|cisco|ccna|telecom)\b/, 'network'],
  [/\b(databases?|sql|dbms|data ?base)\b/, 'database'],
  [/\b(web|html|css|ui|ux|frontend|front end|design)\b/, 'web'],
  [/\b(programming|coding|javascript|js|typescript|java|python|php|c\+\+|c#|c|kotlin|swift|algorithms?|software)\b/, 'code'],
  [/\b(computer|computing|ict|it|informatics|cyber)\b/, 'computer'],
  [/\b(math(s|ematics)?|algebra|calculus|geometry|statistics|stats|trigonometry)\b/, 'math'],
  [/\b(physics|mechanics)\b/, 'physics'],
  [/\b(chemistry|chem)\b/, 'chemistry'],
  [/\b(biology|bio|life science)\b/, 'biology'],
  [/\b(health|medicine|medical|nursing|anatomy)\b/, 'health'],
  [/\b(english)\b/, 'english'],
  [/\b(french|kinyarwanda|swahili|kiswahili|spanish|german|arabic|chinese|languages?|linguistics)\b/, 'language'],
  [/\b(literature|lit|poetry|novel)\b/, 'literature'],
  [/\b(history)\b/, 'history'],
  [/\b(geography|geo|environment(al)?)\b/, 'geography'],
  [/\b(economics?|econ|finance|accounting)\b/, 'economics'],
  [/\b(business|entrepreneurship|management|marketing|commerce)\b/, 'business'],
  [/\b(engineering|technical drawing|drawing|workshop)\b/, 'engineering'],
  [/\b(art|arts|painting|fine art)\b/, 'art'],
  [/\b(music)\b/, 'music'],
  [/\b(religion|religious|bible|divinity|theology|christian|ethics)\b/, 'religion'],
  [/\b(sport|sports|pe|physical education)\b/, 'sport'],
  [/\b(social|sociology|psychology|citizenship|civics|politics)\b/, 'social'],
];

/** Each icon's own colour, so "Physics" and "Physics (revision)" match. */
const TONE_OF: Partial<Record<SubjectIconKey, SubjectTone>> = {
  math: 'violet', code: 'sky', web: 'pink', database: 'teal', network: 'indigo', chip: 'emerald',
  physics: 'amber', chemistry: 'teal', biology: 'emerald', health: 'rose', english: 'rose',
  language: 'sky', literature: 'pink', history: 'amber', geography: 'emerald', business: 'amber',
  economics: 'indigo', engineering: 'amber', art: 'pink', music: 'violet', religion: 'indigo',
  sport: 'emerald', social: 'violet', computer: 'sky', report: 'indigo',
};

const tidy = (name: string) =>
  name
    .toLowerCase()
    .replace(/\((revision|rev)\)|\brevision\b/g, ' ')
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function subjectLook(name: string): { icon: SubjectIconKey; tone: SubjectTone } {
  const t = tidy(name);
  const icon = RULES.find(([re]) => re.test(t))?.[1] ?? 'book';
  const tone = TONE_OF[icon] ?? SUBJECT_TONES[hash(t) % SUBJECT_TONES.length];
  return { icon, tone };
}
