// Learning Path Recommendation Demo Data — 400 students
// Injected biases:
//   Black students: remediation referred 43% more same assessment score
//   Mobile-only: recommended 0.7 levels lower same performance
//   Acceleration Level 4+: 71% White/Asian, 29% other
//   Human review flags: Black students flagged 2.3x more

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const rand = seededRand(33);

const RACES = ['White','Black','Hispanic','Asian'];
const GENDERS = ['Male','Female'];
const COURSES = ['Algebra I','English Composition','US History','Introduction to Biology','Computer Science','Creative Writing','Statistics','Literature'];
const DEVICES = ['Desktop','Mobile','Tablet'];
const INTERNET = ['Fast','Medium','Slow'];

function wChoice(opts, weights, r) {
  let t = r * weights.reduce((a,b)=>a+b,0), i=0;
  for(;i<weights.length;i++){t-=weights[i];if(t<=0)return opts[i];}
  return opts[opts.length-1];
}

const students = [];

for (let i = 0; i < 400; i++) {
  const r = () => rand();

  const race = wChoice(RACES,[0.50,0.24,0.18,0.08],r());
  const gender = r()<0.50?'Male':'Female';
  const ses = Math.floor(1+r()*5);
  const firstGen = ses<=2?r()<0.65:r()<0.22;
  const disabilityStatus = r()<0.12?1:0;
  const isESL = race==='Hispanic'?r()<0.50:race==='Asian'?r()<0.40:r()<0.07;
  const primaryLanguage = isESL?(race==='Hispanic'?'Spanish':'Mandarin'):'English';

  // Device type — SES proxy
  const deviceWeights = ses<=2?[0.25,0.60,0.15]:ses>=4?[0.70,0.20,0.10]:[0.48,0.38,0.14];
  const deviceType = wChoice(DEVICES,deviceWeights,r());
  const isMobileOnly = deviceType==='Mobile';

  // Internet speed
  const inetWeights = ses<=2?[0.15,0.40,0.45]:ses>=4?[0.70,0.25,0.05]:[0.45,0.40,0.15];
  const internetSpeed = wChoice(INTERNET,inetWeights,r());

  const currentCourse = COURSES[Math.floor(r()*COURSES.length)];
  const assessmentScore = Math.round(50+r()*48);
  const completionRate = parseFloat((40+r()*58).toFixed(1));
  const timeSpentHours = parseFloat((5+r()*40).toFixed(1));
  const platformEngagement = parseFloat((20+r()*75).toFixed(1));

  // Recommended course level (1-5) — inject biases
  let baseLevel = 1 + (assessmentScore/100)*4; // merit-based
  let levelBias = 0;

  if (isMobileOnly) levelBias -= (0.4+r()*0.6); // avg -0.7
  if (internetSpeed==='Slow') levelBias -= (0.1+r()*0.3);
  if (race==='Black' && r()<0.25) levelBias -= (0.2+r()*0.4); // subtle downward
  if (disabilityStatus) levelBias -= (0.1+r()*0.3);

  const recommendedLevel = Math.min(5,Math.max(1,parseFloat((baseLevel+levelBias).toFixed(1))));

  // Remediation referral — Black students 43% more for same score
  const baseRemediationProb = assessmentScore<60?0.65:assessmentScore<70?0.25:assessmentScore<80?0.10:0.03;
  let remediationBias = 0;
  if (race==='Black') remediationBias = 0.15; // ~43% more at same score band
  if (disabilityStatus) remediationBias += 0.08;
  const referredToRemediation = r()<Math.min(0.95,baseRemediationProb+remediationBias)?1:0;

  // Advanced track (Level 4+)
  const recommendedAdvanced = recommendedLevel>=4?1:0;

  // Human review flag — Black students 2.3x more
  const baseFlagProb = assessmentScore<55?0.35:assessmentScore<70?0.12:0.04;
  const flagBias = race==='Black'?(baseFlagProb*1.3):0;
  const flaggedForReview = r()<Math.min(0.85,baseFlagProb+flagBias)?1:0;

  const nextCourse = currentCourse; // simplified

  students.push({
    student_id: `LRN${String(i+1).padStart(4,'0')}`,
    current_course: currentCourse,
    recommended_next_course: nextCourse,
    recommended_level: recommendedLevel,
    course_level: Math.round(baseLevel),
    completion_rate_pct: completionRate,
    assessment_score: assessmentScore,
    time_spent_hours: timeSpentHours,
    platform_engagement_score: platformEngagement,
    referred_to_remediation: referredToRemediation,
    recommended_advanced: recommendedAdvanced,
    flagged_for_review: flaggedForReview,
    race, gender, ses,
    first_gen: firstGen?1:0,
    disability_status: disabilityStatus,
    device_type: deviceType,
    is_mobile_only: isMobileOnly?1:0,
    internet_speed_category: internetSpeed,
    primary_language: primaryLanguage,
    is_esl: isESL?1:0,
  });
}

export const LEARNING_PATH_DEMO = students;
