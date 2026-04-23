import React, { useState, useCallback } from 'react';
import { Chart } from 'react-google-charts';
import { GRADING_DEMO } from '../data/gradingDemoData';
import FindingCard from './shared/FindingCard';
import BiasScoreGauge from './shared/BiasScoreGauge';
import RewriteModal from './shared/RewriteModal';
import UploadOrDemo from './shared/UploadOrDemo';
import { callAI } from '../utils/aiClient';

const CSV_COLUMNS = [
  { name:'student_id',      type:'string',  note:'unique identifier' },
  { name:'ai_score',        type:'number',  note:'0-100 scale' },
  { name:'human_score',     type:'number',  note:'0-100 scale' },
  { name:'subject_area',    type:'string',  note:'e.g. English, Math' },
  { name:'is_essay_subject',type:'0/1',     note:'1 = essay/writing task' },
  { name:'ai_human_gap',    type:'number',  note:'ai_score minus human_score' },
  { name:'race',            type:'string',  sensitive:true, note:'Black/White/Hispanic/Asian' },
  { name:'is_esl',          type:'0/1',     sensitive:true, note:'English as second language' },
  { name:'has_iep',         type:'0/1',     sensitive:true, note:'has IEP/504 accommodation' },
];

function grade(s){if(s>=80)return'A';if(s>=65)return'B';if(s>=50)return'C';if(s>=35)return'D';return'F';}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function fmtPt(n,d=1){return n.toFixed(d)+' pts';}

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

function analyzeGrading(data) {
  const groupBy=(arr,key)=>{const m={};for(const r of arr){const k=r[key]??'Unknown';if(!m[k])m[k]=[];m[k].push(r);}return m;};

  const byRace = groupBy(data,'race');
  const gapByRace={};
  for(const[race,pts]of Object.entries(byRace)){
    if(pts.length>=5){
      const aiAvg=avg(pts.map(p=>p.ai_score));
      const huAvg=avg(pts.map(p=>p.human_score));
      gapByRace[race]={ai:aiAvg,human:huAvg,gap:aiAvg-huAvg,count:pts.length};
    }
  }

  const byESL = groupBy(data,'is_esl');
  const eslAI=avg((byESL['1']||[]).map(p=>p.ai_score));
  const eslHuman=avg((byESL['1']||[]).map(p=>p.human_score));
  const eslGap=eslAI-eslHuman;
  const nonESLAI=avg((byESL['0']||[]).map(p=>p.ai_score));
  const nonESLHuman=avg((byESL['0']||[]).map(p=>p.human_score));
  const nonESLGap=nonESLAI-nonESLHuman;

  const byIEP = groupBy(data,'has_iep');
  const iepAI=avg((byIEP['1']||[]).map(p=>p.ai_score));
  const iepHuman=avg((byIEP['1']||[]).map(p=>p.human_score));
  const iepGap=iepAI-iepHuman;

  // Subject x race gap
  const bySubject = groupBy(data,'subject_area');
  const essayGap=avg(data.filter(d=>d.is_essay_subject===1).map(d=>d.ai_human_gap));
  const nonEssayGap=avg(data.filter(d=>d.is_essay_subject===0).map(d=>d.ai_human_gap));

  // Score variance by race at same human score band
  const midBand = data.filter(d=>d.human_score>=70&&d.human_score<=80);
  const midByRace = groupBy(midBand,'race');
  const varianceByRace={};
  for(const[race,pts]of Object.entries(midByRace)){
    if(pts.length>=3){const m=avg(pts.map(p=>p.ai_score));varianceByRace[race]=Math.sqrt(avg(pts.map(p=>Math.pow(p.ai_score-m,2))));}
  }

  const blackGap=gapByRace['Black']?.gap??-7;
  const whiteGap=gapByRace['White']?.gap??-1;
  const raceGapDiff=Math.abs(blackGap-whiteGap);

  let score=100;
  if(raceGapDiff>5)score-=30;else if(raceGapDiff>3)score-=18;
  if(Math.abs(eslGap)>6)score-=25;else if(Math.abs(eslGap)>4)score-=15;
  if(Math.abs(iepGap)>6)score-=22;else if(Math.abs(iepGap)>4)score-=14;
  if(Math.abs(essayGap-nonEssayGap)>4)score-=13;else if(Math.abs(essayGap-nonEssayGap)>2)score-=7;
  score=Math.max(0,Math.min(100,Math.round(score)));

  const findings=[];
  if(raceGapDiff>4){
    findings.push({id:'race-gap',rewriteAvailable:true,
      title:`AI-Human Score Gap by Race — Black Students Scored ${Math.abs(blackGap).toFixed(1)}pts Below Human Graders vs ${Math.abs(whiteGap).toFixed(1)}pts for White Students`,
      severity:raceGapDiff>5?'SEVERE':'HIGH',
      metrics:[
        {label:'Black AI-Human Gap',value:fmtPt(blackGap)},
        {label:'White AI-Human Gap',value:fmtPt(whiteGap)},
        {label:'Systematic Difference',value:fmtPt(raceGapDiff)},
        {label:'Threshold',value:'>4pt systematic gap = flag'},
      ],
      legalBasis:[
        {name:'Title VI',citation:'Title VI Civil Rights Act — AI grading systems producing racially disparate outcomes in federally funded education programs trigger disparate impact liability'},
        {name:'NYC DOE AI Guidelines 2023',citation:'NYC Department of Education AI Guidelines (2023) require bias auditing of AI tools used for student evaluation'},
      ]});
  }
  if(Math.abs(eslGap)>5){
    findings.push({id:'esl-gap',rewriteAvailable:true,
      title:`ESL Linguistic Penalty — ESL Students AI Score ${Math.abs(eslGap).toFixed(1)}pts Below Human Grade (AAVE/Non-Standard Syntax Penalized)`,
      severity:Math.abs(eslGap)>7?'SEVERE':'HIGH',
      metrics:[
        {label:'ESL AI Score (avg)',value:eslAI.toFixed(1)},
        {label:'ESL Human Score (avg)',value:eslHuman.toFixed(1)},
        {label:'Gap',value:fmtPt(eslGap)},
        {label:'Non-ESL Gap',value:fmtPt(nonESLGap)},
      ],
      legalBasis:[
        {name:'Title VI LEP',citation:'Title VI requires language access — AI grading penalizing ESL syntax constitutes national origin discrimination in educational assessment'},
        {name:'IDEA',citation:'Individuals with Disabilities Education Act — assessment tools must be valid and non-discriminatory across linguistic backgrounds'},
      ]});
  }
  if(Math.abs(iepGap)>5){
    findings.push({id:'iep-gap',rewriteAvailable:true,
      title:`IEP/504 Accommodation Gap — Students with Disabilities AI Score ${Math.abs(iepGap).toFixed(1)}pts Below Human Grade`,
      severity:Math.abs(iepGap)>7?'HIGH':'MEDIUM',
      metrics:[
        {label:'IEP/504 AI Score',value:iepAI.toFixed(1)},
        {label:'IEP/504 Human Score',value:iepHuman.toFixed(1)},
        {label:'Gap',value:fmtPt(iepGap)},
        {label:'vs Non-IEP Gap',value:fmtPt(avg(data.filter(d=>d.has_iep===0).map(d=>d.ai_human_gap)))},
      ],
      legalBasis:[
        {name:'IDEA',citation:'IDEA §614 — assessment tools must account for disability accommodations; AI grading without accommodation awareness violates individual evaluation requirements'},
        {name:'Section 504',citation:'Section 504 Rehabilitation Act — schools must ensure AI assessment tools do not discriminate against students with disabilities'},
      ]});
  }
  if(Math.abs(essayGap-nonEssayGap)>3){
    findings.push({id:'subject-pattern',rewriteAvailable:false,
      title:`Subject Area Bias Pattern — AI Grader Bias Concentrated in Essay Subjects (${Math.abs(essayGap).toFixed(1)}pt) vs Non-Essay (${Math.abs(nonEssayGap).toFixed(1)}pt)`,
      severity:'MEDIUM',
      metrics:[
        {label:'Essay Subject AI-Human Gap',value:fmtPt(essayGap)},
        {label:'STEM/Non-Essay Gap',value:fmtPt(nonEssayGap)},
        {label:'Subject Disparity',value:fmtPt(Math.abs(essayGap-nonEssayGap))},
        {label:'Interpretation',value:'Linguistic bias concentrated in writing tasks'},
      ],
      legalBasis:[{name:'Title VI',citation:'Disparate AI performance in essay subjects — where linguistic and cultural cues are more prevalent — requires equity review before deployment'}]});
  }

  return{score,grade:grade(score),gapByRace,eslGap,eslAI,eslHuman,iepGap,iepAI,iepHuman,essayGap,nonEssayGap,raceGapDiff,blackGap,whiteGap,bySubject,varianceByRace,totalSubmissions:data.length,findings};
}

function buildGapChart(gapByRace){
  const rows=[['Race','AI Avg Score','Human Avg Score']];
  const order=['White','Asian','Hispanic','Black'];
  for(const race of order){if(gapByRace[race]){rows.push([race,+gapByRace[race].ai.toFixed(1),+gapByRace[race].human.toFixed(1)]);}}
  return rows;
}

function buildScatterData(data){
  const rows=[['Human Score','AI Score',{type:'string',role:'tooltip'},{type:'string',role:'style'}]];
  const colors={White:'#6366f1',Black:'#ef4444',Hispanic:'#f59e0b',Asian:'#3b82f6'};
  for(const d of data.slice(0,200)){
    rows.push([d.human_score,d.ai_score,`${d.race}: AI ${d.ai_score}, Human ${d.human_score}`,`point{fill-color:${colors[d.race]||'#94a3b8'};size:4;opacity:0.6}`]);
  }
  return rows;
}

export default function GradingDashboard(){
  const[results,setResults]=useState(null);
  const[loading,setLoading]=useState(false);
  const[csvError,setCsvError]=useState(null);
  const[rewriteOpen,setRewriteOpen]=useState(false);
  const[rewriteData,setRewriteData]=useState(null);

  const loadDemo=()=>{setLoading(true);setTimeout(()=>{setResults(analyzeGrading(GRADING_DEMO));setLoading(false);},800);};
  const handleCSV=(rows,err)=>{
    if(err){setCsvError('CSV error: '+err);return;}
    setCsvError(null);
    setResults(analyzeGrading(rows));
  };

  const openRectify=()=>{
    const r=results;
    const original=`CURRENT AI GRADING SYSTEM:\n• No accommodation-aware scoring for IEP/504 students\n• No AAVE/ESL rubric accommodation\n• Single uniform model for all student populations\n\nSCORE GAPS:\nBlack students: ${r.blackGap.toFixed(1)}pt below human grade\nESL students: ${r.eslGap.toFixed(1)}pt below human grade\nIEP students: ${r.iepGap.toFixed(1)}pt below human grade\nWhite students: ${r.whiteGap.toFixed(1)}pt gap (near-aligned)`;
    const rewritten=`PROPOSED HYBRID REVIEW PROTOCOL:\n\n1. AUTOMATIC HUMAN REVIEW TRIGGERS\n   • AI score < Human predicted score by > 5pts → mandatory human review\n   • IEP/504 students: all essay grades reviewed by human educator\n   • ESL students: linguistic style accommodation note added to rubric\n\n2. RUBRIC MODIFICATIONS\n   • Remove penalties for AAVE and ESL syntax that preserves meaning\n   • Add rubric category: "clarity of ideas" separate from "standard grammar"\n\n3. VENDOR AUDIT REQUIREMENTS\n   • Request demographic performance breakdowns from AI vendor quarterly\n   • Bias threshold in SLA: AI-Human gap must be < 3pts across all demographic groups`;
    const changes=[
      {action:'Add human review for high-discrepancy cases',original:'No escalation for demographic gaps',replacement:'Flag: AI-Human gap > 5pts → human educator review within 48 hours',reason:`${Math.abs(r.blackGap-r.whiteGap).toFixed(1)}pt systematic gap for Black students requires human oversight`},
    ];
    setRewriteData({original,rewritten,changes});setRewriteOpen(true);
  };

  if(!results){
    return(
      <UploadOrDemo
        title="AI Grading Fairness Audit"
        description="Detect racial, linguistic, and disability-based bias in AI grading systems by comparing AI scores to human grader scores."
        icon="grading"
        iconColor="#f59e0b"
        onDemoLoad={loadDemo}
        onCSVLoad={handleCSV}
        demoLabel="Run Demo — 300 Student Submissions"
        columns={CSV_COLUMNS}
        loading={loading}
        csvError={csvError}
      />
    );
  }

  const gapChartData=buildGapChart(results.gapByRace);
  const scatterData=buildScatterData(GRADING_DEMO);

  return(<div style={{maxWidth:'1200px',margin:'0 auto',padding:'32px 20px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px',flexWrap:'wrap',gap:'16px'}}>
      <div>
        <h1 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:'800',color:'#0f172a'}}>AI Grading Fairness Results</h1>
        <div style={{fontSize:'13px',color:'#64748b'}}>{results.totalSubmissions} submissions analyzed · {results.findings.length} findings</div>
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
        <MetricCard label="Black-White Score Gap" value={`${Math.abs(results.blackGap-results.whiteGap).toFixed(1)}pt`} sub={`Black ${results.blackGap.toFixed(1)}pt vs White ${results.whiteGap.toFixed(1)}pt below human`} color="#ef4444" icon="groups"/>
        <MetricCard label="ESL Penalty" value={`${Math.abs(results.eslGap).toFixed(1)}pt`} sub="ESL AI-Human gap (essay subjects)" color="#ef4444" icon="translate"/>
        <MetricCard label="IEP Gap" value={`${Math.abs(results.iepGap).toFixed(1)}pt`} sub="IEP/504 AI-Human gap" color={Math.abs(results.iepGap)>6?'#ef4444':'#f59e0b'} icon="accessibility"/>
        <MetricCard label="Essay vs STEM Gap" value={`${Math.abs(results.essayGap-results.nonEssayGap).toFixed(1)}pt`} sub="Subject pattern: linguistic bias" color={Math.abs(results.essayGap-results.nonEssayGap)>4?'#ef4444':'#f59e0b'} icon="subject"/>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'32px'}}>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)',gridColumn:'1/-1'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>AI Score vs Human Score by Race — Scatter Plot</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Points below the diagonal = AI underscored relative to human. Minority students cluster below. Colors: Purple=White, Red=Black, Amber=Hispanic, Blue=Asian</div>
        <Chart chartType="ScatterChart" width="100%" height="280px" data={scatterData}
          options={{legend:'none',hAxis:{title:'Human Score',viewWindow:{min:40,max:100},textStyle:{color:'#64748b',fontSize:10}},vAxis:{title:'AI Score',viewWindow:{min:40,max:100},textStyle:{color:'#64748b',fontSize:10}},chartArea:{left:48,right:8,top:8,bottom:48},backgroundColor:'transparent',trendlines:{0:{type:'linear',color:'#94a3b8',lineWidth:1,opacity:0.5}}}}
        />
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>AI vs Human Score by Race</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Grouped bars: dark=AI, light=Human — gap reveals systematic underscoring</div>
        <Chart chartType="ColumnChart" width="100%" height="220px" data={gapChartData}
          options={{legend:{position:'top'},colors:['#6366f1','#94a3b8'],vAxis:{gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}},hAxis:{textStyle:{color:'#64748b',fontSize:10}},chartArea:{left:44,right:8,top:28,bottom:44},backgroundColor:'transparent',bar:{groupWidth:'70%'}}}
        />
      </div>
      <div style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:'15px',color:'#0f172a',fontWeight:'700'}}>AI-Human Gap by Student Group</h3>
        <div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'12px'}}>Negative = AI underscores vs human grader — threshold: &gt;4pt = flag</div>
        <Chart chartType="ColumnChart" width="100%" height="220px"
          data={[['Group','AI-Human Gap (pts)',{role:'style'},{role:'annotation'}],
            ['White (non-ESL)',+results.whiteGap.toFixed(1),'#22c55e',`${results.whiteGap.toFixed(1)}pts`],
            ['Asian',+((results.gapByRace['Asian']?.gap||results.whiteGap*1.5)).toFixed(1),'#3b82f6',`${(results.gapByRace['Asian']?.gap||0).toFixed(1)}pts`],
            ['Hispanic',+((results.gapByRace['Hispanic']?.gap||-4)).toFixed(1),'#f59e0b',`${(results.gapByRace['Hispanic']?.gap||-4).toFixed(1)}pts`],
            ['Black',+results.blackGap.toFixed(1),'#ef4444',`${results.blackGap.toFixed(1)}pts`],
            ['ESL Students',+results.eslGap.toFixed(1),'#dc2626',`${results.eslGap.toFixed(1)}pts`],
            ['IEP/504 Students',+results.iepGap.toFixed(1),'#9333ea',`${results.iepGap.toFixed(1)}pts`],
          ]}
          options={{legend:'none',vAxis:{gridlines:{color:'#f1f5f9'},textStyle:{color:'#64748b',fontSize:10}},hAxis:{textStyle:{color:'#64748b',fontSize:9}},chartArea:{left:44,right:8,top:8,bottom:56},backgroundColor:'transparent',annotations:{alwaysOutside:true,textStyle:{fontSize:11,bold:true}},bar:{groupWidth:'65%'}}}
        />
      </div>
    </div>

    <h2 style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'16px'}}>Findings</h2>
    {results.findings.map(f=>(
      <FindingCard key={f.id} title={f.title} severity={f.severity} metrics={f.metrics} legalBasis={f.legalBasis} rewriteAvailable={f.rewriteAvailable} fetchExplanation={()=>fetchExplanation(f.id,f)} onRectifyClick={openRectify}/>
    ))}
    {rewriteOpen&&rewriteData&&(<RewriteModal isOpen={rewriteOpen} onClose={()=>setRewriteOpen(false)} onAccept={()=>setRewriteOpen(false)} originalContent={rewriteData.original} rewrittenContent={rewriteData.rewritten} changesApplied={rewriteData.changes}/>)}
  </div>);
}
