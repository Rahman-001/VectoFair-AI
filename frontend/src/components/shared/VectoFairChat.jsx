import React, { useState, useRef, useEffect, useCallback } from 'react';
import { callAI } from '../../utils/aiClient';

function MarkdownText({ text }) {
  // Simple markdown renderer: bold, lists, line breaks
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:#1e293b;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>')
    .replace(/^• (.+)$/gm, '<li style="padding-left:8px;color:#e2e8f0;margin-bottom:4px;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:16px;margin:6px 0;">$&</ul>')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function ChatMessage({ msg, onAddToReport }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: '8px', marginBottom: '12px', alignItems: 'flex-start' }}>
      {!isUser && (
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-icons-round" style={{ fontSize: '14px', color: '#fff' }}>auto_awesome</span>
        </div>
      )}
      <div style={{ maxWidth: '85%' }}>
        <div style={{
          backgroundColor: isUser ? '#4f46e5' : '#1e293b',
          color: '#e2e8f0', borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
          padding: '10px 14px', fontSize: '13px', lineHeight: '1.6'
        }}>
          {msg.isLoading ? (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#64748b', animation: `bounce 1.2s ${i*0.2}s infinite` }}/>)}
            </div>
          ) : (
            <MarkdownText text={msg.text} />
          )}
        </div>
        {!isUser && !msg.isLoading && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button onClick={copy} style={{ padding: '2px 8px', backgroundColor: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span className="material-icons-round" style={{ fontSize: '11px' }}>{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const STARTER_CHIP_TEMPLATES = [
  (ctx) => `Why is ${ctx.worstFinding || 'the top finding'} considered biased?`,
  (ctx) => `How do I fix the ${ctx.highestSeverity || 'SEVERE'} severity finding?`,
  (ctx) => `What's my biggest legal risk from these results?`,
  (ctx) => `How does my score of ${ctx.score || '?'}/100 compare to benchmarks?`,
];

export default function VectoFairChat({ auditContext, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ceoMode, setCeoMode] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const isHome = auditContext?.isHome;
      setMessages([{
        role: 'assistant',
        text: isHome
          ? `👋 Hi! I'm **VectoFair AI** — your bias audit guide.\n\nI can help you:\n• **Find the right module** for your use case\n• **Explain what bias metrics** mean (Disparate Impact, FPR gap, etc.)\n• **Understand legal standards** like EEOC, ACA §1557, EU AI Act\n• **Prepare your CSV data** for any module\n\nWhat would you like to explore?`
          : `👋 I'm VectoFair AI. I've loaded your **${auditContext?.moduleName}** audit context. Ask me anything about bias findings, legal risks, or remediation steps.`,
      }]);
    }
  }, [isOpen, auditContext]);

  const buildSystemContext = useCallback(() => {
    if (!auditContext) return '';
    if (auditContext.isHome) {
      return `You are VectoFair AI, an AI bias audit platform assistant built for the Google Solution Challenge.
The platform has 21 audit modules across 5 domains: HR, Finance, Healthcare, Education, Justice & Gov.
Key modules: General CSV Audit (any dataset), Loan Approval, Pay Gap, Treatment Bias, Clinical Trial Diversity, Admissions Audit, Recidivism Risk Score, and more.
Help the user find the right module, understand bias concepts, prepare their data, and navigate the platform.
Be concise, friendly, and actionable. Keep responses under 150 words.
Available domains and modules: HR (General CSV, Resume, Pay Gap, Promotion, Performance, Compliance), Finance (Loan, Credit Limit, Fraud, Insurance), Healthcare (Treatment, Clinical Trial, Hospital, Diagnostics), Education (Admissions, AI Grading, Scholarship, Learning Path), Justice (Recidivism, Benefits, Public Service).`;
    }
    return `You are VectoFair AI, a bias detection and fairness expert.
The user is on the ${auditContext.moduleName} module.
${auditContext.findingsCount > 0 ? `Audit results: Score ${auditContext.score}/100 (Grade ${auditContext.grade}), ${auditContext.findingsCount} findings. Top findings: ${(auditContext.findings || []).map(f => `${f.severity}: ${f.title}`).join('; ')}.` : 'No audit results yet — they may be uploading data.'}
Answer questions about bias detection, this module's methodology, legal risks, and remediation.
Do not give specific legal advice — say "this may create legal risk under [law]" and recommend legal counsel.
Keep responses under 200 words unless asked for more detail.`;
  }, [auditContext]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', text };
    const loadingMsg = { role: 'assistant', text: '', isLoading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => `${m.role === 'user' ? 'User' : 'VectoFair AI'}: ${m.text}`).join('\n');
      const systemCtx = buildSystemContext();
      const prompt = `${systemCtx}\n\nConversation so far:\n${history}\n\nUser: ${text}\n\nVectoFair AI:`;
      let { text: response } = await callAI(ceoMode
        ? `${prompt}\n\n[INSTRUCTION: Respond in exactly 3 sentences in plain executive English. No jargon. Focus on the key finding and one recommended action.]`
        : prompt);

      setMessages(prev => prev.slice(0, -1).concat([{ role: 'assistant', text: response }]));
    } catch {
      setMessages(prev => prev.slice(0, -1).concat([{ role: 'assistant', text: 'I had trouble connecting. Please check your AI configuration and try again.' }]));
    }
    setLoading(false);
  }, [messages, loading, buildSystemContext, ceoMode]);

  const starterChips = auditContext?.isHome
    ? [
        'Which module should I use for HR hiring bias?',
        'How do I prepare my CSV for the Loan Approval audit?',
        'What is Disparate Impact and why does it matter?',
        'Which legal standards does VectoFair AI cover?',
      ]
    : auditContext
    ? STARTER_CHIP_TEMPLATES.map(fn => fn({
        worstFinding: auditContext.findings?.[0]?.title?.split('—')[0]?.trim(),
        highestSeverity: auditContext.findings?.[0]?.severity,
        score: auditContext.score,
      }))
    : [];

  const clearChat = () => setMessages([]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 999 }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '420px',
        backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column',
        zIndex: 1000, boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
        animation: 'slideInRight 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-icons-round" style={{ fontSize: '18px', color: '#fff' }}>auto_awesome</span>
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>Ask VectoFair AI</div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>{auditContext?.moduleName || 'Audit Assistant'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={clearChat} title="Clear chat" style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid #334155', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-icons-round" style={{ fontSize: '14px' }}>delete_sweep</span>
            </button>
            <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid #334155', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-icons-round" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #1e293b', display: 'flex', gap: '8px' }}>
          <button onClick={() => setCeoMode(false)} style={{ flex: 1, padding: '6px', backgroundColor: !ceoMode ? '#4f46e5' : 'transparent', color: '#fff', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>
            Technical Mode
          </button>
          <button onClick={() => setCeoMode(true)} style={{ flex: 1, padding: '6px', backgroundColor: ceoMode ? '#4f46e5' : 'transparent', color: '#fff', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>
            🎯 CEO Mode (3 sentences)
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}

          {/* Starter Chips — only when no real conversation yet */}
          {messages.length <= 1 && starterChips.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: '600' }}>SUGGESTED QUESTIONS</div>
              {starterChips.map((chip, i) => (
                <button key={i} onClick={() => sendMessage(chip)} style={{
                  display: 'block', width: '100%', textAlign: 'left', marginBottom: '6px',
                  padding: '8px 12px', backgroundColor: '#1e293b', color: '#94a3b8',
                  border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '12px', lineHeight: '1.4'
                }}>
                  {chip}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
              placeholder="Ask about your audit results..."
              disabled={loading}
              style={{
                flex: 1, padding: '10px 14px', backgroundColor: '#1e293b', color: '#e2e8f0',
                border: '1px solid #334155', borderRadius: '8px', fontSize: '13px',
                outline: 'none', fontFamily: 'inherit'
              }}
            />
            <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{
              width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#4f46e5',
              color: '#fff', border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span className="material-icons-round" style={{ fontSize: '18px' }}>send</span>
            </button>
          </div>
          <div style={{ fontSize: '10px', color: '#334155', marginTop: '6px', textAlign: 'center' }}>
            VectoFair AI provides analysis only — not legal advice
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </>
  );
}
