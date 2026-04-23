import React, { useState } from 'react';
import { Chart } from 'react-google-charts';
import { PUBLIC_SERVICE_DEMO } from '../data/publicServiceDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';

const CSV_COLUMNS = [
  { name:'request_id',           type:'string' },
  { name:'service_type',         type:'string', note:'e.g. benefits_claim, voter_registration' },
  { name:'completion_rate_pct',  type:'number', note:'0-100 completion percentage' },
  { name:'error_encountered',    type:'0/1' },
  { name:'zip_type',             type:'string', note:'Urban/Suburban/Rural' },
  { name:'age',                  type:'number', sensitive:true },
  { name:'is_elderly',           type:'0/1',    sensitive:true, note:'1 = age 65+' },
  { name:'is_young',             type:'0/1',    sensitive:true, note:'1 = age under 45' },
  { name:'is_mobile_only',       type:'0/1',    sensitive:true },
  { name:'is_non_english',       type:'0/1',    sensitive:true },
  { name:'race',                 type:'string', sensitive:true },
];


function grade(s){if(s>=80)return'A';if(s>=65)return'B';if(s>=50)return'C';if(s>=35)return'D';return'F';}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function fmtPct(n,d=0){return(n*100).toFixed(d)+'%';}

function MetricCard({label,value,sub,color='#0f172a',icon}){
  return(<div style={{backgroundColor:'#fff',borderRadius:'12px',padding:'20px 24px',border:'1px solid #e2e8f0',flex:1,minWidth:'150px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
      {icon&&<span className="material-icons-round" style={{fontSize:'18px',color:'#64748b'}}>{icon}</span>}
      <div style={{fontSize:'12px',color:'#64748b',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div>
    </div>
    <div style={{fontSize:'24px',fontWeight:'800',color,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:'12px',color:'#94a3b8',marginTop:'6px'}}>{sub}</div>}
  </div>);
}

function analyzePublicService(data){
  const groupBy=(arr,key)=>{const m={};for(const r of arr){const k=r[key]??'Unknown';if(!m[k])m[k]=[];m[k].push(r);}return m;};

  // 1. AGE COMPLETION GAP
  const elderly=data.filter(d=>d.is_elderly===1);
  const young=data.filter(d=>d.is_young===1);
  const elderlyCompletion=avg(elderly.map(p=>p.completion_rate_pct));
  const youngCompletion=avg(young.map(p=>p.completion_rate_pct));
  const ageGap=youngCompletion-elderlyCompletion;

  // 2. LANGUAGE COMPLETION GAP
  const byLanguage=groupBy(data,'is_non_english');
  const engCompletion=avg((byLanguage['0']||[]).map(p=>p.completion_rate_pct));
  const nonEngCompletion=avg((byLanguage['1']||[]).map(p=>p.completion_rate_pct));
  const langCompletionGap=engCompletion-nonEngCompletion;

  // 3. DEVICE/MOBILE GAP
  const byDevice=groupBy(data,'is_mobile_only');
  const desktopCompletion=avg((byDevice['0']||[]).map(p=>p.completion_rate_pct));
  const mobileCompletion=avg((byDevice['1']||[]).map(p=>p.completion_rate_pct));
  const deviceGap=desktopCompletion-mobileCompletion;

  // 4. ERROR ENCOUNTER RATE
  const elderlyError=avg(elderly.map(p=>p.error_encountered));
  const overallError=avg(data.map(p=>p.error_encountered));
  const nonEngError=avg((byLanguage['1']||[]).map(p=>p.error_encountered));
  const errorGap=elderlyError-overallError;

  // 5. GEOGRAPHIC GAP
  const byZip=groupBy(data,'zip_type');
  const urbanCompletion=avg((byZip['Urban']||[]).map(p=>p.completion_rate_pct));
  const ruralCompletion=avg((byZip['Rural']||[]).map(p=>p.completion_rate_pct));
  const geoGap=urbanCompletion-ruralCompletion;

  let score=100;
  if(ageGap>45)score-=30;else if(ageGap>30)score-=18;
  if(langCompletionGap>35)score-=28;else if(langCompletionGap>20)score-=18;
  if(deviceGap>30)score-=20;else if(deviceGap>18)score-=12;
  if(errorGap>0.15)score-=14;else if(errorGap>0.09)score-=8;
  if(geoGap>20)score-=8;else if(geoGap>12)score-=5;
  score=Math.max(0,Math.min(100,Math.round(score)));

  const findings=[];
  if(ageGap>30){
    findings.push({id:'age-gap',rewriteAvailable:true,
      title:`Age-Based Digital Divide — Citizens 65+ Complete Service at ${elderlyCompletion.toFixed(0)}% vs Under-45 ${youngCompletion.toFixed(0)}% (${ageGap.toFixed(0)}pp Gap)`,
      severity:ageGap>45?'SEVERE':'HIGH',
      metrics:[
        {label:'Under-45 Completion',value:fmtPct(youngCompletion/100,1)},
        {label:'65+ Completion',value:fmtPct(elderlyCompletion/100,1)},
        {label:'Gap',value:`-${ageGap.toFixed(0)}pp`},
        {label:'Error Rate (65+)',value:fmtPct(elderlyError)},
      ],
      legalBasis:[
        {name:'ADA Title II',citation:'ADA Title II — government digital services excluding elderly users with disproportionate completion barriers require alternative accessible channels'},
        {name:'Section 508',citation:'Section 508 Rehabilitation Act — federal digital services must meet WCAG 2.1 AA accessibility standards; elderly usability failures indicate non-compliance'},
        {name:'EO 14058',citation:'Executive Order 14058 — Transforming Federal Customer Experience — all qualifying life events must have accessible multi-channel service options'},
      ]});
  }
  if(langCompletionGap>20){
    findings.push({id:'language-gap',rewriteAvailable:true,
      title:`Language Access Failure — Non-English Completion ${nonEngCompletion.toFixed(0)}% vs English ${engCompletion.toFixed(0)}% — ${Math.round(langCompletionGap)}pp Gap`,
      severity:langCompletionGap>35?'SEVERE':'HIGH',
      metrics:[
        {label:'English Completion',value:fmtPct(engCompletion/100,1)},
        {label:'Non-English Completion',value:fmtPct(nonEngCompletion/100,1)},
        {label:'Gap',value:`-${langCompletionGap.toFixed(0)}pp`},
        {label:'Non-English Error Rate',value:fmtPct(nonEngError)},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Title VI — non-English completion rates 40pp below English for same services in federally funded programs constitutes national origin discrimination'},
        {name:'EO 13166',citation:'Executive Order 13166 — Improving Access for Limited English Proficiency; federal digital services must be meaningfully accessible in languages of served communities'},
        {name:'Section 508',citation:'Section 508 — multilingual accessibility is required for federally funded digital services serving LEP populations'},
      ]});
  }
  if(deviceGap>20){
    findings.push({id:'device-gap',rewriteAvailable:true,
      title:`Mobile-Only Digital Exclusion — Mobile Completion ${mobileCompletion.toFixed(0)}% vs Desktop ${desktopCompletion.toFixed(0)}% (${deviceGap.toFixed(0)}pp Gap)`,
      severity:deviceGap>30?'HIGH':'MEDIUM',
      metrics:[
        {label:'Desktop Completion',value:fmtPct(desktopCompletion/100,1)},
        {label:'Mobile-Only Completion',value:fmtPct(mobileCompletion/100,1)},
        {label:'Gap',value:`-${deviceGap.toFixed(0)}pp`},
        {label:'SES Correlation',value:'Mobile-only = low-SES/minority proxy'},
      ],
      legalBasis:[
        {name:'EO 14058',citation:'EO 14058 — Federal customer experience must be device-agnostic; mobile-only citizens (disproportionately lower-SES) cannot face 30pp completion penalty'},
        {name:'Title VI',citation:'Mobile-only as SES/racial proxy — 30pp completion gap for mobile-only users creates disparate impact on minority populations under Title VI'},
      ]});
  }
  if(errorGap>0.12){
    findings.push({id:'error-rate',rewriteAvailable:true,
      title:`Error Design Bias — Elderly Users Encounter Errors ${fmtPct(elderlyError)} vs General Population ${fmtPct(overallError)} Rate`,
      severity:errorGap>0.16?'HIGH':'MEDIUM',
      metrics:[
        {label:'Elderly Error Rate',value:fmtPct(elderlyError)},
        {label:'Overall Error Rate',value:fmtPct(overallError)},
        {label:'Gap',value:`+${fmtPct(errorGap)}`},
        {label:'WCAG Standard',value:'Errors must be clear to all users'},
      ],
      legalBasis:[
        {name:'Section 508',citation:'Section 508 — WCAG 2.1 Success Criterion 3.3.1: Error identification must be in text and descriptive; higher elderly error rates indicate non-compliance'},
        {name:'ADA Title II',citation:'High error rates for elderly users in government services constitute accessibility barriers under ADA Title II — remediation required'},
      ]});
  }
  if(geoGap>15){
    findings.push({id:'geo-gap',rewriteAvailable:false,
      title:`Geographic Completion Gap — Rural Areas ${ruralCompletion.toFixed(0)}% vs Urban ${urbanCompletion.toFixed(0)}% Completion (Infrastructure Bias)`,
      severity:'MEDIUM',
      metrics:[
        {label:'Urban Completion',value:fmtPct(urbanCompletion/100,1)},
        {label:'Rural Completion',value:fmtPct(ruralCompletion/100,1)},
        {label:'Gap',value:`-${geoGap.toFixed(0)}pp`},
        {label:'Likely Cause',value:'Internet speed + digital literacy gap'},
      ],
      legalBasis:[{name:'EO 14058',citation:'Federal services must be accessible to rural citizens; geographic completion gaps indicate infrastructure dependency that Federal UX standards require addressing with offline/phone alternatives'}]});
  }

  return{score,grade:grade(score),ageGap,elderlyCompletion,youngCompletion,elderlyError,overallError,nonEngError,langCompletionGap,engCompletion,nonEngCompletion,deviceGap,desktopCompletion,mobileCompletion,geoGap,urbanCompletion,ruralCompletion,totalRequests:data.length,findings};
}

export default function PublicServiceDashboard(){
  const[results,setResults]=useState(null);
  const[loading,setLoading]=useState(false);
  const[rewriteOpen,setRewriteOpen]=useState(false);
  const[rewriteData,setRewriteData]=useState(null);

  const loadDemo=()=>{setLoading(true);setTimeout(()=>{setResults(analyzePublicService(PUBLIC_SERVICE_DEMO));setLoading(false);},800);};
  const handleCSV=(rows,err)=>{
    if(err) return;
    setResults(analyzePublicService(rows));
  };

  const openRectify=()=>{
    const r=results;
    const original=`CURRENT SERVICE DELIVERY:\n• Web-only digital service — no phone/in-person alternatives\n• English-only interface — no translated content\n• Desktop-optimized — mobile completion ${r.mobileCompletion.toFixed(0)}%\n• WCAG compliance: unknown — elderly error rate ${fmtPct(r.elderlyError)}\n• Error messages: technical language, no accessibility checks performed`;
    const rewritten=`MULTI-CHANNEL ACCESSIBLE SERVICE DESIGN:\n\n1. PLAIN LANGUAGE FORM REWRITE (AI-assisted)\n   • All forms rewritten at 6th grade reading level\n   • Error messages: specific, actionable, non-technical\n   • Example: "Invalid input" → "Please enter your date of birth as MM/DD/YYYY (e.g., 04/15/1958)"\n\n2. MULTI-CHANNEL DELIVERY PLAN\n   • Web (primary): accessible, mobile-first design\n   • Phone: toll-free number with live agent + IVR completion option\n   • In-person: designated assist stations at public libraries and community centers\n   • Mail: paper form option for all services\n\n3. MULTILINGUAL CONTENT DELIVERY\n   • All service interfaces available in top 5 community languages\n   • Auto-detect browser language, offer translated version\n   • Translated error messages and help text\n\n4. ACCESSIBILITY IMPROVEMENT CHECKLIST (WCAG 2.1 AA)\n   • Minimum 4.5:1 color contrast ratio\n   • All form fields have labels (not placeholder-only)\n   • Error indicators: not color-only (icon + text)\n   • Session timeout: minimum 20-minute warning with extension option\n   • Keyboard navigation: all actions completable without mouse`;
    const changes=[
      {action:'Rewrite all forms to 6th grade reading level',original:'Form language: technical/legal → elderly error rate '+fmtPct(r.elderlyError)+', general error rate '+fmtPct(r.overallError),replacement:'Plain language: 6th grade readability target; all error messages specific and actionable',reason:`${fmtPct(r.elderlyError)} elderly error rate vs ${fmtPct(r.overallError)} overall indicates form language is a primary abandonment driver`},
      {action:'Add phone channel option',original:`Completion gap: elderly ${r.elderlyCompletion.toFixed(0)}% — web-only excludes key population`,replacement:'Multi-channel: phone option with live agent for service types with >20pp age completion gap',reason:`${r.ageGap.toFixed(0)}pp elderly completion gap cannot be resolved by UX alone — channel alternatives required under EO 14058`},
    ];
    setRewriteData({original,rewritten,changes});setRewriteOpen(true);
  };

  const chartOpts={legend:'none',vAxis:{format:'#\'%\'',gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}},hAxis:{textStyle:{color:'#64748b',fontSize:10}},chartArea:{left:48,right:8,top:8,bottom:48},backgroundColor:'transparent',annotations:{alwaysOutside:true,textStyle:{fontSize:11,bold:true}},bar:{groupWidth:'60%'}};

  if(!results){
    return(
      <UploadOrDemo
        title="Public Service Access Fairness"
        description="Audit digital public service accessibility — age-based digital divide, language exclusion, mobile-only gaps, error rate design biases, and geographic infrastructure disparities."
        icon="admin_panel_settings"
        iconColor="#3b82f6"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 600 Service Requests"
        columns={CSV_COLUMNS}
        loading={loading}
      />
    );
  }

  const ageData=[['Group','Completion Rate (%)',{role:'style'},{role:'annotation'}],
    ['Under 45',+results.youngCompletion.toFixed(1),'#22c55e',results.youngCompletion.toFixed(0)+'%'],
    ['45-64',+(avg(PUBLIC_SERVICE_DEMO.filter(d=>d.age>=45&&d.age<65).map(d=>d.completion_rate_pct))).toFixed(1),'#3b82f6',''],
    ['65+',+results.elderlyCompletion.toFixed(1),'#ef4444',results.elderlyCompletion.toFixed(0)+'%'],
  ];
  const langData=[['Language','Completion Rate (%)',{role:'style'},{role:'annotation'}],
    ['English',+results.engCompletion.toFixed(1),'#22c55e',results.engCompletion.toFixed(0)+'%'],
    ['Non-English',+results.nonEngCompletion.toFixed(1),'#ef4444',results.nonEngCompletion.toFixed(0)+'%'],
  ];
  const deviceData=[['Device','Completion Rate (%)',{role:'style'},{role:'annotation'}],
    ['Desktop',+results.desktopCompletion.toFixed(1),'#22c55e',results.desktopCompletion.toFixed(0)+'%'],
    ['Mobile-Only',+results.mobileCompletion.toFixed(1),'#ef4444',results.mobileCompletion.toFixed(0)+'%'],
  ];
  const geoData=[['ZIP Type','Completion Rate (%)',{role:'style'},{role:'annotation'}],
    ['Urban',+results.urbanCompletion.toFixed(1),'#6366f1',results.urbanCompletion.toFixed(0)+'%'],
    ['Rural',+results.ruralCompletion.toFixed(1),'#f59e0b',results.ruralCompletion.toFixed(0)+'%'],
  ];

  return(<div style={{maxWidth:'1200px',margin:'0 auto',padding:'32px 20px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px',flexWrap:'wrap',gap:'16px'}}>
      <div>
        <h1 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:'800',color:'#0f172a'}}>Public Service Access Results</h1>
        <div style={{fontSize:'13px',color:'#64748b'}}>{results.totalRequests} service requests analyzed · {results.findings.length} findings</div>
      </div>
      <button onClick={loadDemo} style={{padding:'8px 16px',backgroundColor:'#f1f5f9',color:'#0f172a',border:'1px solid #e2e8f0',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'600',display:'flex',alignItems:'center',gap:'6px'}}>
        <span className="material-icons-round" style={{fontSize:'16px'}}>refresh</span>Reset
      </button>
    </div>

    <div style={{display:'flex',gap:'20px',marginBottom:'32px',flexWrap:'wrap',alignItems:'stretch'}}>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',padding:'24px',border:'1px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:'180px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <BiasScoreGauge score={results.score} grade={results.grade} size={120}/>
        <div style={{fontSize:'13px',color:'#64748b',marginTop:'8px',fontWeight:'600'}}>Fairness Score</div>
      </div>
      <div style={{flex:1,display:'flex',gap:'16px',flexWrap:'wrap'}}>
        <MetricCard label="Age Completion Gap" value={`-${results.ageGap.toFixed(0)}pp`} sub={`65+ ${results.elderlyCompletion.toFixed(0)}% vs under-45 ${results.youngCompletion.toFixed(0)}%`} color="#ef4444" icon="elderly"/>
        <MetricCard label="Language Gap" value={`-${results.langCompletionGap.toFixed(0)}pp`} sub={`Non-English ${results.nonEngCompletion.toFixed(0)}% vs English ${results.engCompletion.toFixed(0)}%`} color="#ef4444" icon="translate"/>
        <MetricCard label="Device Gap" value={`-${results.deviceGap.toFixed(0)}pp`} sub={`Mobile-only ${results.mobileCompletion.toFixed(0)}% vs desktop ${results.desktopCompletion.toFixed(0)}%`} color={results.deviceGap>28?'#ef4444':'#f59e0b'} icon="smartphone"/>
        <MetricCard label="Error Rate Gap" value={`+${fmtPct(results.elderlyError-results.overallError)}`} sub={`Elderly ${fmtPct(results.elderlyError)} vs overall ${fmtPct(results.overallError)}`} color={results.elderlyError>0.22?'#ef4444':'#f59e0b'} icon="error"/>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'32px'}}>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Completion Rate by Age Group</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Same services — age-based completion gap = digital exclusion</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={ageData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Completion Rate by Language</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Language access failure — Title VI threshold: &gt;20pp gap = flag</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={langData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Completion Rate by Device Type</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Mobile-only = low-SES/minority proxy — 30pp gap triggers equity review</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={deviceData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Completion Rate by ZIP Type</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Rural infrastructure deficit creates geographic completion inequity</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={geoData} options={chartOpts}/>
      </div>
    </div>

    <h2 style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'16px'}}>Findings</h2>
    {results.findings.map(f=>(<FindingCard key={f.id} title={f.title} severity={f.severity} metrics={f.metrics} legalBasis={f.legalBasis} rewriteAvailable={f.rewriteAvailable} onRectifyClick={openRectify}/>))}
    {rewriteOpen&&rewriteData&&(<RewriteModal isOpen={rewriteOpen} onClose={()=>setRewriteOpen(false)} onAccept={()=>setRewriteOpen(false)} originalContent={rewriteData.original} rewrittenContent={rewriteData.rewritten} changesApplied={rewriteData.changes}/>)}
  </div>);
}
