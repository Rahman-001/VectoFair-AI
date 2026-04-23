import React, { useState } from 'react';
import { Chart } from 'react-google-charts';
import { BENEFITS_DEMO } from '../data/benefitsDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';

const CSV_COLUMNS = [
  { name:'application_id',       type:'string' },
  { name:'meets_eligibility',    type:'0/1',    note:'1=meets criteria' },
  { name:'approved',             type:'0/1' },
  { name:'processing_time_days', type:'number' },
  { name:'appeal_filed',         type:'0/1' },
  { name:'appeal_outcome',       type:'string', note:'approved/denied' },
  { name:'race',                 type:'string', sensitive:true },
  { name:'is_non_english',       type:'0/1',    sensitive:true },
  { name:'disability_status',    type:'0/1',    sensitive:true },
];


function grade(s){if(s>=80)return'A';if(s>=65)return'B';if(s>=50)return'C';if(s>=35)return'D';return'F';}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function fmtPct(n,d=0){return(n*100).toFixed(d)+'%';}
function fmtDays(n){return n.toFixed(1)+' days';}

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

function analyzeBenefits(data){
  const groupBy=(arr,key)=>{const m={};for(const r of arr){const k=r[key]??'Unknown';if(!m[k])m[k]=[];m[k].push(r);}return m;};

  const eligible=data.filter(d=>d.meets_eligibility===1);
  const byRaceEl=groupBy(eligible,'race');
  const approvalByRace={};
  for(const[race,pts]of Object.entries(byRaceEl)){if(pts.length>=5)approvalByRace[race]=avg(pts.map(p=>p.approved));}
  const whiteRate=approvalByRace['White']??0;
  const blackRate=approvalByRace['Black']??0;
  const racialGap=whiteRate-blackRate;

  const byLanguage=groupBy(data,'is_non_english');
  const engPts=byLanguage['0']||[];
  const nonEngPts=byLanguage['1']||[];
  const engDenial=1-avg(engPts.map(p=>p.approved));
  const nonEngDenial=1-avg(nonEngPts.map(p=>p.approved));
  const langDenialGap=nonEngDenial-engDenial;
  const engProcessing=avg(engPts.map(p=>p.processing_time_days));
  const nonEngProcessing=avg(nonEngPts.map(p=>p.processing_time_days));
  const langProcessingGap=nonEngProcessing-engProcessing;

  const byDisability=groupBy(data,'disability_status');
  const disProcessing=avg((byDisability['1']||[]).map(p=>p.processing_time_days));
  const nonDisProcessing=avg((byDisability['0']||[]).map(p=>p.processing_time_days));
  const disProcessingGap=disProcessing-nonDisProcessing;

  const appeals=data.filter(d=>d.appeal_filed===1);
  const byRaceAppeals=groupBy(appeals,'race');
  const appealSuccessByRace={};
  for(const[race,pts]of Object.entries(byRaceAppeals)){
    if(pts.length>=3)appealSuccessByRace[race]=pts.filter(p=>p.appeal_outcome==='approved').length/pts.length;
  }
  const whiteAppealSuccess=appealSuccessByRace['White']??0;
  const minorityAppealSuccess=avg(Object.entries(appealSuccessByRace).filter(([r])=>r!=='White').map(([,v])=>v));
  const appealGap=whiteAppealSuccess-minorityAppealSuccess;

  const byRaceAll=groupBy(data,'race');
  const processingByRace={};
  for(const[race,pts]of Object.entries(byRaceAll)){if(pts.length>=5)processingByRace[race]=avg(pts.map(p=>p.processing_time_days));}

  let score=100;
  if(langDenialGap>0.18)score-=30;else if(langDenialGap>0.10)score-=18;
  if(racialGap>0.14)score-=25;else if(racialGap>0.08)score-=15;
  if(appealGap>0.20)score-=22;else if(appealGap>0.12)score-=13;
  if(langProcessingGap>10)score-=15;else if(langProcessingGap>6)score-=9;
  if(disProcessingGap>6)score-=8;else if(disProcessingGap>3)score-=4;
  score=Math.max(0,Math.min(100,Math.round(score)));

  const findings=[];
  if(langDenialGap>0.12){
    findings.push({id:'language-barrier',rewriteAvailable:true,
      title:`Language Access Failure — Non-English Applicants: ${fmtPct(nonEngDenial)} Denial Rate vs ${fmtPct(engDenial)} English, Processing +${langProcessingGap.toFixed(1)} Days`,
      severity:langDenialGap>0.18?'SEVERE':'HIGH',
      metrics:[
        {label:'Non-English Denial Rate',value:fmtPct(nonEngDenial)},
        {label:'English Denial Rate',value:fmtPct(engDenial)},
        {label:'Denial Gap',value:`+${fmtPct(langDenialGap)}`},
        {label:'Processing Time Gap',value:`+${langProcessingGap.toFixed(1)} days`},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Title VI Civil Rights Act — language access failure in federally funded benefit programs constitutes national origin discrimination; 22% excess denial rate is actionable'},
        {name:'EO 13166',citation:'Executive Order 13166 — Improving Access for Limited English Proficiency; federal agencies must provide meaningful access to programs regardless of English proficiency'},
        {name:'ADA Title II',citation:'ADA Title II — government services must be accessible to all eligible recipients; language barriers creating 12-day processing delays and higher denial rates constitute access failure'},
      ]});
  }
  if(racialGap>0.10){
    findings.push({id:'racial-approval-gap',rewriteAvailable:true,
      title:`Racial Approval Gap — Black Applicants Approved at ${fmtPct(blackRate)} vs White ${fmtPct(whiteRate)} (Eligibility-Controlled)`,
      severity:racialGap>0.14?'HIGH':'MEDIUM',
      metrics:[
        {label:'White Approval Rate (eligible only)',value:fmtPct(whiteRate)},
        {label:'Black Approval Rate (eligible only)',value:fmtPct(blackRate)},
        {label:'Gap',value:`-${fmtPct(racialGap)}`},
        {label:'Control',value:'Eligibility score ≥ 55 only'},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Title VI — racial approval rate gap in federally funded benefit programs after controlling for eligibility is prohibited discriminatory treatment'},
        {name:'Equal Protection',citation:'14th Amendment — government benefit allocation that produces racially disparate outcomes without justification triggers strict scrutiny'},
      ]});
  }
  if(appealGap>0.15){
    findings.push({id:'appeal-disparity',rewriteAvailable:true,
      title:`Appeal Success Disparity — White Applicants Win Appeals at ${fmtPct(whiteAppealSuccess)} vs Minority ${fmtPct(minorityAppealSuccess)}`,
      severity:appealGap>0.22?'SEVERE':'HIGH',
      metrics:[
        {label:'White Appeal Success',value:fmtPct(whiteAppealSuccess)},
        {label:'Minority Appeal Success',value:fmtPct(minorityAppealSuccess)},
        {label:'Gap',value:`-${fmtPct(appealGap)}`},
        {label:'Interpretation',value:'Systemically inequitable adjudication'},
      ],
      legalBasis:[
        {name:'Due Process',citation:'Mathews v. Eldridge (1976) — due process requires meaningful opportunity to contest benefit denials; racially disparate appeal outcomes suggest process failure'},
        {name:'14th Amendment',citation:'Equal Protection — racially disparate administrative appeal success rates constitute discriminatory adjudication in government programs'},
      ]});
  }
  if(disProcessingGap>5){
    findings.push({id:'disability-processing',rewriteAvailable:false,
      title:`Disability Processing Delay — Applicants with Disabilities Wait ${disProcessingGap.toFixed(1)} Days Longer for Same Benefit Decision`,
      severity:disProcessingGap>8?'HIGH':'MEDIUM',
      metrics:[
        {label:'Disability Avg Processing',value:fmtDays(disProcessing)},
        {label:'Non-Disability Avg',value:fmtDays(nonDisProcessing)},
        {label:'Gap',value:`+${fmtDays(disProcessingGap)}`},
        {label:'Legal Standard',value:'ADA Title II requires equitable processing'},
      ],
      legalBasis:[{name:'ADA Title II',citation:'ADA Title II — government agencies must ensure that disability status does not create processing delays or additional barriers to benefit access'},
        {name:'Section 504',citation:'Section 504 Rehabilitation Act — federally funded benefit programs must provide equitable access regardless of disability status'}]});
  }

  return{score,grade:grade(score),racialGap,whiteRate,blackRate,approvalByRace,langDenialGap,langProcessingGap,engDenial,nonEngDenial,engProcessing,nonEngProcessing,appealGap,whiteAppealSuccess,minorityAppealSuccess,appealSuccessByRace,disProcessingGap,disProcessing,nonDisProcessing,processingByRace,totalApplications:data.length,findings};
}

export default function BenefitsDashboard(){
  const[results,setResults]=useState(null);
  const[loading,setLoading]=useState(false);
  const[rewriteOpen,setRewriteOpen]=useState(false);
  const[rewriteData,setRewriteData]=useState(null);

  const loadDemo=()=>{setLoading(true);setTimeout(()=>{setResults(analyzeBenefits(BENEFITS_DEMO));setLoading(false);},800);};
  const handleCSV=(rows,err)=>{
    if(err) return;
    setResults(analyzeBenefits(rows));
  };

  const openRectify=()=>{
    const r=results;
    const original=`CURRENT BENEFIT ADMINISTRATION:\n• Language access: no mandatory interpreter at intake\n• Processing: non-English applicants wait +${r.langProcessingGap.toFixed(0)} days longer\n• Approval rate gap: ${fmtPct(r.racialGap)} racial disparity after eligibility control\n• Appeal adjudication: ${fmtPct(r.appealGap)} White vs minority success gap\n• Denial letters: complex legal language, discourages valid appeals`;
    const rewritten=`EQUITABLE BENEFIT ADMINISTRATION PLAN:\n\n1. LANGUAGE ACCESS IMPLEMENTATION\n   • Certified interpreter at all intake appointments (in-person + phone)\n   • Translated Application forms in top 5 languages: Spanish, Mandarin, Arabic, Vietnamese, Tagalog\n   • Multilingual web portal with application wizard\n   • Same-day phone interpretation service (target: < 10 min wait)\n\n2. PROCESSING EQUITY PROTOCOL\n   • Processing time equity monitoring: flag if any demographic group waits >3 days longer\n   • Designated case managers for disability and LEP applicants\n   • Dual-track review: complex cases (LEP, disability) get parallel support track\n\n3. APPEAL STANDARDIZATION\n   • Structured appeal review rubric — criteria-based, not adjudicator-discretion\n   • Blind appeal review: name, race, language removed before panel review\n   • Plain-language denial letters (6th grade reading level)\n   • Appeal outcome audit: quarterly by demographic — required remediation if gap >15%`;
    const changes=[
      {action:'Mandatory interpreter at intake',original:`Non-English denial rate: ${fmtPct(r.nonEngDenial)} (+${fmtPct(r.langDenialGap)} vs English)`,replacement:'Interpreter required at all intake appointments; translated forms provided; digital application in 5 languages',reason:`${fmtPct(r.langDenialGap)} excess denial rate and ${r.langProcessingGap.toFixed(0)}-day processing delay for non-English applicants = Title VI violation`},
      {action:'Structured blind appeal review',original:`Appeal success: White ${fmtPct(r.whiteAppealSuccess)} vs minority ${fmtPct(r.minorityAppealSuccess)} — ${fmtPct(r.appealGap)} gap`,replacement:'Criteria-based rubric; name/race removed; quarterly demographic audit of appeal outcomes',reason:`${fmtPct(r.appealGap)} appeal success gap constitutes discriminatory adjudication under Mathews v. Eldridge due process standards`},
    ];
    setRewriteData({original,rewritten,changes});setRewriteOpen(true);
  };

  const chartOpts={legend:'none',vAxis:{format:'#\'%\'',gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}},hAxis:{textStyle:{color:'#64748b',fontSize:10}},chartArea:{left:48,right:8,top:8,bottom:48},backgroundColor:'transparent',annotations:{alwaysOutside:true,textStyle:{fontSize:11,bold:true}},bar:{groupWidth:'60%'}};

  if(!results){
    return(
      <UploadOrDemo
        title="Government Benefit Allocation Audit"
        description="Detect disparities in benefit approval rates, processing times, appeal outcomes, and language access failures across government assistance programs."
        icon="assured_workload"
        iconColor="#8b5cf6"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 500 Applications"
        columns={CSV_COLUMNS}
        loading={loading}
      />
    );
  }

  const approvalRaceData=[['Race','Approval Rate (%)',{role:'style'},{role:'annotation'}],...Object.entries(results.approvalByRace).map(([r,v])=>[r,+(v*100).toFixed(1),r==='White'?'#22c55e':r==='Asian'?'#3b82f6':r==='Hispanic'?'#f59e0b':'#ef4444',fmtPct(v)])];
  const languageData=[['Group','Denial Rate (%)',{role:'style'},{role:'annotation'}],['English Speakers',+(results.engDenial*100).toFixed(1),'#22c55e',fmtPct(results.engDenial)],['Non-English Speakers',+(results.nonEngDenial*100).toFixed(1),'#ef4444',fmtPct(results.nonEngDenial)]];
  const appealData=[['Race','Appeal Success Rate (%)',{role:'style'},{role:'annotation'}],...Object.entries(results.appealSuccessByRace).map(([r,v])=>[r,+(v*100).toFixed(1),r==='White'?'#22c55e':'#ef4444',fmtPct(v)])];
  const processingData=[['Race','Avg Processing Time (days)',{role:'style'},{role:'annotation'}],...Object.entries(results.processingByRace).map(([r,v])=>[r,+v.toFixed(1),r==='White'?'#22c55e':r==='Asian'?'#3b82f6':r==='Hispanic'?'#f59e0b':'#ef4444',v.toFixed(1)+' days'])];

  return(<div style={{maxWidth:'1200px',margin:'0 auto',padding:'32px 20px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px',flexWrap:'wrap',gap:'16px'}}>
      <div>
        <h1 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:'800',color:'#0f172a'}}>Government Benefit Allocation Results</h1>
        <div style={{fontSize:'13px',color:'#64748b'}}>{results.totalApplications} applications analyzed · {results.findings.length} findings</div>
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
        <MetricCard label="Language Denial Gap" value={`+${fmtPct(results.langDenialGap)}`} sub="Non-English vs English denial rate" color="#ef4444" icon="translate"/>
        <MetricCard label="Racial Approval Gap" value={`-${fmtPct(results.racialGap)}`} sub="Black vs White (eligibility-controlled)" color="#ef4444" icon="how_to_reg"/>
        <MetricCard label="Appeal Disparity" value={`-${fmtPct(results.appealGap)}`} sub="Minority vs White appeal success" color={results.appealGap>0.20?'#ef4444':'#f59e0b'} icon="gavel"/>
        <MetricCard label="Language Wait Gap" value={`+${results.langProcessingGap.toFixed(1)} days`} sub="Non-English processing delay" color={results.langProcessingGap>10?'#ef4444':'#f59e0b'} icon="schedule"/>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'32px'}}>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Approval Rate by Race (Eligibility-Controlled)</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Eligible applicants only — controls for need level and eligibility score</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={approvalRaceData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Denial Rate by Language</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Language access failure is a Title VI violation when gap &gt;10%</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={languageData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Appeal Success Rate by Race</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Among applicants who filed an appeal — equal adjudication requires similar success rates</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={appealData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Average Processing Time by Race</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Longer wait = delayed assistance = documented economic harm</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={processingData}
          options={{...chartOpts,vAxis:{format:'#\' days\'',gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}}}}/>
      </div>
    </div>

    <h2 style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'16px'}}>Findings</h2>
    {results.findings.map(f=>(<FindingCard key={f.id} title={f.title} severity={f.severity} metrics={f.metrics} legalBasis={f.legalBasis} rewriteAvailable={f.rewriteAvailable} onRectifyClick={openRectify}/>))}
    {rewriteOpen&&rewriteData&&(<RewriteModal isOpen={rewriteOpen} onClose={()=>setRewriteOpen(false)} onAccept={()=>setRewriteOpen(false)} originalContent={rewriteData.original} rewrittenContent={rewriteData.rewritten} changesApplied={rewriteData.changes}/>)}
  </div>);
}
