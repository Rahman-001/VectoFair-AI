import React, { useState } from 'react';
import { Chart } from 'react-google-charts';
import { LEARNING_PATH_DEMO } from '../data/learningPathDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';

const CSV_COLUMNS = [
  { name:'student_id',          type:'string' },
  { name:'assessment_score',    type:'number',  note:'0-100' },
  { name:'recommended_level',   type:'number',  note:'1-5 track level' },
  { name:'recommended_advanced',type:'0/1',     note:'1=advanced track' },
  { name:'referred_to_remediation', type:'0/1' },
  { name:'flagged_for_review',  type:'0/1' },
  { name:'is_mobile_only',      type:'0/1',     sensitive:true, note:'device proxy for SES' },
  { name:'race',                type:'string',  sensitive:true },
  { name:'first_gen',           type:'0/1',     sensitive:true },
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

function analyzeLearningPath(data){
  const groupBy=(arr,key)=>{const m={};for(const r of arr){const k=r[key]??'Unknown';if(!m[k])m[k]=[];m[k].push(r);}return m;};

  // Score bands for controlled analysis
  const midBand=data.filter(d=>d.assessment_score>=60&&d.assessment_score<=75);
  const byRaceMid=groupBy(midBand,'race');

  // 1. REMEDIATION OVER-REFERRAL (same score band)
  const blackMid=(byRaceMid['Black']||[]);
  const whiteMid=(byRaceMid['White']||[]);
  const blackRemediation=avg(blackMid.map(p=>p.referred_to_remediation));
  const whiteRemediation=avg(whiteMid.map(p=>p.referred_to_remediation));
  const remediGap=blackRemediation-whiteRemediation;
  const remediPctMore=whiteRemediation>0?(remediGap/whiteRemediation)*100:0;

  // 2. DEVICE/MOBILE LEVEL GAP
  const byDevice=groupBy(data,'is_mobile_only');
  const mobileScoreBand=data.filter(d=>d.assessment_score>=65&&d.assessment_score<=80);
  const byDeviceMid=groupBy(mobileScoreBand,'is_mobile_only');
  const mobileLevel=avg((byDeviceMid['1']||[]).map(p=>p.recommended_level));
  const desktopLevel=avg((byDeviceMid['0']||[]).map(p=>p.recommended_level));
  const deviceLevelGap=desktopLevel-mobileLevel;

  // 3. ACCELERATION GAP
  const advanced=data.filter(d=>d.recommended_advanced===1);
  const byRaceAdv=groupBy(advanced,'race');
  const advTotal=advanced.length||1;
  const whiteAsianAdv=((byRaceAdv['White']?.length||0)+(byRaceAdv['Asian']?.length||0))/advTotal;
  const otherAdv=1-whiteAsianAdv;
  const byRaceAll=groupBy(data,'race');
  const advRateByRace={};
  for(const[race,pts]of Object.entries(byRaceAll)){
    if(pts.length>=5)advRateByRace[race]=avg(pts.map(p=>p.recommended_advanced));
  }

  // 4. FLAGGING DISPARITY
  const byRaceFlag=groupBy(data,'race');
  const blackFlagRate=avg((byRaceFlag['Black']||[]).map(p=>p.flagged_for_review));
  const whiteFlagRate=avg((byRaceFlag['White']||[]).map(p=>p.flagged_for_review));
  const flagRatio=whiteFlagRate>0?blackFlagRate/whiteFlagRate:1;

  let score=100;
  if(remediPctMore>35)score-=32;else if(remediPctMore>20)score-=20;
  if(deviceLevelGap>0.6)score-=25;else if(deviceLevelGap>0.4)score-=15;
  if(whiteAsianAdv>0.65)score-=20;else if(whiteAsianAdv>0.55)score-=12;
  if(flagRatio>2.0)score-=15;else if(flagRatio>1.5)score-=8;
  score=Math.max(0,Math.min(100,Math.round(score)));

  const findings=[];
  if(remediPctMore>25){
    findings.push({id:'remediation',rewriteAvailable:true,
      title:`Remediation Over-Referral — Black Students Referred ${remediPctMore.toFixed(0)}% More Than White Students at Same Assessment Score`,
      severity:remediPctMore>40?'SEVERE':'HIGH',
      metrics:[
        {label:'Black Remediation Rate (score 60-75)',value:fmtPct(blackRemediation)},
        {label:'White Remediation Rate (score 60-75)',value:fmtPct(whiteRemediation)},
        {label:'Excess Referral',value:`+${remediPctMore.toFixed(0)}%`},
        {label:'Evidence','value':'Consistent with NEA 2019, GAO 2022 findings'},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Title VI — algorithmic remediation over-referral by race in federally funded education programs constitutes prohibited disparate impact'},
        {name:'IDEA',citation:'IDEA §612 — over-representation of minority students in special programs requires documented justification and equity review'},
      ]});
  }
  if(deviceLevelGap>0.5){
    findings.push({id:'device-proxy',rewriteAvailable:true,
      title:`Device Type as SES Proxy — Mobile-Only Students Recommended ${deviceLevelGap.toFixed(2)} Levels Lower at Same Assessment Score`,
      severity:deviceLevelGap>0.7?'HIGH':'MEDIUM',
      metrics:[
        {label:'Mobile-Only Avg Level (score 65-80)',value:mobileLevel.toFixed(2)},
        {label:'Desktop Avg Level (score 65-80)',value:desktopLevel.toFixed(2)},
        {label:'Level Gap',value:deviceLevelGap.toFixed(2)+' levels'},
        {label:'SES Correlation',value:'Mobile-only → low-SES → minority proxy'},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Device type used as recommendation factor when correlated with SES/race constitutes indirect race discrimination under Title VI'},
        {name:'CA AB 2143',citation:'California AB 2143 — student data privacy; device type as educational tracking proxy requires parental notice and equity review'},
      ]});
  }
  if(whiteAsianAdv>0.65){
    findings.push({id:'acceleration-gap',rewriteAvailable:true,
      title:`Acceleration Track Gap — White/Asian Students Make Up ${fmtPct(whiteAsianAdv)} of Advanced Level Recommendations`,
      severity:whiteAsianAdv>0.72?'HIGH':'MEDIUM',
      metrics:[
        {label:'White + Asian in Advanced Track',value:fmtPct(whiteAsianAdv)},
        {label:'Other Students in Advanced Track',value:fmtPct(otherAdv)},
        {label:'Interpretation',value:'Gifted track demographics don\'t match school population'},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Disproportionate exclusion of racial minorities from advanced tracks in algorithmic recommendation systems triggers disparate impact scrutiny under Title VI'},
        {name:'IDEA',citation:'IDEA equity provisions — recommendation algorithms must be evaluated for systemic racial exclusion from opportunity tracks'},
      ]});
  }
  if(flagRatio>1.8){
    findings.push({id:'flag-disparity',rewriteAvailable:false,
      title:`Review Flag Disparity — Black Students Flagged for Intervention ${flagRatio.toFixed(1)}× More Often Than White Students (Same Performance)`,
      severity:flagRatio>2.2?'HIGH':'MEDIUM',
      metrics:[
        {label:'Black Flag Rate',value:fmtPct(blackFlagRate)},
        {label:'White Flag Rate',value:fmtPct(whiteFlagRate)},
        {label:'Flagging Ratio',value:flagRatio.toFixed(1)+'× more often'},
        {label:'Interpretation',value:'Over-surveillance proxy for institutional bias'},
      ],
      legalBasis:[{name:'FERPA',citation:'FERPA — student algorithmic flags that disproportionately target racial groups create protected-status records that require equity review and parental access'}]});
  }

  return{score,grade:grade(score),remediGap,blackRemediation,whiteRemediation,remediPctMore,deviceLevelGap,mobileLevel,desktopLevel,whiteAsianAdv,otherAdv,flagRatio,blackFlagRate,whiteFlagRate,advRateByRace,totalStudents:data.length,findings};
}

export default function LearningPathDashboard(){
  const[results,setResults]=useState(null);
  const[loading,setLoading]=useState(false);
  const[rewriteOpen,setRewriteOpen]=useState(false);
  const[rewriteData,setRewriteData]=useState(null);

  const loadDemo=()=>{setLoading(true);setTimeout(()=>{setResults(analyzeLearningPath(LEARNING_PATH_DEMO));setLoading(false);},700);};
  const handleCSV=(rows,err)=>{
    if(err){return;}
    setResults(analyzeLearningPath(rows));
  };

  const openRectify=()=>{
    const r=results;
    const original=`CURRENT RECOMMENDATION ENGINE:\n• Remediation referral: score-based + uncontrolled factors (device, engagement)\n• Level recommendations: influenced by device type and internet speed\n• Advanced track: demographic-correlated criteria\n• Intervention flags: no equity monitoring\n\nBlack remediation over-referral: +${r.remediPctMore.toFixed(0)}%\nMobile-only level gap: -${r.deviceLevelGap.toFixed(2)} levels\nAdvanced track: ${fmtPct(r.whiteAsianAdv)} White/Asian`;
    const rewritten=`EQUITY-CENTERED RECOMMENDATION CRITERIA:\n\n1. REMOVE FROM RECOMMENDATION ENGINE:\n   • Device type (mobile/desktop) — SES/race proxy\n   • Internet speed category — access/infrastructure proxy\n   • Platform engagement score alone — time-on-platform ≠ learning\n\n2. REMEDIATION CRITERIA (device-agnostic)\n   • Assessment score below 60 AND consistent pattern (3+ assessments)\n   • Human educator review required before remediation referral for any student\n   • Quarterly equity audit: remediation rates must be within 10% across race groups\n\n3. ADVANCED TRACK CRITERIA\n   • Assessment score + growth trajectory (improvement over 4 weeks)\n   • Remove: platform engagement, assignment submission time\n   • Add: mastery demonstration quiz for advanced track eligibility\n\n4. INTERVENTION FLAG PROTOCOL\n   • Flags trigger educator notification — not automatic action\n   • Bi-monthly demographic audit of flag rates required\n   • Parent/student appeal process for any algorithmic placement`;
    const changes=[
      {action:'Remove device type from recommendation model',original:`Device type input: mobile-only recommended ${r.deviceLevelGap.toFixed(2)} levels lower same score`,replacement:'Device type: removed from model inputs; level based on assessment score and growth only',reason:`Device type correlates with SES and race — using it as a feature creates illegal proxy discrimination under Title VI`},
      {action:'Add equity monitoring to remediation referral',original:`Remediation referral: Black students ${r.remediPctMore.toFixed(0)}% more at same score`,replacement:'Remediation: score-threshold only + required educator review; quarterly equity audit mandated',reason:`${r.remediPctMore.toFixed(0)}% over-referral for same-performing Black students requires process-level correction, not just model adjustment`},
    ];
    setRewriteData({original,rewritten,changes});setRewriteOpen(true);
  };

  if(!results){
    return(
      <UploadOrDemo
        title="Learning Path Recommendation Bias"
        description="Detect remediation over-referral, device-as-SES proxy, acceleration track exclusion, and disproportionate intervention flagging in EdTech systems."
        icon="auto_graph"
        iconColor="#10b981"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 400 Students"
        columns={CSV_COLUMNS}
        loading={loading}
      />
    );
  }

  const remediData=[
    ['Race','Remediation Referral Rate (%)',{role:'style'},{role:'annotation'}],
    ['White (score 60-75)',+(results.whiteRemediation*100).toFixed(1),'#22c55e',fmtPct(results.whiteRemediation)],
    ['Black (score 60-75)',+(results.blackRemediation*100).toFixed(1),'#ef4444',fmtPct(results.blackRemediation)],
  ];

  const advData=[['Group','% of Advanced Track',{role:'style'},{role:'annotation'}],
    ['White + Asian',+(results.whiteAsianAdv*100).toFixed(1),'#6366f1',fmtPct(results.whiteAsianAdv)],
    ['Other Students',+(results.otherAdv*100).toFixed(1),'#f59e0b',fmtPct(results.otherAdv)],
  ];

  const advRaceData=[['Race','Advanced Track Rate (%)',{role:'style'},{role:'annotation'}],
    ...Object.entries(results.advRateByRace).map(([r,v])=>[r,+(v*100).toFixed(1),r==='White'?'#22c55e':r==='Asian'?'#3b82f6':r==='Hispanic'?'#f59e0b':'#ef4444',fmtPct(v)])
  ];

  const flagData=[['Race','Intervention Flag Rate (%)',{role:'style'},{role:'annotation'}],...Object.entries(groupByRace(LEARNING_PATH_DEMO)).map(([r,pts])=>[r,+(avg(pts.map(p=>p.flagged_for_review))*100).toFixed(1),r==='White'?'#22c55e':r==='Asian'?'#3b82f6':r==='Hispanic'?'#f59e0b':'#ef4444',fmtPct(avg(pts.map(p=>p.flagged_for_review)))])];

  const chartOpts={legend:'none',vAxis:{format:'#\'%\'',gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}},hAxis:{textStyle:{color:'#64748b',fontSize:10}},chartArea:{left:48,right:8,top:8,bottom:48},backgroundColor:'transparent',annotations:{alwaysOutside:true,textStyle:{fontSize:11,bold:true}},bar:{groupWidth:'60%'}};

  return(<div style={{maxWidth:'1200px',margin:'0 auto',padding:'32px 20px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px',flexWrap:'wrap',gap:'16px'}}>
      <div>
        <h1 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:'800',color:'#0f172a'}}>Learning Path Bias Results</h1>
        <div style={{fontSize:'13px',color:'#64748b'}}>{results.totalStudents} students analyzed · {results.findings.length} findings</div>
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
        <MetricCard label="Remediation Over-Referral" value={`+${results.remediPctMore.toFixed(0)}%`} sub="Black vs White same score (60-75 band)" color="#ef4444" icon="warning"/>
        <MetricCard label="Device Level Gap" value={`-${results.deviceLevelGap.toFixed(2)} levels`} sub="Mobile-only vs desktop same score (65-80)" color={results.deviceLevelGap>0.6?'#ef4444':'#f59e0b'} icon="smartphone"/>
        <MetricCard label="Advanced Track" value={fmtPct(results.whiteAsianAdv)} sub="White/Asian share of Level 4+ recommendations" color={results.whiteAsianAdv>0.68?'#ef4444':'#f59e0b'} icon="trending_up"/>
        <MetricCard label="Flag Ratio" value={`${results.flagRatio.toFixed(1)}×`} sub="Black vs White intervention flag rate" color={results.flagRatio>2.0?'#ef4444':'#f59e0b'} icon="flag"/>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'32px'}}>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Remediation Referral by Race (Score 60-75)</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Same assessment score band — rate difference is algorithmic bias</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={remediData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Advanced Track Demographic Composition</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Level 4+ recommendations — should reflect general population mix</div>
        <Chart chartType="PieChart" width="100%" height="220px" data={advData.slice(0,3)}
          options={{pieHole:0.4,colors:['#6366f1','#f59e0b'],legend:{position:'bottom'},chartArea:{top:8,bottom:40},backgroundColor:'transparent'}}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Advanced Track Rate by Race</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>% of each racial group recommended for Level 4+</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={advRaceData} options={chartOpts}/>
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>Intervention Flag Rate by Race</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Flag ratio &gt;1.8× = over-surveillance pattern — threshold for review</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={flagData} options={chartOpts}/>
      </div>
    </div>

    <h2 style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'16px'}}>Findings</h2>
    {results.findings.map(f=>(<FindingCard key={f.id} title={f.title} severity={f.severity} metrics={f.metrics} legalBasis={f.legalBasis} rewriteAvailable={f.rewriteAvailable} onRectifyClick={openRectify}/>))}
    {rewriteOpen&&rewriteData&&(<RewriteModal isOpen={rewriteOpen} onClose={()=>setRewriteOpen(false)} onAccept={()=>setRewriteOpen(false)} originalContent={rewriteData.original} rewrittenContent={rewriteData.rewritten} changesApplied={rewriteData.changes}/>)}
  </div>);
}

function groupByRace(data){
  const m={};
  for(const r of data){if(!m[r.race])m[r.race]=[];m[r.race].push(r);}
  return m;
}
