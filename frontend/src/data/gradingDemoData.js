// AI Grading Fairness Demo Data — 300 student submissions
// Injected biases:
//   Black students: AI avg 71, human avg 78 → -7pt gap
//   ESL students: AI avg 68, human avg 76 → -8pt gap
//   IEP students: AI avg 65, human avg 73 → -8pt gap
//   White non-ESL: AI avg 82, human avg 83 → -1pt gap
//   Subject pattern: gaps worse in English (8pt) than Math (1pt)

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const rand = seededRand(55);

const RACES = ['White','Black','Hispanic','Asian'];
const GENDERS = ['Male','Female'];
const SUBJECTS = ['English Essay','English Literature','History Essay','Math','Science','Social Studies'];
const ESSAY_SUBJECTS = ['English Essay','English Literature','History Essay','Social Studies'];
const ASSIGNMENT_TYPES = ['Essay','Short Answer','Multiple Choice','Project Report'];

function wChoice(opts, weights, r) {
  let t = r * weights.reduce((a,b)=>a+b,0), i=0;
  for(;i<weights.length;i++){t-=weights[i];if(t<=0)return opts[i];}
  return opts[opts.length-1];
}

const submissions = [];

for (let i = 0; i < 300; i++) {
  const r = () => rand();

  const race = wChoice(RACES,[0.52,0.22,0.18,0.08],r());
  const gender = r()<0.5?'Male':'Female';
  const ses = Math.floor(1+r()*5); // 1-5

  const firstGen = race==='White'?r()<0.18:r()<0.40;
  const isESL = race==='Hispanic'?r()<0.55:race==='Asian'?r()<0.45:r()<0.08;
  const hasIEP = r()<0.13;
  const primaryLanguage = isESL?(race==='Hispanic'?'Spanish':'Mandarin'):'English';

  const subject = SUBJECTS[Math.floor(r()*SUBJECTS.length)];
  const isEssaySubject = ESSAY_SUBJECTS.includes(subject);
  const assignmentType = isEssaySubject?wChoice(['Essay','Short Answer'],[0.7,0.3],r()):wChoice(['Multiple Choice','Project Report','Short Answer'],[0.5,0.3,0.2],r());

  // Human score — true measure of quality
  const baseHuman = 60 + r()*35;
  const humanScore = Math.round(Math.min(100,Math.max(40, baseHuman + (ses-3)*1.5)));

  // AI score — inject biases
  let aiGap = 0;
  if (race==='Black' && isEssaySubject) aiGap = -(4+r()*6); // avg -7
  else if (race==='Black') aiGap = -(1+r()*3);
  else if (isESL && isEssaySubject) aiGap = -(5+r()*6); // avg -8
  else if (isESL) aiGap = -(2+r()*4);
  else if (hasIEP && isEssaySubject) aiGap = -(5+r()*6); // avg -8
  else if (hasIEP) aiGap = -(2+r()*4);
  else if (race==='White' && !isESL) aiGap = -(0.5+r()*1.5); // avg -1
  else aiGap = -(1+r()*3);

  // Math has almost no gap
  if (subject==='Math') aiGap = aiGap*0.15;

  const aiScore = Math.round(Math.min(100, Math.max(30, humanScore + aiGap)));

  const wordCount = assignmentType==='Essay'?Math.floor(400+r()*600):Math.floor(100+r()*300);
  const subTime = new Date(2025,2,1+Math.floor(r()*60));
  const submissionTime = subTime.toISOString();

  submissions.push({
    student_id: `STU${String(i+1).padStart(4,'0')}`,
    assignment_type: assignmentType,
    ai_score: aiScore,
    human_score: humanScore,
    ai_human_gap: aiScore - humanScore,
    word_count: wordCount,
    subject_area: subject,
    is_essay_subject: isEssaySubject?1:0,
    submission_time: submissionTime,
    race, gender, ses,
    first_gen: firstGen?1:0,
    disability_status: hasIEP?1:0,
    primary_language: primaryLanguage,
    is_esl: isESL?1:0,
    has_iep: hasIEP?1:0,
    socioeconomic_status: ses,
  });
}

export const GRADING_DEMO = submissions;
