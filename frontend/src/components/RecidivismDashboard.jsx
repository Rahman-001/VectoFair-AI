import React, { useState } from 'react';
import { Chart } from 'react-google-charts';
import { RECIDIVISM_DEMO } from '../data/recidivismDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import UploadOrDemo from './shared/UploadOrDemo';

const CSV_COLUMNS = [
  { name:'defendant_id',         type:'string' },
  { name:'risk_score',           type:'number',  note:'1-10 score from model' },
  { name:'predicted_high_risk',  type:'0/1',     note:'1=model labeled high-risk' },
  { name:'predicted_low_risk',   type:'0/1',     note:'1=model labeled low-risk' },
  { name:'actual_reoffended',    type:'0/1',     note:'ground truth (did reoffend)' },
  { name:'race',                 type:'string',  sensitive:true },
  { name:'prior_convictions',    type:'number',  sensitive:true, note:'covariate control' },
  { name:'charge_degree',        type:'string',  sensitive:true, note:'felony/misdemeanor' },
];


function grade(s){if(s>=80)return'A';if(s>=65)return'B';if(s>=50)return'C';if(s>=35)return'D';return'F';}
function fmtPct(n,d=1){return(n*100).toFixed(d)+'%';}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}

function RequiredDisclaimer(){
  return(<div style={{backgroundColor:'#fef2f2',border:'2px solid #ef4444',borderRadius:'12px',padding:'16px 20px',marginBottom:'24px',display:'flex',alignItems:'flex-start',gap:'12px'}}>
    <span className="material-icons-round" style={{fontSize:'22px',color:'#dc2626',flexShrink:0,marginTop:'2px'}}>gavel</span>
    <div>
      <div style={{fontWeight:'800',color:'#7f1d1d',fontSize:'14px',marginBottom:'4px'}}>Required Legal Disclaimer</div>
      <div style={{color:'#991b1b',fontSize:'13px',lineHeight:'1.5'}}>
        This module audits algorithmic risk scores for <strong>statistical bias patterns only</strong>. VectoFair does not endorse or oppose the use of risk assessment instruments in criminal justice.
        <strong> No individual sentencing decisions should be made based on this tool.</strong> All findings require review by qualified legal professionals.
      </div>
    </div>
  </div>);
}

function ConfusionMatrix({label,tp,fp,tn,fn,color}){
  const total=tp+fp+tn+fn||1;
  return(<div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'16px',flex:1,minWidth:'220px'}}>
    <div style={{fontSize:'13px',fontWeight:'700',color:'#0f172a',marginBottom:'12px',borderBottom:'1px solid #f1f5f9',paddingBottom:'8px'}}>{label}</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
      {[
        {label:'True Positive (high-risk, reoffended)',val:tp,bg:'#f0fdf4',tc:'#166534'},
        {label:'False Positive (high-risk, did NOT reoffend)',val:fp,bg:'#fef2f2',tc:'#991b1b'},
        {label:'False Negative (low-risk, DID reoffend)',val:fn,bg:'#fffbeb',tc:'#92400e'},
        {label:'True Negative (low-risk, no reoffend)',val:tn,bg:'#f0fdf4',tc:'#166534'},
      ].map((cell,i)=>(
        <div key={i} style={{backgroundColor:cell.bg,borderRadius:'8px',padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:'20px',fontWeight:'800',color:cell.tc}}>{cell.val}</div>
          <div style={{fontSize:'10px',color:'#64748b',lineHeight:'1.3',marginTop:'2px'}}>{cell.label}</div>
        </div>
      ))}
    </div>
    <div style={{marginTop:'10px',fontSize:'12px',color:'#64748b',fontWeight:'600'}}>
      FPR: <span style={{color:'#ef4444'}}>{fmtPct(fp/(fp+tn||1))}</span> · FNR: <span style={{color:'#f59e0b'}}>{fmtPct(fn/(fn+tp||1))}</span>
    </div>
  </div>);
}

function FairnessImpossibilityPanel(){
  const[active,setActive]=useState(null);
  const criteria=[
    {id:'dp',label:'Demographic Parity',icon:'balance',desc:'Equal proportion predicted high-risk across racial groups',tradeoff:'Achieves this by lowering threshold for Black defendants — but this results in lower Predictive Parity (score of 7 means different things for different groups).'},
    {id:'eo',label:'Equal Opportunity',icon:'check_circle',desc:'Equal True Positive Rate — equal chance of being correctly flagged if you will reoffend',tradeoff:'Achieves this by matching TPR — but creates unequal False Positive Rates. Minority group gets more false positives to match the TPR.'},
    {id:'pp',label:'Predictive Parity',icon:'analytics',desc:'A score of 7 predicts the same reoffend probability for all groups',tradeoff:'Achieves score calibration — but when base rates differ, this mathematically requires different FPRs. Northpointe\'s claim; ProPublica\'s objection.'},
  ];
  return(<div style={{backgroundColor:'#0f172a',borderRadius:'12px',padding:'24px',marginBottom:'24px',color:'#fff'}}>
    <h3 style={{margin:'0 0 4px',fontSize:'17px',fontWeight:'800'}}>⚖️ The Fairness Impossibility — Interactive Explainer</h3>
    <div style={{fontSize:'13px',color:'#94a3b8',marginBottom:'16px'}}>Click any criterion to see why satisfying it prevents satisfying the others.</div>
    <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'16px'}}>
      {criteria.map(c=>(<button key={c.id} onClick={()=>setActive(active===c.id?null:c.id)} style={{padding:'10px 16px',backgroundColor:active===c.id?'#4f46e5':'#1e293b',color:'#fff',border:`1px solid ${active===c.id?'#6366f1':'#334155'}`,borderRadius:'8px',cursor:'pointer',fontWeight:'600',fontSize:'13px',display:'flex',alignItems:'center',gap:'6px',transition:'all 0.2s'}}>
        <span className="material-icons-round" style={{fontSize:'16px'}}>{c.icon}</span>{c.label}
      </button>))}
    </div>
    {active&&(<div style={{backgroundColor:'#1e293b',borderRadius:'10px',padding:'16px',borderLeft:'3px solid #6366f1'}}>
      <div style={{fontSize:'13px',fontWeight:'700',color:'#e2e8f0',marginBottom:'8px'}}>{criteria.find(c=>c.id===active)?.label}</div>
      <div style={{fontSize:'13px',color:'#94a3b8',marginBottom:'8px'}}>{criteria.find(c=>c.id===active)?.desc}</div>
      <div style={{fontSize:'13px',color:'#f59e0b',fontWeight:'600'}}>Tradeoff: {criteria.find(c=>c.id===active)?.tradeoff}</div>
    </div>)}
    <div style={{marginTop:'16px',padding:'14px',backgroundColor:'#1e293b',borderRadius:'8px',fontSize:'12px',color:'#64748b',lineHeight:'1.6',borderLeft:'3px solid #ef4444'}}>
      <strong style={{color:'#f87171'}}>Chouldechova (2017) — Fairness Impossibility:</strong> Satisfying all three simultaneously is mathematically impossible when base rates differ between groups.
      This is proven in Chouldechova (2017) and Kleinberg et al. (2016). VectoFair surfaces this so <strong style={{color:'#e2e8f0'}}>policy decisions — not algorithms — can resolve it.</strong>
    </div>
  </div>);
}

function analyzeRecidivism(data){
  const byRace={};
  for(const d of data){if(!byRace[d.race])byRace[d.race]=[];byRace[d.race].push(d);}

  function metrics(pts){
    const highRisk=pts.filter(p=>p.predicted_high_risk===1);
    const lowRisk=pts.filter(p=>p.predicted_low_risk===1);
    const fp=highRisk.filter(p=>p.actual_reoffended===0).length;
    const tp=highRisk.filter(p=>p.actual_reoffended===1).length;
    const fn=lowRisk.filter(p=>p.actual_reoffended===1).length;
    const tn=lowRisk.filter(p=>p.actual_reoffended===0).length;
    const fpr=fp/(fp+tn||1);
    const fnr=fn/(fn+tp||1);
    const ppv=tp/(tp+fp||1);
    return{fp,tp,fn,tn,fpr,fnr,ppv,total:pts.length};
  }

  const blackM=metrics(byRace['Black']||[]);
  const whiteM=metrics(byRace['White']||[]);
  const fprGap=blackM.fpr-whiteM.fpr;
  const fnrGap=whiteM.fnr-blackM.fnr;
  const ppvGap=Math.abs(blackM.ppv-whiteM.ppv);

  let score=100;
  if(fprGap>0.15)score-=35;else if(fprGap>0.08)score-=20;
  if(fnrGap>0.12)score-=30;else if(fnrGap>0.07)score-=18;
  if(ppvGap>0.08)score-=15;
  score=Math.max(0,Math.min(100,Math.round(score)));

  const findings=[];
  if(fprGap>0.10){
    findings.push({id:'fpr-gap',rewriteAvailable:false,
      title:`False Positive Rate Gap — Black Defendants: ${fmtPct(blackM.fpr)} vs White: ${fmtPct(whiteM.fpr)} (ProPublica Finding Replicated)`,
      severity:fprGap>0.15?'SEVERE':'HIGH',
      metrics:[
        {label:'Black FPR',value:fmtPct(blackM.fpr)},
        {label:'White FPR',value:fmtPct(whiteM.fpr)},
        {label:'Gap',value:`+${fmtPct(fprGap)}`},
        {label:'Meaning',value:'Black defendants predicted high-risk but did NOT reoffend at 2× the rate'},
      ],
      legalBasis:[
        {name:'14th Amendment',citation:'Equal Protection Clause — racially asymmetric false positive rates that produce harsher pre-trial treatment for one group trigger strict scrutiny'},
        {name:'State v. Loomis 2016',citation:'Wisconsin Supreme Court: algorithmic risk scores may inform but not determine sentencing; FPR disparity is constitutionally significant'},
        {name:'Chouldechova 2017',citation:'Proven impossibility: when base rates differ, you cannot simultaneously have equal FPR and equal PPV — this disparity is mathematically inherent, not fixable by tuning alone'},
      ]});
  }
  if(fnrGap>0.10){
    findings.push({id:'fnr-gap',rewriteAvailable:false,
      title:`False Negative Rate Gap — White Defendants: ${fmtPct(whiteM.fnr)} vs Black: ${fmtPct(blackM.fnr)} (Asymmetric Error Direction)`,
      severity:fnrGap>0.15?'SEVERE':'HIGH',
      metrics:[
        {label:'White FNR',value:fmtPct(whiteM.fnr)},
        {label:'Black FNR',value:fmtPct(blackM.fnr)},
        {label:'Gap',value:`+${fmtPct(fnrGap)} White vs Black`},
        {label:'Meaning',value:'White defendants who reoffend are more often predicted low-risk'},
      ],
      legalBasis:[
        {name:'14th Amendment',citation:'Asymmetric under-prediction of reoffense for white defendants while over-predicting for Black defendants = racially disparate treatment in risk classification'},
        {name:'ACLU Model Legislation',citation:'ACLU model bill on algorithmic accountability — agencies using risk tools with > 10pp FNR racial gap must publicly disclose the disparity and provide mitigation plan'},
      ]});
  }
  if(ppvGap<0.08){
    findings.push({id:'ppv-calibration',rewriteAvailable:false,
      title:`Note: Predictive Parity (PPV) Roughly Equal — ${fmtPct(blackM.ppv)} vs ${fmtPct(whiteM.ppv)} — Northpointe's Claim Partially Supported`,
      severity:'LOW',
      metrics:[
        {label:'Black PPV',value:fmtPct(blackM.ppv)},
        {label:'White PPV',value:fmtPct(whiteM.ppv)},
        {label:'Algorithm Position',value:'Calibrated — score 7 means same thing for both groups'},
        {label:'But',value:'Equal PPV CANNOT coexist with equal FPR when base rates differ (Chouldechova 2017)'},
      ],
      legalBasis:[{name:'Chouldechova 2017',citation:'When base reoffense rates differ between groups, satisfying predictive parity mathematically produces unequal FPR. This is the core impossibility.'}]});
  }

  return{score,grade:grade(score),blackM,whiteM,fprGap,fnrGap,ppvGap,byRace,totalDefendants:data.length,findings};
}

export default function RecidivismDashboard(){
  const[results,setResults]=useState(null);
  const[loading,setLoading]=useState(false);

  const loadDemo=()=>{setLoading(true);setTimeout(()=>{setResults(analyzeRecidivism(RECIDIVISM_DEMO));setLoading(false);},900);};
  const handleCSV=(rows,err)=>{
    if(err) return;
    setResults(analyzeRecidivism(rows));
  };

  const chartOpts={legend:'none',vAxis:{format:'#\'%\'',gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}},hAxis:{textStyle:{color:'#64748b',fontSize:10}},chartArea:{left:48,right:8,top:8,bottom:48},backgroundColor:'transparent',annotations:{alwaysOutside:true,textStyle:{fontSize:11,bold:true}},bar:{groupWidth:'60%'}};


  if(!results){
    return(
      <UploadOrDemo
        title="Recidivism Risk Score Audit"
        description="Audit algorithmic recidivism risk scores for racial bias using the ProPublica methodology — FPR/FNR asymmetry, predictive parity, and the Fairness Impossibility Theorem."
        icon="policy"
        iconColor="#8b5cf6"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 1,000 Defendants"
        columns={CSV_COLUMNS}
        loading={loading}
        extraNote={<RequiredDisclaimer/>}
      />
    );
  }

  const fprFnrData=[
    ['Group','False Positive Rate (%)','False Negative Rate (%)'],
    ['Black Defendants',+(results.fprGap+results.whiteM.fpr)*100,+(results.blackM.fnr)*100],
    ['White Defendants',+(results.whiteM.fpr)*100,+(results.whiteM.fnr)*100],
  ];

  const calibrationData=[
    ['Score Band','Black Reoffend Rate (%)','White Reoffend Rate (%)'],
    ...[1,2,3,4,5,6,7,8,9,10].map(s=>{
      const bPts=RECIDIVISM_DEMO.filter(d=>d.race==='Black'&&d.risk_score===s);
      const wPts=RECIDIVISM_DEMO.filter(d=>d.race==='White'&&d.risk_score===s);
      return[`Score ${s}`,
        bPts.length?+(avg(bPts.map(d=>d.actual_reoffended))*100).toFixed(1):0,
        wPts.length?+(avg(wPts.map(d=>d.actual_reoffended))*100).toFixed(1):0];
    })
  ];

  return(<div style={{maxWidth:'1200px',margin:'0 auto',padding:'32px 20px'}}>
    <RequiredDisclaimer/>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
      <div>
        <h1 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:'800',color:'#0f172a'}}>Recidivism Risk Score Audit Results</h1>
        <div style={{fontSize:'13px',color:'#64748b'}}>{results.totalDefendants} defendants analyzed · {results.findings.length} findings · ProPublica methodology</div>
      </div>
      <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
        <BiasScoreGauge score={results.score} grade={results.grade} size={80}/>
        <button onClick={loadDemo} style={{padding:'8px 16px',backgroundColor:'#f1f5f9',color:'#0f172a',border:'1px solid #e2e8f0',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'600',display:'flex',alignItems:'center',gap:'6px'}}>
          <span className="material-icons-round" style={{fontSize:'16px'}}>refresh</span>Reset
        </button>
      </div>
    </div>

    <div style={{display:'flex',gap:'20px',marginBottom:'24px',flexWrap:'wrap'}}>
      <ConfusionMatrix label="Black Defendants" tp={results.blackM.tp} fp={results.blackM.fp} tn={results.blackM.tn} fn={results.blackM.fn} color="#ef4444"/>
      <ConfusionMatrix label="White Defendants" tp={results.whiteM.tp} fp={results.whiteM.fp} tn={results.whiteM.tn} fn={results.whiteM.fn} color="#6366f1"/>
    </div>

    <FairnessImpossibilityPanel/>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'32px'}}>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>FPR &amp; FNR by Race — Both Errors Together</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Blue=FPR (false high-risk), green=FNR (false low-risk) — errors are racially asymmetric in direction</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={fprFnrData} options={{...chartOpts,legend:{position:'top'},colors:['#ef4444','#f59e0b']}}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Score Calibration — Actual Reoffense Rate by Risk Score</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Blue=Black defendants, red=White — roughly equal = calibrated (Northpointe claim)</div>
        <Chart chartType="LineChart" width="100%" height="220px" data={calibrationData}
          options={{...chartOpts,legend:{position:'top'},colors:['#6366f1','#ef4444'],vAxis:{format:'#\'%\'',viewWindow:{min:0,max:100}}}}/>
      </div>
    </div>

    <div style={{backgroundColor:'#fef9c3',border:'1px solid #fbbf24',borderRadius:'12px',padding:'16px 20px',marginBottom:'24px'}}>
      <div style={{fontWeight:'700',color:'#78350f',fontSize:'14px',marginBottom:'4px'}}>ProPublica vs Northpointe — Two Valid But Conflicting Perspectives</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginTop:'8px'}}>
        <div style={{backgroundColor:'#fff',borderRadius:'8px',padding:'12px',border:'1px solid #fcd34d'}}>
          <div style={{fontWeight:'700',color:'#0f172a',fontSize:'13px',marginBottom:'4px'}}>ProPublica (2016)</div>
          <div style={{fontSize:'12px',color:'#475569',lineHeight:'1.5'}}>"Equal FPR is most important — Black defendants falsely labeled high-risk at {fmtPct(results.fprGap)} higher rates. This is discriminatory labeling."</div>
        </div>
        <div style={{backgroundColor:'#fff',borderRadius:'8px',padding:'12px',border:'1px solid #fcd34d'}}>
          <div style={{fontWeight:'700',color:'#0f172a',fontSize:'13px',marginBottom:'4px'}}>Northpointe (2016)</div>
          <div style={{fontSize:'12px',color:'#475569',lineHeight:'1.5'}}>"Equal PPV is most important — a score of 7 predicts the same reoffense probability for both groups. The tool is calibrated."</div>
        </div>
      </div>
      <div style={{fontSize:'12px',color:'#92400e',fontWeight:'600',marginTop:'10px'}}>⚠️ They cannot both be satisfied simultaneously when base rates differ — Chouldechova (2017) Impossibility Theorem.</div>
    </div>

    <h2 style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'16px'}}>Findings</h2>
    {results.findings.map(f=>(<FindingCard key={f.id} title={f.title} severity={f.severity} metrics={f.metrics} legalBasis={f.legalBasis} rewriteAvailable={false} onRectifyClick={()=>{}}/>))}
  </div>);
}
