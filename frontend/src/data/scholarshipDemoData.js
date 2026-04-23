// Scholarship Bias Detector Demo Data — 250 applicants
// Injected biases:
//   Minority: interview scored 1.6pts lower, equal essays
//   Women: award amount $2,200 lower same GPA
//   First-gen: recommendation scores 1.2pts lower
//   COM_002: rates minority 2.1pts lower

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const rand = seededRand(77);

const RACES = ['White','Black','Hispanic','Asian'];
const GENDERS = ['Male','Female'];
const COMMITTEES = ['COM_001','COM_002','COM_003'];
const SCHOLARSHIP_NAMES = ['Excellence Award','Community Leadership Grant','STEM Diversity Scholarship','Future Leaders Fund','Academic Merit Award'];
const HS_TYPES = ['Public','Private','Charter'];

function wChoice(opts, weights, r) {
  let t = r * weights.reduce((a,b)=>a+b,0), i=0;
  for(;i<weights.length;i++){t-=weights[i];if(t<=0)return opts[i];}
  return opts[opts.length-1];
}

const applicants = [];

for (let i = 0; i < 250; i++) {
  const r = () => rand();

  const race = wChoice(RACES,[0.50,0.20,0.18,0.12],r());
  const gender = r()<0.52?'Female':'Male';
  const isMinority = race!=='White' && race!=='Asian';

  const incomeWeights = race==='White'?[0.08,0.15,0.25,0.30,0.22]:
    race==='Black'?[0.28,0.32,0.22,0.12,0.06]:
    race==='Hispanic'?[0.25,0.30,0.25,0.14,0.06]:[0.10,0.18,0.25,0.28,0.19];
  const familyIncome = wChoice([1,2,3,4,5],incomeWeights,r());
  const firstGen = familyIncome<=2?r()<0.68:r()<0.18;
  const hsType = wChoice(HS_TYPES,familyIncome>=4?[0.30,0.58,0.12]:[0.72,0.18,0.10],r());
  const disabilityStatus = r()<0.10?1:0;

  const scholarship = SCHOLARSHIP_NAMES[Math.floor(r()*SCHOLARSHIP_NAMES.length)];
  const committee = COMMITTEES[Math.floor(r()*COMMITTEES.length)];

  // GPA (merit baseline)
  const gpa = parseFloat(Math.min(4.0,Math.max(2.5, 2.8+r()*1.2+(familyIncome-1)*0.06)).toFixed(2));

  // Essay score (1-10) — genuine merit
  const essayBase = 4+r()*5.5;
  const essayScore = parseFloat(Math.min(10,Math.max(1,essayBase)).toFixed(1));

  // Interview score — inject disparity
  const interviewBase = 4.5+r()*5;
  let interviewBias = 0;
  if (isMinority) interviewBias = -(1.0+r()*1.2); // avg -1.6
  if (committee==='COM_002' && isMinority) interviewBias -= (0.8+r()*0.6); // extra -1.4 from COM_002
  const interviewScore = parseFloat(Math.min(10,Math.max(1,interviewBase+interviewBias)).toFixed(1));

  // Recommendation score — first-gen penalty (school resource effect)
  const recBase = 4.5+r()*5+(hsType==='Private'?0.5:0);
  const recBias = firstGen?-(0.8+r()*0.8):0;
  const recommendationScore = parseFloat(Math.min(10,Math.max(1,recBase+recBias)).toFixed(1));

  // Award decision
  const meritComposite = gpa/4*35 + essayScore/10*25 + interviewScore/10*25 + recommendationScore/10*15;
  let awardProb = 0.10 + (meritComposite/100)*0.65;
  if (isMinority) awardProb -= 0.04;
  if (firstGen) awardProb -= 0.03;
  const awarded = r()<Math.min(0.85,Math.max(0.05,awardProb))?1:0;

  // Award amount — gender gap
  const baseAmount = 3000 + (meritComposite/100)*7000 + (r()-0.5)*1000;
  const genderPenalty = gender==='Female'?-(1800+r()*800):0; // avg -$2200
  const awardAmount = awarded?Math.round(Math.max(1000, baseAmount+genderPenalty)):0;

  applicants.push({
    applicant_id: `SCH${String(i+1).padStart(4,'0')}`,
    scholarship_name: scholarship,
    gpa, essay_score: essayScore, interview_score: interviewScore,
    recommendation_score: recommendationScore,
    merit_composite: parseFloat(meritComposite.toFixed(1)),
    awarded, award_amount: awardAmount,
    committee_id: committee,
    race, gender,
    first_gen: firstGen?1:0,
    disability_status: disabilityStatus,
    family_income: familyIncome,
    high_school_type: hsType,
    is_minority: isMinority?1:0,
    legacy_connection: r()<0.06?1:0,
  });
}

export const SCHOLARSHIP_DEMO = applicants;
