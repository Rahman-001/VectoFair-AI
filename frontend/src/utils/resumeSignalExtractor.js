// VectoFair — Resume Signal Extractor
// Client-side bias signal detection using regex + heuristics
// Runs BEFORE AI analysis to pre-flag bias triggers

// ── Name lookup tables ─────────────────────────────────────────────────────────
const NAMES = {
  angloFirst: [
    'james','john','robert','michael','william','david','richard','joseph','charles','thomas',
    'christopher','daniel','matthew','anthony','mark','donald','paul','steven','andrew','kenneth',
    'emily','emma','olivia','ava','isabella','sophia','mia','charlotte','amelia','harper',
    'jennifer','jessica','sarah','ashley','brittany','amanda','stephanie','melissa','nicole','rachel',
    'brendan','bradley','brian','brett','blake','chad','craig','cody','collin','clinton',
    'ryan','tyler','kyle','eric','adam','greg','jason','kevin','scott','todd',
    'allison','amber','brooke','chelsea','courtney','heather','kayla','kristen','lauren','lindsey',
  ],
  angloLast: [
    'smith','johnson','williams','jones','brown','davis','miller','wilson','moore','taylor',
    'anderson','thomas','jackson','white','harris','martin','thompson','garcia','martinez','robinson',
    'clark','rodriguez','lewis','lee','walker','hall','allen','young','hernandez','king',
    'wright','lopez','hill','scott','green','adams','baker','gonzalez','nelson','carter',
    'mitchell','perez','roberts','turner','phillips','campbell','parker','evans','edwards','collins',
    'kelly','murphy','stewart','cooper','reed','morgan','cox','cook','bell','ward',
  ],
  africanAmericanFirst: [
    'deshawn','jamal','devonte','marquis','dashawn','darius','deandre','demarcus','devion','deon',
    'lakisha','shaniqua','tamika','keisha','latoya','ebony','aaliyah','tisha','shonda','ronesha',
    'tyrone','leroy','darnell','jerome','kwame','malik','rasheed','tariq','khalil','jalen',
    'imani','zuri','amara','nadia','aisha','fatima','brianna','monique','denise','rayna',
    'devante','cortez','terrell','dwayne','lamar','treyvon','desmond','lonnie','clyde','reginald',
    'shanice','tanisha','latasha','niesha','lashonda','chantelle','precious','destiny','diamond','jazmine',
  ],
  africanAmericanLast: [
    'washington','jefferson','jackson','robinson','williams','brown','davis','johnson','jones','martin',
    'harris','thomas','moore','taylor','white','walker','hall','young','king','scott',
    'green','adams','baker','carter','mitchell','turner','bell','ward','brooks','coleman',
    'byrd','fowler','houston','mason','simmons','foster','jordan','freeman','hayes','griffin',
  ],
  hispanicFirst: [
    'maria','jose','juan','carlos','miguel','ana','luisa','pedro','gabriel','elena',
    'santiago','isabella','sofia','valentina','camila','alejandro','diego','sebastian','mateo','nicolas',
    'guadalupe','rosa','carmen','linda','patricia','angela','beatriz','claudia','diana','esperanza',
    'fernando','jorge','manuel','rafael','roberto','salvador','victor','alberto','arturo','cesar',
    'adriana','alicia','cristina','daniela','fernanda','graciela','irma','jessica','leticia','lorena',
  ],
  hispanicLast: [
    'garcia','rodriguez','martinez','hernandez','lopez','gonzalez','wilson','anderson','thomas','taylor',
    'flores','rivera','gomez','diaz','reyes','morales','jimenez','Cruz','ortiz','gutierrez',
    'chavez','ramos','torres','vargas','delgado','castro','mendez','nunez','soto','campos',
    'vega','aguilar','rojas','espinoza','fuentes','medina','herrera','ramirez','luna','suarez',
  ],
  asianFirst: [
    'wei','ming','chen','yang','li','zhang','wang','liu','xu','wu',
    'priya','anjali','kavya','divya','pooja','rahul','amit','raj','deepak','vijay',
    'yuki','kenji','hiro','akira','takeshi','yuki','naomi','ryo','sora','kaito',
    'jin','joon','hyun','soo','kyung','min','ji','eun','yoon','seung',
    'nguyen','tran','pham','le','vu','hoang','dinh','dang','bui','ngo',
    'sanjay','suresh','arun','mohan','krishna','arjun','nikhil','rohan','varun','kiran',
  ],
  asianLast: [
    'zhang','wang','liu','chen','yang','huang','zhao','wu','Zhou','xu',
    'patel','shah','sharma','gupta','mehta','joshi','desai','nair','pillai','iyer',
    'tanaka','suzuki','sato','watanabe','yamamoto','nakamura','kobayashi','ito','kato','yoshida',
    'kim','lee','park','choi','jung','kang','cho','yoon','jang','lim',
    'nguyen','tran','pham','le','vu','hoang','dinh','dang','bui','ngo',
  ],
  arabicFirst: [
    'muhammad','ahmed','ali','omar','hassan','khalid','ibrahim','yusuf','tariq','zaid',
    'fatima','aisha','khadijah','maryam','zainab','leila','nour','hana','rana','dina',
    'abdullah','abdulrahman','faisal','saleh','nasser','waleed','rashid','samir','wael','majd',
  ],
  arabicLast: [
    'al-rashid','hussain','rahman','sheikh','siddiqui','chaudhry','malik','khan','mirza','baig',
    'ali','hassan','ahmed','ibrahim','omar','mansour','jadaan','qureshi','farooq','akhtar',
  ],
  southAsianFirst: [
    'arjun','rohit','neha','sunita','pooja','ravi','sunil','manoj','ananya','shreya',
    'harpreet','gurpreet','manpreet','jaswinder','balvinder','paramjit','satinder','kulwinder','rajinder','amarjit',
  ],
};

function classifyName(fullName) {
  if (!fullName) return 'ambiguous';
  const parts = fullName.trim().toLowerCase().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts[parts.length - 1] || '';

  const scores = {
    Anglo: 0, 'African-American': 0, Hispanic: 0,
    Asian: 0, Arabic: 0, 'South Asian': 0,
  };

  if (NAMES.angloFirst.includes(firstName)) scores.Anglo += 3;
  if (NAMES.angloLast.includes(lastName)) scores.Anglo += 2;
  if (NAMES.africanAmericanFirst.includes(firstName)) scores['African-American'] += 4;
  if (NAMES.africanAmericanLast.includes(lastName)) scores['African-American'] += 2;
  if (NAMES.hispanicFirst.includes(firstName)) scores.Hispanic += 3;
  if (NAMES.hispanicLast.includes(lastName)) scores.Hispanic += 2;
  if (NAMES.asianFirst.includes(firstName)) scores.Asian += 3;
  if (NAMES.asianLast.includes(lastName)) scores.Asian += 2;
  if (NAMES.arabicFirst.includes(firstName)) scores.Arabic += 3;
  if (NAMES.arabicLast.includes(lastName)) scores.Arabic += 2;
  if (NAMES.southAsianFirst.includes(firstName)) scores['South Asian'] += 4;

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'ambiguous';
  return Object.keys(scores).find((k) => scores[k] === maxScore) || 'ambiguous';
}

// ── Zip code lookup (50 major US zips flagged as low-income/majority-minority) ──
const FLAGGED_ZIPS = new Set([
  '10032','10037','10039','10451','10452','10453','10454','10455','10456','10457', // Bronx/Harlem
  '90011','90015','90021','90033','90047','90059','90063','90280', // South/East LA
  '60619','60620','60621','60628','60636','60637','60644','60649', // Chicago South Side
  '77051','77028','77033','77016','77091', // Houston
  '21201','21205','21213','21217','21223','21229', // Baltimore
  '30310','30311','30314','30315','30318', // Atlanta
  '48227','48228','48204','48205','48206', // Detroit
  '44105','44108','44112','44127','44128', // Cleveland
  '63106','63107','63112','63115','63120', // St. Louis
  '94124','94134','94621','94601', // SF Bay Area (East Oakland)
]);

// ── University classification ──────────────────────────────────────────────────
const IVY_LEAGUE = [
  'harvard','yale','princeton','columbia','dartmouth','brown','cornell','penn','upenn','university of pennsylvania',
];
const TOP_50 = [
  'mit','stanford','caltech','duke','northwestern','johns hopkins','vanderbilt','rice','notre dame',
  'washington university','emory','georgetown','carnegie mellon','uc berkeley','ucla','michigan',
  'university of michigan','virginia','uva','wake forest','tufts','boston college','nyu','usc',
  'boston university','northeastern','ohio state','penn state','purdue','texas','ut austin',
  'georgia tech','georgia institute','illinois','university of illinois','wisconsin','uw madison',
  'minnesota','maryland','unc chapel hill','nc state','florida','uf gainesville','arizona state',
  'michigan state','rutgers','wharton','kellogg','columbia business school',
];
const HBCU_LIST = [
  'howard university','morehouse','spelman','fisk university','hampton university','tuskegee',
  'xavier university of louisiana','florida a&m','north carolina a&t','south carolina state',
  'prairie view','morgan state','tennessee state','alcorn state','grambling state','lincoln university',
  'clark atlanta','bethune-cookman','coppin state','delaware state',
];
const COMMUNITY_COLLEGE_SIGNALS = [
  'community college','junior college','cc ','cuyahoga community','city college of','community college of',
];

function classifyUniversity(text) {
  const lower = text.toLowerCase();
  if (IVY_LEAGUE.some((u) => lower.includes(u))) return 'Ivy League';
  if (TOP_50.some((u) => lower.includes(u))) return 'Top-50';
  if (HBCU_LIST.some((u) => lower.includes(u))) return 'HBCU';
  if (COMMUNITY_COLLEGE_SIGNALS.some((u) => lower.includes(u))) return 'Community College';
  return null;
}

// ── Non-US institution signals ─────────────────────────────────────────────────
const INTERNATIONAL_UNIVERSITIES = [
  'university of toronto','mcgill','waterloo','ubc','queen\'s university', // Canada
  'oxford','cambridge','imperial college','lse','warwick','edinburgh','ucl', // UK
  'peking university','tsinghua','fudan','zhejiang university','ntu singapore', // Asia
  'iit bombay','iit delhi','iit madras','iit kharagpur','bits pilani', // India
  'nus singapore','nanyang technological','seoul national','kaist',
  'university of melbourne','sydney','unsw','anu',
  'eth zurich','tu munich','tu berlin','lmu munich',
];

// ── Gendered organization signals ──────────────────────────────────────────────
const GENDERED_ORG_SIGNALS = [
  /\b(alpha|beta|gamma|delta|kappa|sigma|phi|chi|omega|theta|pi|lambda|tau|zeta|eta|mu|nu|xi|upsilon|psi|rho)\s+\w+\s+(sorority|fraternity|alpha|beta|gamma|delta|kappa)\b/i,
  /\b(sorority|fraternity)\b/i,
  /women['']s\s+(soccer|basketball|volleyball|swim|tennis|lacrosse|rowing|rugby|softball)/i,
  /\b(men['']s|women['']s)\s+(club|team|league)\b/i,
  /girl\s+scouts/i,
  /boy\s+scouts/i,
];

// ── Disability signals ─────────────────────────────────────────────────────────
const DISABILITY_SIGNALS = [
  /\b(disability|disabled|wheelchair|deaf|blind|autism|autistic|chronic illness|mental health)\b/i,
  /\bADA\b/,
  /\baccommodation[s]?\b/i,
  /\b(disability rights|disability advocacy|accessibility advocate)\b/i,
  /\b(center for independent living|lighthouse|guide dog|hearing aid|prosthetic)\b/i,
  /\b(ADHD|dyslexia|bipolar|anxiety disorder|depression|PTSD)\b/i,
];

// ── National origin signals ────────────────────────────────────────────────────
const NATIONAL_ORIGIN_SIGNALS = [
  /visa sponsorship (required|needed|necessary)/i,
  /\b(H-1B|H1B|OPT|CPT|work authorization|work permit|EAD)\b/i,
  /\b(US citizenship not required|open to sponsorship)\b/i,
];

// ── Socioeconomic signals ─────────────────────────────────────────────────────
const SOCIOECONOMIC_SIGNALS = [
  /\b(unpaid intern|volunteer intern|pro bono)\b/i,
  /\b(Pell Grant|need-based scholarship|financial aid|TRIO|first-generation|first gen)\b/i,
  /\b(community college transfer|transfer student)\b/i,
  /\b(low-income|economic mobility|opportunity scholar)\b/i,
];

// ── Employment gap detection ───────────────────────────────────────────────────
function detectEmploymentGaps(text) {
  const gaps = [];
  // Pattern: "YYYY – YYYY" or "(YYYY-YYYY)" where gap > 18 months
  const dateRangePattern = /(\b20\d{2})\s*[-–—]\s*(20\d{2}|\bPresent\b)/gi;
  const matches = [...text.matchAll(dateRangePattern)];

  const yearRanges = matches.map(m => ({
    start: parseInt(m[1]),
    end: m[2] === 'Present' ? new Date().getFullYear() : parseInt(m[2]),
    raw: m[0],
  }));

  // Sort by start year
  yearRanges.sort((a, b) => a.start - b.start);

  for (let i = 0; i < yearRanges.length - 1; i++) {
    const gapYears = yearRanges[i + 1].start - yearRanges[i].end;
    if (gapYears >= 2) { // 2+ years gap (≈ >18 months)
      gaps.push({
        from: yearRanges[i].end,
        to: yearRanges[i + 1].start,
        years: gapYears,
      });
    }
  }

  // Also check for explicit gap mentions
  const explicitGap = text.match(/career (?:break|gap|hiatus)|caregiving|family leave|sabbatical/i);
  return { gaps, hasExplicitGap: !!explicitGap };
}

// ── Graduation year / Age proxy ───────────────────────────────────────────────
function detectAgeProxy(text) {
  const gradYears = [];
  const yearPattern = /(?:graduated?|graduation|class of|B\.?[SA]\.?[^,\n]{0,30}?|M\.?[BS]\.?[^,\n]{0,30}?|Ph\.?D\.?[^,\n]{0,30}?)[\s,]\s*(19[6-9]\d|20[0-2]\d)/gi;
  let m;
  while ((m = yearPattern.exec(text)) !== null) {
    const yr = parseInt(m[1]);
    if (yr >= 1960 && yr <= new Date().getFullYear()) gradYears.push(yr);
  }

  // Fallback: any 4-digit year 1960-2010 in the text
  const fallbackPattern = /\b(19[6-9]\d|200[0-9]|201[0-5])\b/g;
  while ((m = fallbackPattern.exec(text)) !== null) {
    const yr = parseInt(m[1]);
    if (!gradYears.includes(yr)) gradYears.push(yr);
  }

  if (gradYears.length === 0) return { estimatedAge: null, gradYears: [], adea: false };

  const earliestGrad = Math.min(...gradYears);
  const estimatedAge = new Date().getFullYear() - earliestGrad + 22; // assume 22 at undergrad
  return {
    estimatedAge,
    gradYears,
    adea: estimatedAge >= 50, // ADEA protects 40+, flag at 50 for high risk
  };
}

// ── Extract candidate name ─────────────────────────────────────────────────────
function extractCandidateName(text) {
  // First non-empty line that looks like a name (2-4 words, title case, no @ or digits)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (
      /^[A-Z][a-z]+(\s+[A-Z]\.?\s+)?[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(line) &&
      !line.includes('@') &&
      !line.match(/\d{3}/)
    ) {
      return line;
    }
  }
  return lines[0] || 'Unknown Candidate';
}

// ── Address extraction ─────────────────────────────────────────────────────────
function extractZipCode(text) {
  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  return zipMatch ? zipMatch[1] : null;
}

// ── Gender pronoun scan ────────────────────────────────────────────────────────
function detectGenderSignals(text) {
  const pronounPatterns = [
    /\b(she\/her|he\/him|they\/them)\b/i,
    /\bpronoun(?:s)?:?\s+(she|he|they)/i,
    /\b(his|her|hers|himself|herself)\b/i,
  ];
  const pronounMatches = pronounPatterns.some(p => p.test(text));
  const genderedOrgs = GENDERED_ORG_SIGNALS.some(p => p.test(text));
  return { hasPronounSignal: pronounMatches, hasGenderedOrg: genderedOrgs };
}

// ── Score computation ─────────────────────────────────────────────────────────
function computeBiasVulnerabilityScore(signals, nameCategory) {
  let score = 0;

  // Name category base scores
  const nameCategoryScores = {
    'African-American': 45,
    'Hispanic': 30,
    'Arabic': 28,
    'South Asian': 22,
    'Asian': 18,
    'Anglo': 5,
    'ambiguous': 10,
  };
  score += nameCategoryScores[nameCategory] || 10;

  // Add signal scores
  for (const signal of signals) {
    const severityScores = { HIGH: 15, MEDIUM: 8, LOW: 3 };
    score += severityScores[signal.severity] || 3;
  }

  return Math.min(100, Math.max(0, score));
}

// ── Main extractor ─────────────────────────────────────────────────────────────
export function extractResumeSignals(text) {
  if (!text || text.trim().length < 50) {
    return { candidateName: 'Unknown', nameCategory: 'ambiguous', signals: [], signalCount: 0, biasVulnerabilityScore: 0 };
  }

  const signals = [];
  const lower = text.toLowerCase();

  // ── SIGNAL 1: Name ──────────────────────────────────────────────────────────
  const candidateName = extractCandidateName(text);
  const nameCategory = classifyName(candidateName);

  if (nameCategory !== 'Anglo' && nameCategory !== 'ambiguous') {
    const nameMessages = {
      'African-American': 'Name is statistically associated with African-American candidates. Research shows 50% fewer callback rates for identical resumes (Bertrand & Mullainathan, 2004).',
      'Hispanic': 'Name is statistically associated with Hispanic candidates, which may trigger unconscious bias in screening systems.',
      'Arabic': 'Name suggests Arabic/Middle Eastern origin, which may trigger national origin bias in screening.',
      'South Asian': 'Name suggests South Asian origin. Studies show callbacks drop significantly for names perceived as foreign.',
      'Asian': 'Name suggests East/Southeast Asian origin, which can trigger both name bias and assumptions about visa status.',
    };

    signals.push({
      type: 'NAME_BIAS',
      severity: nameCategory === 'African-American' ? 'HIGH' : 'MEDIUM',
      excerpt: candidateName,
      explanation: nameMessages[nameCategory] || 'Name may trigger unconscious bias in human reviewers.',
      legalBasis: 'Title VII of the Civil Rights Act, 42 U.S.C. § 2000e-2 | Bertrand & Mullainathan (2004)',
      recommendation: 'Implement blind CV screening — remove name before initial review.',
    });
  }

  // ── SIGNAL 2: Address / Zip Code ────────────────────────────────────────────
  const zip = extractZipCode(text);
  if (zip && FLAGGED_ZIPS.has(zip)) {
    const addressMatch = text.match(/\d+[^,\n]+,[^,\n]+,\s*[A-Z]{2}\s*\d{5}/);
    signals.push({
      type: 'ADDRESS_SIGNAL',
      severity: 'MEDIUM',
      excerpt: addressMatch ? addressMatch[0] : `ZIP: ${zip}`,
      explanation: `ZIP code ${zip} maps to a neighborhood with historically lower socioeconomic indicators. Screeners may form unconscious assumptions about the candidate based on their address.`,
      legalBasis: 'Fair Housing Act; EEOC guidance on socioeconomic discrimination proxies',
      recommendation: 'Remove full address from initial screening. Use city/state only.',
    });
  }

  // ── SIGNAL 3: University prestige ───────────────────────────────────────────
  const eduSection = text.match(/EDUCATION[\s\S]{0,800}/i)?.[0] || '';
  const uniType = classifyUniversity(eduSection);

  if (uniType === 'HBCU') {
    const hbcuMatch = eduSection.match(new RegExp(HBCU_LIST.join('|'), 'i'));
    signals.push({
      type: 'HBCU_SIGNAL',
      severity: 'MEDIUM',
      excerpt: hbcuMatch ? hbcuMatch[0] : 'HBCU institution',
      explanation: 'Candidate attended a Historically Black College or University (HBCU). Studies document that HBCU screening bias is well-documented and can constitute disparate impact.',
      legalBasis: 'OFCCP Affirmative Action Guidelines | Executive Order 11246 | EEOC guidance on disparate impact',
      recommendation: 'Evaluate degree and GPA independently of institution type. HBCUs produce highly qualified graduates including many senior government and corporate leaders.',
    });
  } else if (uniType === 'Community College') {
    signals.push({
      type: 'SOCIOECONOMIC_SIGNAL',
      severity: 'LOW',
      excerpt: eduSection.match(new RegExp(COMMUNITY_COLLEGE_SIGNALS.join('|'), 'i'))?.[0] || 'Community college',
      explanation: 'Community college attendance may signal first-generation student or economic constraints. Screening out community college attendees has documented disparate impact on lower-income and minority candidates.',
      legalBasis: 'EEOC guidance on educational requirement disparate impact | Griggs v. Duke Power Co.',
      recommendation: 'Evaluate candidates on skills and experience, not institutional prestige.',
    });
  }

  // International university
  if (INTERNATIONAL_UNIVERSITIES.some((u) => lower.includes(u.toLowerCase()))) {
    const intlMatch = INTERNATIONAL_UNIVERSITIES.find((u) => lower.includes(u.toLowerCase()));
    signals.push({
      type: 'NATIONAL_ORIGIN_SIGNAL',
      severity: 'MEDIUM',
      excerpt: intlMatch || 'International institution',
      explanation: 'Resume includes an international university. This may trigger assumptions about national origin, visa status, or cultural fit — all protected characteristics.',
      legalBasis: 'Title VII, national origin provisions | Immigration Reform and Control Act (IRCA)',
      recommendation: 'Evaluate degree equivalency objectively. Do not assume visa status from educational background.',
    });
  }

  // ── SIGNAL 4: Age proxy ──────────────────────────────────────────────────────
  const ageInfo = detectAgeProxy(text);
  if (ageInfo.adea && ageInfo.estimatedAge) {
    signals.push({
      type: 'AGE_PROXY',
      severity: 'HIGH',
      excerpt: `Estimated age: ~${ageInfo.estimatedAge} (graduation year: ${Math.min(...ageInfo.gradYears)})`,
      explanation: `Graduation year suggests candidate is approximately ${ageInfo.estimatedAge} years old. Age discrimination in hiring is illegal for workers over 40. Screening out experienced candidates based on tenure length violates ADEA.`,
      legalBasis: 'Age Discrimination in Employment Act (ADEA), 29 U.S.C. § 623 | EEOC guidance on age discrimination',
      recommendation: 'Remove graduation years from screening criteria. Evaluate experience by content, not duration.',
    });
  }

  // Employment gap detection
  const gapInfo = detectEmploymentGaps(text);
  if (gapInfo.gaps.length > 0 || gapInfo.hasExplicitGap) {
    const longestGap = gapInfo.gaps.reduce((max, g) => Math.max(max, g.years), 0);
    signals.push({
      type: 'EMPLOYMENT_GAP',
      severity: longestGap >= 3 ? 'MEDIUM' : 'LOW',
      excerpt: gapInfo.hasExplicitGap
        ? text.match(/career (?:break|gap|hiatus)|caregiving|family leave|sabbatical/i)?.[0] || 'Employment gap detected'
        : `Gap: ${gapInfo.gaps[0]?.from}–${gapInfo.gaps[0]?.to}`,
      explanation: 'Employment gap detected. Gap penalization disproportionately affects women (caregiving responsibilities), people with disabilities, and those who experienced illness. The 2019-2021 period aligns with COVID-19 — a gap during this period should not be penalized.',
      legalBasis: 'Title VII (sex discrimination) | ADA (disability-related gaps) | EEOC guidance',
      recommendation: 'Evaluate contributions during gaps (consulting, volunteering, caregiving). Do not penalize candidates for career breaks.',
    });
  }

  // ── SIGNAL 5: Gender signals ─────────────────────────────────────────────────
  const genderInfo = detectGenderSignals(text);
  if (genderInfo.hasPronounSignal || genderInfo.hasGenderedOrg) {
    const excerpt = text.match(/\b(she\/her|he\/him|they\/them|sorority|fraternity|women['']s [a-z]+ team|men['']s [a-z]+ team)\b/i)?.[0] || 'Gender signal';
    signals.push({
      type: 'GENDER_SIGNAL',
      severity: 'MEDIUM',
      excerpt,
      explanation: 'Resume contains signals that reveal or strongly imply the candidate\'s gender. Gender is a protected characteristic and blind screening significantly reduces gender bias.',
      legalBasis: 'Title VII, sex discrimination provisions | Bostock v. Clayton County, 590 U.S. 644 (2020)',
      recommendation: 'Remove pronouns and gender-exclusive organization names before screening. Use blind CV review.',
    });
  }

  // ── SIGNAL 6: Socioeconomic signals ─────────────────────────────────────────
  for (const pattern of SOCIOECONOMIC_SIGNALS) {
    const match = text.match(pattern);
    if (match) {
      signals.push({
        type: 'SOCIOECONOMIC_SIGNAL',
        severity: 'LOW',
        excerpt: match[0],
        explanation: 'Resume contains indicators of socioeconomic background (first-generation status, need-based aid, community college). These signals may trigger class-based bias in screeners.',
        legalBasis: 'EEOC guidance on socioeconomic discrimination proxies | Griggs v. Duke Power Co.',
        recommendation: 'Focus on skills, experience, and demonstrated achievements. Socioeconomic background is not a predictor of job performance.',
      });
      break; // One signal is enough for this category
    }
  }

  // ── SIGNAL 7: National origin / Visa ─────────────────────────────────────────
  for (const pattern of NATIONAL_ORIGIN_SIGNALS) {
    const match = text.match(pattern);
    if (match) {
      signals.push({
        type: 'VISA_STATUS_SIGNAL',
        severity: 'HIGH',
        excerpt: match[0],
        explanation: 'Resume explicitly mentions visa or work authorization status. Discriminating on this basis is prohibited. However, disclosure itself can trigger illegal screening.',
        legalBasis: 'Title VII, national origin provisions | Immigration Reform and Control Act (IRCA) anti-discrimination',
        recommendation: 'Do not screen candidates based on disclosed visa status unless a specific legal requirement exists for the role.',
      });
      break;
    }
  }

  // ── SIGNAL 8: Disability signals ─────────────────────────────────────────────
  for (const pattern of DISABILITY_SIGNALS) {
    const match = text.match(pattern);
    if (match) {
      signals.push({
        type: 'DISABILITY_SIGNAL',
        severity: 'HIGH',
        excerpt: match[0],
        explanation: 'Resume discloses or strongly implies a disability or need for accommodation. The ADA prohibits adverse employment actions based on disability. This disclosure should not affect screening decisions.',
        legalBasis: 'Americans with Disabilities Act (ADA), 42 U.S.C. § 12112 | EEOC ADA Enforcement Guidance',
        recommendation: 'Immediately remove disability-related information from screening review. Focus solely on qualifications.',
      });
      break;
    }
  }

  const biasVulnerabilityScore = computeBiasVulnerabilityScore(signals, nameCategory);

  return {
    candidateName,
    nameCategory,
    signals,
    signalCount: signals.length,
    biasVulnerabilityScore,
  };
}

// ── Risk level helper ─────────────────────────────────────────────────────────
export function getRiskLevel(score) {
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

export function getRiskColor(score) {
  if (score >= 60) return '#dc2626';
  if (score >= 35) return '#d97706';
  return '#16a34a';
}
