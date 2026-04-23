# VectoFair AI — Algorithmic Bias Detection & Fairness Audit Platform

<div align="center">

![VectoFair AI](https://img.shields.io/badge/VectoFair-AI%20Bias%20Audit-4f46e5?style=for-the-badge&logo=google&logoColor=white)
![Google Solution Challenge](https://img.shields.io/badge/Google-Solution%20Challenge%202025-EA4335?style=for-the-badge&logo=google&logoColor=white)
![React](https://img.shields.io/badge/React%2018-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-Hosting%20%26%20Functions-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Gemini AI](https://img.shields.io/badge/Google%20Gemini-1.5%20Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)

**VectoFair AI** is a production-ready, multi-domain algorithmic fairness audit platform.  
Upload a dataset, detect statistical bias across 18+ real-world domains, and receive a full AI-powered PDF audit report — in under 30 seconds.

[🚀 Live Demo](#-quick-start) · [📖 Docs](#-project-structure) · [🌍 Impact](#-impact--sdg-alignment)

</div>

---

## ✨ What is VectoFair AI?

VectoFair AI is an **enterprise-grade bias detection engine** built for the Google Solution Challenge 2025. It empowers organizations to audit AI systems and datasets for discrimination across **18 real-world domains** — from hiring and lending to healthcare and criminal justice.

Every audit is powered by **multi-model AI** (Google Gemini), computes industry-standard fairness metrics (Demographic Parity, Disparate Impact, Equal Opportunity), and delivers results as a professional downloadable PDF report.

> 🏆 **Addresses UN SDG 10 — Reduced Inequalities** by making algorithmic fairness auditing accessible to every team, not just data scientists.

---

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| **18 Audit Domains** | HR, Finance, Healthcare, Education, Criminal Justice & more |
| **AI-Powered Explanations** | Google Gemini 1.5 Flash explains every bias finding in plain English |
| **PDF Audit Reports** | Professional, downloadable reports via jsPDF in one click |
| **Demo Mode** | Fully functional offline — no API keys required |
| **Resume Screening Audit** | Upload CVs as PDFs/text, detect demographic bias in shortlisting |
| **Batch Pool Analysis** | Compare multiple candidates and simulate blind screening |
| **VectoFair Chat** | Persistent AI chat assistant on every audit page |
| **Debiasing Simulator** | Interactive tool to model the impact of bias mitigations |
| **Compliance Reports** | EU AI Act & EEOC-aligned compliance documentation generator |
| **Android Native App** | Full WebView-based Android app with native navigation |

---

## 🏢 Supported Audit Domains

<table>
<tr><th>Category</th><th>Modules</th></tr>
<tr>
  <td>💼 <b>HR & Employment</b></td>
  <td>Hiring CSV Audit, Resume Screening, Pay Gap Analysis, Promotion Pipeline, Performance Review Bias, Compliance Report Generator</td>
</tr>
<tr>
  <td>💳 <b>Finance</b></td>
  <td>Loan Approval, Credit Limit Fairness, Fraud Flag Disparity, Insurance Premium Bias</td>
</tr>
<tr>
  <td>🏥 <b>Healthcare</b></td>
  <td>Treatment Recommendation Bias, Clinical Trial Diversity, Hospital Resource Allocation, Diagnostic Model Fairness</td>
</tr>
<tr>
  <td>🎓 <b>Education</b></td>
  <td>Admissions Algorithm Audit, AI Grading Fairness, Scholarship Bias, Learning Path Bias</td>
</tr>
<tr>
  <td>⚖️ <b>Criminal Justice</b></td>
  <td>Recidivism Model Audit, Government Benefit Allocation, Public Service Access</td>
</tr>
</table>

---

## 🚀 Quick Start (Demo Mode — No Setup Required)

```bash
# 1. Clone the repository
git clone https://github.com/Rahman-001/VectoFair-AI.git
cd VectoFair-AI

# 2. Install dependencies
cd frontend
npm install

# 3. Start the dev server
npm run dev

# 4. Open http://localhost:5173
# Click any domain card → "Try Demo Dataset" → "Analyze for Bias"
```

> ✅ The app runs **100% offline** with rich demo datasets. Add a Gemini API key to unlock live AI explanations.

---

## 🔑 Environment Setup (Optional — Enables Live AI)

```bash
cd frontend
cp ../.env.example .env
```

Edit `.env`:
```env
VITE_GEMINI_API_KEY=AIzaSy...   # Google Gemini API key (free tier available)
```

Get a free key at → [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

---

## 🏗️ Project Structure

```
VectoFair-AI/
├── frontend/                        # React 18 + Vite web application
│   ├── public/
│   │   └── logo.png                 # VectoFair brand logo
│   ├── src/
│   │   ├── App.jsx                  # Root shell, routing, persistent header/footer
│   │   ├── index.css                # Premium white design system (89KB)
│   │   ├── components/
│   │   │   ├── DomainSelector.jsx   # 18-domain landing page with domain cards
│   │   │   ├── HomeScreen.jsx       # Home/onboarding screen
│   │   │   ├── UploadStep.jsx       # CSV upload + demo dataset loader
│   │   │   ├── AnalysisStep.jsx     # Animated 4-step bias analysis
│   │   │   ├── ResultsDashboard.jsx # Score, grade, Google Charts visualizations
│   │   │   ├── BiasCard.jsx         # Individual bias finding cards
│   │   │   │
│   │   │   ├── [HR Modules]
│   │   │   │   ├── PayGapDashboard.jsx
│   │   │   │   ├── PromotionDashboard.jsx
│   │   │   │   ├── PerformanceDashboard.jsx
│   │   │   │   ├── ComplianceDashboard.jsx
│   │   │   │   ├── ResumeDashboard.jsx
│   │   │   │   └── ResumeUploader.jsx
│   │   │   │
│   │   │   ├── [Finance Modules]
│   │   │   │   ├── LoanDashboard.jsx
│   │   │   │   ├── CreditLimitDashboard.jsx
│   │   │   │   ├── FraudDashboard.jsx
│   │   │   │   └── InsuranceDashboard.jsx
│   │   │   │
│   │   │   ├── [Healthcare Modules]
│   │   │   │   ├── TreatmentDashboard.jsx
│   │   │   │   ├── ClinicalTrialDashboard.jsx
│   │   │   │   ├── HospitalDashboard.jsx
│   │   │   │   └── DiagnosticsDashboard.jsx
│   │   │   │
│   │   │   ├── [Education Modules]
│   │   │   │   ├── AdmissionsDashboard.jsx
│   │   │   │   ├── GradingDashboard.jsx
│   │   │   │   ├── ScholarshipDashboard.jsx
│   │   │   │   └── LearningPathDashboard.jsx
│   │   │   │
│   │   │   ├── [Justice Modules]
│   │   │   │   ├── RecidivismDashboard.jsx
│   │   │   │   ├── BenefitsDashboard.jsx
│   │   │   │   └── PublicServiceDashboard.jsx
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── VectoFairChat.jsx        # Persistent Gemini AI chat assistant
│   │   │       ├── DebiasingSimulator.jsx   # Interactive bias mitigation simulator
│   │   │       ├── GeminiExplainCard.jsx    # AI explanation card component
│   │   │       ├── ComplianceBadge.jsx      # EU AI Act / EEOC compliance badges
│   │   │       ├── TestCasePanel.jsx        # In-app bias testing panel
│   │   │       └── UploadOrDemo.jsx         # Upload/demo toggle component
│   │   │
│   │   ├── data/                    # Domain-specific demo datasets
│   │   │   ├── payGapDemoData.js
│   │   │   ├── promotionDemoData.js
│   │   │   ├── performanceDemoData.js
│   │   │   ├── resumeDemoData.js
│   │   │   └── clinicalTrialDemoData.js
│   │   │
│   │   └── utils/                   # Core bias detection engine
│   │       ├── biasCalculator.js    # Demographic Parity, Disparate Impact, EO metrics
│   │       ├── aiClient.js          # Gemini API multi-model client
│   │       ├── pdfGenerator.js      # jsPDF audit report generator
│   │       ├── demoDataset.js       # 500-row TechCorp synthetic dataset generator
│   │       ├── batchBiasComparator.js  # Multi-candidate batch analysis
│   │       ├── resumeSignalExtractor.js # CV demographic signal extractor
│   │       └── biasRewriter.js      # AI-powered bias rewriting utility
│   │
│   ├── index.html                   # Google Charts + Material Icons CDN
│   └── vite.config.js
│
├── functions/                       # Firebase Cloud Functions (Node 18 backend)
│   ├── index.js                     # Gemini proxy, Firestore audit logging
│   └── package.json
│
├── firebase.json                    # Firebase hosting + functions config
├── firestore.rules                  # Firestore security rules
├── firestore.indexes.json
├── .env.example                     # Environment variable template
└── README.md
```

---

## 📊 Bias Metrics & Scoring

VectoFair computes three industry-standard fairness metrics for every protected attribute (gender, race, age, etc.):

| Metric | Formula | Threshold |
|--------|---------|-----------|
| **Demographic Parity** | P(Y=1\|A) − P(Y=1\|B) | > 0.2 = Severe |
| **Disparate Impact Ratio** | min(P) / max(P) | < 0.8 = Biased (EEOC 80% rule) |
| **Equal Opportunity** | TPR difference between groups | > 0.2 = Severe |

**Fairness Score (0–100):** Weighted composite of all metric penalties across all attributes.

**Grade Scale:**
| Grade | Score | Interpretation |
|-------|-------|---------------|
| 🟢 A | 90–100 | Excellent — deploy with confidence |
| 🟡 B | 80–89 | Good — minor review recommended |
| 🟠 C | 70–79 | Fair — targeted improvements needed |
| 🔴 D | 55–69 | Poor — significant bias detected |
| ⛔ F | < 55 | Critical — do not deploy |

---

## 🤖 AI Architecture

```
User uploads CSV / selects demo
         │
         ▼
  biasCalculator.js          ← Statistical bias engine (client-side)
  (Demographic Parity,
   Disparate Impact, EO)
         │
         ▼
  aiClient.js                ← Multi-model orchestrator
  ┌───────────────────┐
  │ Google Gemini     │      ← Primary: plain-English explanations
  │ 1.5 Flash         │
  └───────────────────┘
         │
         ▼
  pdfGenerator.js            ← jsPDF professional audit report
         │
         ▼
  Downloadable PDF           ← Per-finding + executive summary pages
```

The **VectoFair Chat** assistant (`VectoFairChat.jsx`) maintains context of the current audit session, allowing users to ask follow-up questions about specific findings, ask for mitigation strategies, or explore regulatory implications.

---

## 🔥 Firebase Deployment

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Build & deploy
cd frontend && npm run build
cd ..
firebase deploy

# → https://your-project.web.app
```

### Required Firebase Services:
- ✅ Firebase Hosting
- ✅ Cloud Functions (Node 18)
- ✅ Cloud Firestore
- ✅ Anonymous Authentication

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 18 + Vite |
| **Styling** | Vanilla CSS — Premium White Design System |
| **Charts & Visualizations** | Google Charts API |
| **AI Engine** | Google Gemini 1.5 Flash |
| **PDF Generation** | jsPDF + jsPDF-AutoTable |
| **CSV Parsing** | PapaParse |
| **Backend** | Firebase Cloud Functions (Node 18) |
| **Database** | Cloud Firestore |
| **Authentication** | Firebase Anonymous Auth |
| **Hosting** | Firebase Hosting |
| **Icons** | Material Design Icons (Round) |
| **Mobile** | Android WebView App (Kotlin) |

---

## 🎬 2-Minute Demo Script (for Judges)

| Time | Action |
|------|--------|
| **0:00** | Open the app — point out the 18-domain landing page |
| **0:10** | Click **Hiring CSV Audit** → click **Try Demo Dataset** |
| **0:20** | Show the 500-row TechCorp dataset preview (gender, age, hired columns) |
| **0:35** | Click **Analyze for Bias** — walk through the 4-step animated analysis |
| **0:55** | Dashboard loads — highlight **Score: 41/100, Grade: D** |
| **1:05** | Point to the Google Charts gauge — "industry standard is above 80" |
| **1:15** | Scroll to **Gender Bias** — SEVERE badge, 34% vs 61% hiring rate |
| **1:25** | Read the Gemini AI explanation — real-world impact context |
| **1:35** | Click **Ask VectoFair AI** → ask "How do I fix this?" |
| **1:45** | Click **Download Audit Report** — PDF downloads instantly |
| **1:55** | Navigate to **Loan Approval** domain — show cross-domain breadth |
| **2:00** | "18 domains. 30 seconds. Enterprise-grade fairness auditing for everyone." |

---

## 🌍 Impact & SDG Alignment

VectoFair AI directly addresses **UN Sustainable Development Goal 10 — Reduced Inequalities**.

**Real-world impact:**

- 👩‍💼 **HR Teams** — Audit hiring algorithms before deployment to prevent discrimination lawsuits
- 🏦 **Lenders** — Review loan approval models for ECOA & fair lending compliance
- 🏥 **Healthcare Providers** — Ensure diagnostic and treatment AI doesn't discriminate by race or gender
- 🎓 **Universities** — Audit admissions processes for socioeconomic and demographic bias
- ⚖️ **Governments** — Review recidivism models and benefit allocation algorithms for systemic bias

**Why it matters:**
> Studies show 60M+ workers are affected by biased hiring algorithms annually. Less than 1% of organizations audit their AI systems for bias before deployment. VectoFair removes the data-science barrier — making auditing a one-click operation.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or pull request.

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/new-domain`
3. Commit your changes: `git commit -m 'Add new domain audit module'`
4. Push to the branch: `git push origin feature/new-domain`
5. Open a Pull Request

---

## 📄 License

MIT License © 2025 VectoFair AI — Built for Google Solution Challenge 2025

---

<div align="center">
  <b>Built with ❤️ for Google Solution Challenge 2025</b><br>
  <sub>Powered by Google Gemini AI · Firebase · React · Material Design</sub>
</div>
