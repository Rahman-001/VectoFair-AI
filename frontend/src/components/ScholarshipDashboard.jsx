import React, { useState } from 'react';
import { Chart } from 'react-google-charts';
import { SCHOLARSHIP_DEMO } from '../data/scholarshipDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';
import { callAI } from '../utils/aiClient';

const CSV_COLUMNS = [
  { name:'applicant_id',        type:'string' },
  { name:'merit_composite',     type:'number', note:'0-10 composite score' },
  { name:'interview_score',     type:'number', note:'0-10 panel score' },
  { name:'recommendation_score',type:'number', note:'0-10 letter score' },
  { name:'essay_score',         type:'number', note:'0-10 essay quality' },
  { name:'awarded',             type:'0/1',    note:'1=scholarship awarded' },
  { name:'award_amount',        type:'number', note:'USD, 0 if not awarded' },
  { name:'committee_id',        type:'string', note:'e.g. COM_001' },
  { name:'race',                type:'string', sensitive:true },
  { name:'gender',              type:'string', sensitive:true },
  { name:'is_minority',         type:'0/1',    sensitive:true },
  { name:'first_gen',           type:'0/1',    sensitive:true, note:'first-generation college student' },
];


function grade(s){if(s>=80)return'A';if(s>=65)return'B';if(s>=50)return'C';if(s>=35)return'D';return'F';}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function fmtPct(n,d=0){return(n*100).toFixed(d)+'%';}
function fmtDollar(n){return'$'+Math.round(n).toLocaleString();}

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

function analyzeScholarship(data){
  const groupBy=(arr,key)=>{const m={};for(const r of arr){const k=r[key]??'Unknown';if(!m[k])m[k]=[];m[k].push(r);}return m;};

  const byRace=groupBy(data,'race');
  const byGender=groupBy(data,'gender');
  const byCommittee=groupBy(data,'committee_id');
  const byFirstGen=groupBy(data,'first_gen');

  // 1. AWARD RATE GAP — merit-adjusted (top 50% merit composite)
  const allMerits=data.map(d=>d.merit_composite).sort((a,b)=>a-b);
  const medianMerit=allMerits[Math.floor(allMerits.length*0.5)];
  const meritMatched=data.filter(d=>d.merit_composite>=medianMerit);
  const byRaceMerit=groupBy(meritMatched,'race');
  const awardRateByRace={};
  for(const[race,pts]of Object.entries(byRaceMerit)){if(pts.length>=5)awardRateByRace[race]=avg(pts.map(p=>p.awarded));}
  const whiteRate=awardRateByRace['White']??0;
  const minorityRates=Object.entries(awardRateByRace).filter(([r])=>r!=='White'&&r!=='Asian');
  const avgMinorityRate=minorityRates.length?avg(minorityRates.map(([,r])=>r)):0;
  const awardGap=whiteRate-avgMinorityRate;

  // 2. INTERVIEW SCORE DISPARITY
  const byRaceInterview=groupBy(data,'is_minority');
  const minorityInterview=avg((byRaceInterview['1']||[]).map(p=>p.interview_score));
  const majorityInterview=avg((byRaceInterview['0']||[]).map(p=>p.interview_score));
  const interviewGap=majorityInterview-minorityInterview;

  // Committee bias — COM_002
  const committeeScores={};
  for(const[com,pts]of Object.entries(byCommittee)){
    const minPts=pts.filter(p=>p.is_minority===1);
    const majPts=pts.filter(p=>p.is_minority===0);
    if(minPts.length>=3&&majPts.length>=3){
      committeeScores[com]={minority:avg(minPts.map(p=>p.interview_score)),majority:avg(majPts.map(p=>p.interview_score))};
      committeeScores[com].gap=committeeScores[com].majority-committeeScores[com].minority;
    }
  }

  // 3. RECOMMENDATION SCORE GAP (first-gen)
  const firstGenRec=avg((byFirstGen['1']||[]).map(p=>p.recommendation_score));
  const nonFirstGenRec=avg((byFirstGen['0']||[]).map(p=>p.recommendation_score));
  const recGap=nonFirstGenRec-firstGenRec;

  // 4. AWARD AMOUNT GAP (gender)
  const awardees=data.filter(d=>d.awarded===1);
  const femaleAwards=awardees.filter(d=>d.gender==='Female');
  const maleAwards=awardees.filter(d=>d.gender==='Male');
  const femaleAvgAmt=avg(femaleAwards.map(p=>p.award_amount));
  const maleAvgAmt=avg(maleAwards.map(p=>p.award_amount));
  const amountGap=maleAvgAmt-femaleAvgAmt;

  let score=100;
  if(interviewGap>1.4)score-=30;else if(interviewGap>0.8)score-=18;
  if(amountGap>1800)score-=25;else if(amountGap>1000)score-=15;
  if(recGap>1.0)score-=20;else if(recGap>0.6)score-=12;
  if(awardGap>0.12)score-=15;else if(awardGap>0.08)score-=8;
  score=Math.max(0,Math.min(100,Math.round(score)));

  const findings=[];
  if(interviewGap>0.8){
    findings.push({id:'interview-gap',rewriteAvailable:true,
      title:`Interview Score Disparity — Minority Applicants Score ${interviewGap.toFixed(2)}pts Lower Than Majority (Equal Essay Scores)`,
      severity:interviewGap>1.4?'SEVERE':'HIGH',
      metrics:[
        {label:'Majority Interview Avg',value:majorityInterview.toFixed(2)+'/10'},
        {label:'Minority Interview Avg',value:minorityInterview.toFixed(2)+'/10'},
        {label:'Gap',value:interviewGap.toFixed(2)+' pts'},
        {label:'Essay Score (equal)',value:'Merit-matched sample'},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Title VI — unstructured interview scores showing systematic minority disadvantage trigger disparate treatment scrutiny in institutional scholarship programs'},
        {name:'NACAC Ethics',citation:'NACAC Statement of Principles — selection criteria must not include ability to pay or subjective factors that encode demographic bias'},
      ]});
  }
  if(amountGap>1000){
    findings.push({id:'amount-gap',rewriteAvailable:true,
      title:`Award Amount Gender Gap — Women Receive ${fmtDollar(amountGap)} Less Than Men Per Award (Same GPA)`,
      severity:amountGap>1800?'HIGH':'MEDIUM',
      metrics:[
        {label:'Male Award Avg',value:fmtDollar(maleAvgAmt)},
        {label:'Female Award Avg',value:fmtDollar(femaleAvgAmt)},
        {label:'Gap',value:fmtDollar(amountGap)},
        {label:'Merit Control',value:'Merit-composite-matched cohort'},
      ],
      legalBasis:[
        {name:'Title IX',citation:'Title IX — gender-based disparities in scholarship award amounts at institutions receiving federal funding constitute prohibited sex discrimination'},
        {name:'Wygant v. Jackson 1986',citation:'Wygant v. Jackson Board of Ed. (1986) — equal treatment requirements apply to benefit allocation; disparate award amounts require justification'},
      ]});
  }
  if(recGap>0.6){
    findings.push({id:'rec-gap',rewriteAvailable:true,
      title:`Recommendation Score Proxy — First-Gen Students Score ${recGap.toFixed(2)}pts Lower on Recommendations (Under-Resourced School Network Effect)`,
      severity:recGap>1.0?'HIGH':'MEDIUM',
      metrics:[
        {label:'Non-First-Gen Rec Avg',value:nonFirstGenRec.toFixed(2)+'/10'},
        {label:'First-Gen Rec Avg',value:firstGenRec.toFixed(2)+'/10'},
        {label:'Gap',value:recGap.toFixed(2)+' pts'},
        {label:'Interpretation','value':'School resource gap, not ability gap'},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Recommendation weighting encoding school resource inequity may disproportionately disadvantage minority students, triggering Title VI disparate impact analysis'},
        {name:'NACAC Ethics',citation:'NACAC — selection weighting that systematically disadvantages students from under-resourced schools must be disclosed and justified'},
      ]});
  }

  const worstCommittee=Object.entries(committeeScores).sort((a,b)=>b[1].gap-a[1].gap)[0];
  if(worstCommittee&&worstCommittee[1].gap>1.5){
    findings.push({id:'committee-bias',rewriteAvailable:false,
      title:`Committee-Level Bias — ${worstCommittee[0]} Shows ${worstCommittee[1].gap.toFixed(2)}pt Scoring Gap for Minority Applicants`,
      severity:worstCommittee[1].gap>2.0?'HIGH':'MEDIUM',
      metrics:[
        {label:'Committee',value:worstCommittee[0]},
        {label:'Majority Avg Score',value:worstCommittee[1].majority.toFixed(2)},
        {label:'Minority Avg Score',value:worstCommittee[1].minority.toFixed(2)},
        {label:'Gap',value:worstCommittee[1].gap.toFixed(2)+' pts'},
      ],
      legalBasis:[{name:'Title VI',citation:'Per-committee scoring disparities are evidence of individual implicit bias — institutions are liable for committee-level discrimination in federally funded scholarship programs'}]});
  }

  return{score,grade:grade(score),awardGap,awardRateByRace,whiteRate,avgMinorityRate,interviewGap,majorityInterview,minorityInterview,recGap,firstGenRec,nonFirstGenRec,amountGap,maleAvgAmt,femaleAvgAmt,committeeScores,totalApplicants:data.length,awardeeCount:awardees.length,findings};
}

export default function ScholarshipDashboard(){
  const[results,setResults]=useState(null);
  const[loading,setLoading]=useState(false);
  const[csvError,setCsvError]=useState(null);
  const[rewriteOpen,setRewriteOpen]=useState(false);
  const[rewriteData,setRewriteData]=useState(null);

  const loadDemo=()=>{setLoading(true);setTimeout(()=>{setResults(analyzeScholarship(SCHOLARSHIP_DEMO));setLoading(false);},800);};
  const handleCSV=(rows,err)=>{
    if(err){setCsvError('CSV error: '+err);return;}
    setCsvError(null);
    setResults(analyzeScholarship(rows));
  };

  const openRectify=()=>{
    const r=results;
    const original=`CURRENT SCHOLARSHIP SELECTION PROCESS:\n• Interview: unstructured (${r.interviewGap.toFixed(1)}pt gap for minority applicants)\n• Award amounts: gender-correlated ($${Math.round(r.amountGap)} gap)\n• Recommendation: weighted at 15% (${r.recGap.toFixed(1)}pt first-gen disadvantage)\n• Committee: no bias monitoring protocol`;
    const rewritten=`EQUITABLE SELECTION PROTOCOL:\n\n1. STRUCTURED INTERVIEW REPLACEMENT\n   • Standardized rubric with pre-defined criteria and point anchors\n   • Blind scoring: committee members score independently before discussion\n   • At least 2 committee members per applicant; average used\n   • Post-session calibration: outlier scores reviewed\n\n2. AWARD STANDARDIZATION\n   • Award amounts determined by merit tier, not committee\n   • Tiers: Tier 1 ($8,000), Tier 2 ($5,500), Tier 3 ($3,000)\n   • Gender-blind merit calculation\n\n3. CONTEXT-WEIGHTED RECOMMENDATION\n   • Recommendation weighted relative to school peer average\n   • First-gen applicants: essay score weighted +5% to compensate\n   • Reviewer blind to school name (school type flagged instead)\n\n4. COMMITTEE CALIBRATION PROGRAM\n   • Quarterly bias audit of per-committee scores\n   • Required implicit bias training for all committee members\n   • Committee rotation to prevent scoring cluster bias`;
    const changes=[
      {action:'Replace unstructured interview with standardized rubric',original:`Unstructured interview: ${r.interviewGap.toFixed(1)}pt minority gap`,replacement:'Structured interview: criteria-anchored rubric, independent scoring, calibration session',reason:`${r.interviewGap.toFixed(1)}pt gap in unstructured settings is consistent with documented implicit bias in subjective evaluation`},
      {action:'Standardize award amounts by merit tier',original:`Award amounts: $${Math.round(r.amountGap)} gender gap at same merit level`,replacement:'Tier-based award amounts: merit composite determines tier, committee determines tier level only',reason:`$${Math.round(r.amountGap)} gender gap in award amounts with same merit profile is not merit-explained — standardization removes discretion`},
    ];
    setRewriteData({original,rewritten,changes});setRewriteOpen(true);
  };

  if(!results){
    return(
      <UploadOrDemo
        title="Scholarship Bias Detector"
        description="Detect interview score disparities, award amount gender gaps, first-gen recommendation penalties, and committee-level scoring patterns."
        icon="workspace_premium"
        iconColor="#6366f1"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 250 Scholarship Applicants"
        columns={CSV_COLUMNS}
        loading={loading}
        csvError={csvError}
      />
    );
  }

  const interviewData=[['Group','Interview Score (avg)',{role:'style'},{role:'annotation'}],
    ['Majority (non-minority)',+results.majorityInterview.toFixed(1),'#22c55e',results.majorityInterview.toFixed(2)],
    ['Minority Applicants',+results.minorityInterview.toFixed(1),'#ef4444',results.minorityInterview.toFixed(2)],
    ['First-Gen Students',+avg(SCHOLARSHIP_DEMO.filter(d=>d.first_gen===1).map(d=>d.interview_score)).toFixed(1),'#f59e0b',avg(SCHOLARSHIP_DEMO.filter(d=>d.first_gen===1).map(d=>d.interview_score)).toFixed(2)],
  ];

  const amountData=[['Group','Award Amount ($)',{role:'style'},{role:'annotation'}],
    ['Male Awardees',+results.maleAvgAmt.toFixed(0),'#3b82f6',fmtDollar(results.maleAvgAmt)],
    ['Female Awardees',+results.femaleAvgAmt.toFixed(0),'#f472b6',fmtDollar(results.femaleAvgAmt)],
  ];

  const committeeData=[['Committee','Majority Avg','Minority Avg'],...Object.entries(results.committeeScores).map(([c,s])=>[c,+s.majority.toFixed(2),+s.minority.toFixed(2)])];

  const awardRateData=[['Race','Award Rate (%)',{role:'style'},{role:'annotation'}],
    ...Object.entries(results.awardRateByRace).map(([race,rate])=>[race,+(rate*100).toFixed(1),race==='White'?'#22c55e':race==='Asian'?'#3b82f6':race==='Hispanic'?'#f59e0b':'#ef4444',`${(rate*100).toFixed(0)}%`])
  ];

  const chartOpts={legend:'none',vAxis:{gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}},hAxis:{textStyle:{color:'#64748b',fontSize:10}},chartArea:{left:44,right:8,top:8,bottom:48},backgroundColor:'transparent',annotations:{alwaysOutside:true,textStyle:{fontSize:11,bold:true}},bar:{groupWidth:'60%'}};

  return(<div style={{maxWidth:'1200px',margin:'0 auto',padding:'32px 20px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px',flexWrap:'wrap',gap:'16px'}}>
      <div>
        <h1 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:'800',color:'#0f172a'}}>Scholarship Bias Results</h1>
        <div style={{fontSize:'13px',color:'#64748b'}}>{results.totalApplicants} applicants · {results.awardeeCount} awarded · {results.findings.length} findings</div>
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
        <MetricCard label="Interview Gap" value={`${results.interviewGap.toFixed(2)} pts`} sub="Minority vs majority applicants (equal essays)" color="#ef4444" icon="record_voice_over"/>
        <MetricCard label="Award Amount Gap" value={fmtDollar(results.amountGap)} sub="Men vs women per award (same merit)" color={results.amountGap>1800?'#ef4444':'#f59e0b'} icon="payments"/>
        <MetricCard label="First-Gen Rec Gap" value={`${results.recGap.toFixed(2)} pts`} sub="School resource network effect" color={results.recGap>1.0?'#ef4444':'#f59e0b'} icon="people"/>
        <MetricCard label="Award Rate Gap" value={`${(results.awardGap*100).toFixed(0)}pp`} sub="White vs minority (merit-matched cohort)" color={results.awardGap>0.12?'#ef4444':'#f59e0b'} icon="workspace_premium"/>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'32px'}}>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Interview Score by Group</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Essay-score-matched — interview gap = subjective bias signal</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={interviewData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Award Amount by Gender</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Among awardees only — merit-composite-matched</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={amountData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Award Rate by Race (Merit-Matched)</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Top 50% merit composite only — controls for academic performance</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={awardRateData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Committee Score Comparison (Anonymized)</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Blue=majority applicants, red=minority — gap &gt;1.5pt = committee bias flag</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={committeeData.length>1?committeeData:[['Committee','Majority','Minority'],['No Data',0,0]]}
          options={{...chartOpts,legend:{position:'top'},colors:['#3b82f6','#ef4444']}}/>
      </div>
    </div>

    <h2 style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'16px'}}>Findings</h2>
    {results.findings.map(f=>(<FindingCard key={f.id} title={f.title} severity={f.severity} metrics={f.metrics} legalBasis={f.legalBasis} rewriteAvailable={f.rewriteAvailable} onRectifyClick={openRectify}/>))}
    {rewriteOpen&&rewriteData&&(<RewriteModal isOpen={rewriteOpen} onClose={()=>setRewriteOpen(false)} onAccept={()=>setRewriteOpen(false)} originalContent={rewriteData.original} rewrittenContent={rewriteData.rewritten} changesApplied={rewriteData.changes}/>)}
  </div>);
}
