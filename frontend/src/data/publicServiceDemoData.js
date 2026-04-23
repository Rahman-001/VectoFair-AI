// Public Service Access Demo Data — 600 service requests
// Injected biases:
//   Citizens 65+: completion 37% vs under-45: 88%
//   Non-English: 3x abandonment, 41% vs 82% completion
//   Mobile-only (low-income): 48% vs desktop 84%
//   Error rate: elderly 28% vs general 9%
//   Rural zips: 52% vs urban 79%

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const rand = seededRand(22);

const SERVICES = ['License Renewal','Benefits Application','Permit Filing','Court Record Request','Voter Registration','Business Registration','Social Services Request','Tax Filing Assistance'];
const LANGUAGES = ['English','Spanish','Mandarin','Arabic','Vietnamese'];
const CHANNELS = ['Web','Mobile App','Phone','In-Person'];
const DEVICES = ['Desktop','Mobile','Tablet'];

function wChoice(opts, weights, r) {
  let t = r * weights.reduce((a,b)=>a+b,0), i=0;
  for(;i<weights.length;i++){t-=weights[i];if(t<=0)return opts[i];}
  return opts[opts.length-1];
}

const requests = [];

for (let i = 0; i < 600; i++) {
  const r = () => rand();

  const age = Math.floor(18+r()*72);
  const isElderly = age >= 65;
  const isYoung = age < 45;

  const ses = Math.floor(1+r()*5);
  const disabilityStatus = r()<(isElderly?0.35:0.10)?1:0;

  const language = r()<0.60?'English':wChoice(['Spanish','Mandarin','Arabic','Vietnamese'],[0.45,0.25,0.18,0.12],r());
  const isNonEnglish = language!=='English';

  // Device type — elderly and low-SES
  const deviceWeights = isElderly?[0.45,0.35,0.20]:ses<=2?[0.25,0.60,0.15]:[0.68,0.22,0.10];
  const deviceType = wChoice(DEVICES,deviceWeights,r());
  const isMobileOnly = deviceType==='Mobile' && ses<=2;

  // ZIP code — rural vs urban
  const zipType = ses<=2?wChoice(['Urban','Rural'],[0.55,0.45],r()):
    ses>=4?wChoice(['Urban','Rural'],[0.75,0.25],r()):'Urban';
  const isRural = zipType==='Rural';
  const zipCode = isRural?String(10000+Math.floor(r()*30000)):String(90000+Math.floor(r()*5000));

  // Channel — elderly prefer phone/in-person, young prefer web
  const channelWeights = isElderly?[0.20,0.15,0.40,0.25]:
    isNonEnglish?[0.30,0.25,0.28,0.17]:
    isMobileOnly?[0.15,0.70,0.10,0.05]:[0.60,0.25,0.10,0.05];
  const channel = wChoice(CHANNELS,channelWeights,r());

  const serviceType = SERVICES[Math.floor(r()*SERVICES.length)];

  // Submission and completion dates
  const daysAgo = Math.floor(r()*180);
  const submitDate = new Date(2025,9,12);
  submitDate.setDate(submitDate.getDate()-daysAgo);
  const submittedDate = submitDate.toISOString().split('T')[0];

  // Completion rate — inject biases
  let baseCompletion = 80;
  if (isElderly) baseCompletion = 37 + r()*15;
  else if (isYoung) baseCompletion = 82 + r()*10;
  else baseCompletion = 65 + r()*20;

  if (isNonEnglish) baseCompletion = Math.min(baseCompletion, 41 + r()*15);
  if (isMobileOnly) baseCompletion = Math.min(baseCompletion, 48 + r()*15);
  if (isRural) baseCompletion = Math.min(baseCompletion, 52 + r()*15);
  if (channel==='In-Person' || channel==='Phone') baseCompletion = Math.min(95, baseCompletion+20);

  const completionRatePct = parseFloat(Math.min(100,Math.max(5,baseCompletion)).toFixed(1));
  const outcome = completionRatePct>=70?'approved':completionRatePct>=40?'pending':'denied';

  // Processing time
  const baseProcessing = 3 + Math.floor(r()*8);
  const processingBonus = isNonEnglish?(4+r()*5):disabilityStatus?(2+r()*4):isElderly?(1+r()*3):0;
  const completedDate = new Date(submitDate);
  completedDate.setDate(completedDate.getDate()+Math.round(baseProcessing+processingBonus));

  // Error encounter rate
  let baseErrorProb = 0.09;
  if (isElderly) baseErrorProb = 0.28;
  else if (isNonEnglish) baseErrorProb = 0.22;
  else if (isMobileOnly) baseErrorProb = 0.18;
  const errorEncountered = r()<baseErrorProb?1:0;

  requests.push({
    request_id: `SVC${String(i+1).padStart(4,'0')}`,
    service_type: serviceType,
    submitted_date: submittedDate,
    completed_date: completedDate.toISOString().split('T')[0],
    outcome,
    completion_rate_pct: completionRatePct,
    error_encountered: errorEncountered,
    channel,
    zip_code: zipCode,
    zip_type: zipType,
    age, ses,
    disability_status: disabilityStatus,
    primary_language: language,
    is_non_english: isNonEnglish?1:0,
    is_elderly: isElderly?1:0,
    is_young: isYoung?1:0,
    device_type: deviceType,
    is_mobile_only: isMobileOnly?1:0,
    is_rural: isRural?1:0,
  });
}

export const PUBLIC_SERVICE_DEMO = requests;
