// VectoFair — Resume Demo Dataset
// 20 synthetic resumes with calibrated bias signals for judge demonstration
// Resumes 19 & 20 are the "Identical Qualification Pair" (Bertrand & Mullainathan effect)

export const RESUME_DEMO_DATA = [
  // ── RESUMES 1-4: Anglo names, top-50 universities, LOW bias risk ─────────────
  {
    id: 'R01',
    label: 'Resume 1',
    text: `John Smith
123 Oak Lane, Greenwich, CT 06830
john.smith@email.com | (203) 555-0101 | linkedin.com/in/johnsmith

PROFESSIONAL SUMMARY
Results-driven Software Engineer with 6 years of experience delivering scalable web applications. 
Passionate about clean architecture and team collaboration.

EDUCATION
B.S. Computer Science — Yale University, 2018 | GPA: 3.6
Relevant coursework: Algorithms, Distributed Systems, Machine Learning

EXPERIENCE
Senior Software Engineer — TechCorp Inc., New Haven, CT (2021–Present)
• Led migration of monolithic architecture to microservices, reducing latency by 40%
• Mentored team of 4 junior engineers; conducted weekly code reviews

Software Engineer — StartupXYZ, Stamford, CT (2018–2021)
• Built RESTful APIs serving 500K daily active users
• Implemented CI/CD pipeline reducing deployment time by 60%

SKILLS
Python, JavaScript, React, Node.js, AWS, Docker, Kubernetes, PostgreSQL

CERTIFICATIONS
AWS Certified Solutions Architect — Professional (2022)`,
    expectedScore: 18,
    nameCategory: 'Anglo',
  },

  {
    id: 'R02',
    label: 'Resume 2',
    text: `Emily Johnson
456 Maple Drive, Westport, CT 06880
emily.johnson@email.com | (203) 555-0202

OBJECTIVE
Dedicated Marketing Manager with 5 years building brand strategies for Fortune 500 companies.

EDUCATION
B.A. Marketing — University of Michigan, 2019 | GPA: 3.8
Dean's List (all semesters)

EXPERIENCE
Marketing Manager — GlobalBrands LLC, New York, NY (2022–Present)
• Managed $2M annual advertising budget across digital and traditional channels
• Grew organic social media engagement by 180% in 18 months

Marketing Associate — MediaGroup Co., Westport, CT (2019–2022)
• Created content strategy for 12 B2B clients
• Coordinated cross-functional campaigns with design and sales teams

AWARDS & RECOGNITION
Rising Star Award — MediaGroup Co. (2021)
American Marketing Association Member

SKILLS
Google Analytics, Salesforce, HubSpot, Adobe Creative Suite, SEO/SEM`,
    expectedScore: 15,
    nameCategory: 'Anglo',
  },

  {
    id: 'R03',
    label: 'Resume 3',
    text: `Michael Anderson
789 Birch Road, Westchester, NY 10601
m.anderson@email.com | (914) 555-0303

SUMMARY
Financial Analyst with 7 years of experience in investment banking and corporate finance.
CFA Charterholder with expertise in equity research and valuation modeling.

EDUCATION
B.S. Finance — University of Pennsylvania (Wharton), 2017 | GPA: 3.7
MBA — Columbia Business School, 2020

EXPERIENCE
Senior Financial Analyst — Premier Capital, New York, NY (2020–Present)
• Executed $500M+ in M&A transactions across healthcare and technology sectors
• Built DCF and LBO models used in board-level strategy presentations

Financial Analyst — Goldman Sachs, New York, NY (2017–2020)
• Supported senior bankers in IPO preparation for 8 companies
• Managed weekly earnings model updates for a 40-stock coverage universe

SKILLS
Excel, Bloomberg, FactSet, Python, SQL, PowerPoint

CERTIFICATIONS
CFA Charterholder (2021) | Series 7 & 63 Licensed`,
    expectedScore: 20,
    nameCategory: 'Anglo',
  },

  {
    id: 'R04',
    label: 'Resume 4',
    text: `Sarah Williams
321 Elm Street, Arlington, VA 22201
sarah.williams@email.com | (703) 555-0404

PROFILE
Experienced Operations Manager with 8 years optimizing supply chains and logistics networks.

EDUCATION
B.S. Industrial Engineering — Georgia Tech, 2016 | GPA: 3.5

EXPERIENCE
Operations Manager — LogiTech Solutions, Arlington, VA (2020–Present)
• Reduced warehouse operational costs by 23% through process redesign
• Managed team of 25 across 3 distribution facilities

Operations Coordinator — National Logistics Corp., McLean, VA (2016–2020)
• Implemented ERP system reducing order processing time by 35%
• Coordinated with 50+ vendors for on-time delivery performance

EDUCATION (CONTINUING)
Lean Six Sigma Black Belt Certification (2021)

SKILLS
SAP, Oracle ERP, Excel, Supply Chain Analytics, Lean/Six Sigma, Team Leadership`,
    expectedScore: 22,
    nameCategory: 'Anglo',
  },

  // ── RESUMES 5-8: African-American names, identical qualifications to 1-4 ─────
  {
    id: 'R05',
    label: 'Resume 5',
    text: `Jamal Washington
987 Cedar Avenue, Hartford, CT 06101
jamal.washington@email.com | (860) 555-0505

PROFESSIONAL SUMMARY
Results-driven Software Engineer with 6 years of experience delivering scalable web applications.
Passionate about clean architecture and team collaboration.

EDUCATION
B.S. Computer Science — Yale University, 2018 | GPA: 3.6
Relevant coursework: Algorithms, Distributed Systems, Machine Learning

EXPERIENCE
Senior Software Engineer — TechCorp Inc., Hartford, CT (2021–Present)
• Led migration of monolithic architecture to microservices, reducing latency by 40%
• Mentored team of 4 junior engineers; conducted weekly code reviews

Software Engineer — StartupXYZ, Hartford, CT (2018–2021)
• Built RESTful APIs serving 500K daily active users
• Implemented CI/CD pipeline reducing deployment time by 60%

SKILLS
Python, JavaScript, React, Node.js, AWS, Docker, Kubernetes, PostgreSQL

CERTIFICATIONS
AWS Certified Solutions Architect — Professional (2022)`,
    expectedScore: 72,
    nameCategory: 'African-American',
  },

  {
    id: 'R06',
    label: 'Resume 6',
    text: `Lakisha Jones
654 Spruce Street, Brooklyn, NY 11201
lakisha.jones@email.com | (718) 555-0606

OBJECTIVE
Dedicated Marketing Manager with 5 years building brand strategies for Fortune 500 companies.

EDUCATION
B.A. Marketing — University of Michigan, 2019 | GPA: 3.8
Dean's List (all semesters)

EXPERIENCE
Marketing Manager — GlobalBrands LLC, New York, NY (2022–Present)
• Managed $2M annual advertising budget across digital and traditional channels
• Grew organic social media engagement by 180% in 18 months

Marketing Associate — MediaGroup Co., Brooklyn, NY (2019–2022)
• Created content strategy for 12 B2B clients
• Coordinated cross-functional campaigns with design and sales teams

AWARDS & RECOGNITION
Rising Star Award — MediaGroup Co. (2021)
National Black MBA Association Member

SKILLS
Google Analytics, Salesforce, HubSpot, Adobe Creative Suite, SEO/SEM`,
    expectedScore: 78,
    nameCategory: 'African-American',
  },

  {
    id: 'R07',
    label: 'Resume 7',
    text: `DeShawn Williams
147 Willow Court, Chicago, IL 60601
deshawn.williams@email.com | (312) 555-0707

SUMMARY
Financial Analyst with 7 years of experience in investment banking and corporate finance.
CFA Charterholder with expertise in equity research and valuation modeling.

EDUCATION
B.S. Finance — University of Pennsylvania (Wharton), 2017 | GPA: 3.7
MBA — Columbia Business School, 2020

EXPERIENCE
Senior Financial Analyst — Premier Capital, Chicago, IL (2020–Present)
• Executed $500M+ in M&A transactions across healthcare and technology sectors
• Built DCF and LBO models used in board-level strategy presentations

Financial Analyst — Goldman Sachs, Chicago, IL (2017–2020)
• Supported senior bankers in IPO preparation for 8 companies
• Managed weekly earnings model updates for a 40-stock coverage universe

SKILLS
Excel, Bloomberg, FactSet, Python, SQL, PowerPoint

CERTIFICATIONS
CFA Charterholder (2021) | Series 7 & 63 Licensed`,
    expectedScore: 65,
    nameCategory: 'African-American',
  },

  {
    id: 'R08',
    label: 'Resume 8',
    text: `Aaliyah Robinson
258 Magnolia Lane, Atlanta, GA 30301
aaliyah.robinson@email.com | (404) 555-0808

PROFILE
Experienced Operations Manager with 8 years optimizing supply chains and logistics networks.

EDUCATION
B.S. Industrial Engineering — Georgia Tech, 2016 | GPA: 3.5

EXPERIENCE
Operations Manager — LogiTech Solutions, Atlanta, GA (2020–Present)
• Reduced warehouse operational costs by 23% through process redesign
• Managed team of 25 across 3 distribution facilities

Operations Coordinator — National Logistics Corp., Decatur, GA (2016–2020)
• Implemented ERP system reducing order processing time by 35%
• Coordinated with 50+ vendors for on-time delivery performance

EDUCATION (CONTINUING)
Lean Six Sigma Black Belt Certification (2021)

SKILLS
SAP, Oracle ERP, Excel, Supply Chain Analytics, Lean/Six Sigma, Team Leadership`,
    expectedScore: 68,
    nameCategory: 'African-American',
  },

  // ── RESUMES 9-11: Hispanic names + address signals ─────────────────────────
  {
    id: 'R09',
    label: 'Resume 9',
    text: `Carlos Rodriguez
1225 East Olympic Blvd, Los Angeles, CA 90021
c.rodriguez@email.com | (323) 555-0909

SUMMARY
Full-Stack Developer with 5 years building enterprise web applications.
Bilingual (English/Spanish) professional with strong cross-cultural communication skills.

EDUCATION
B.S. Computer Science — UCLA, 2019 | GPA: 3.7

EXPERIENCE
Full-Stack Developer — TechInnovate LA, Los Angeles, CA (2021–Present)
• Developed e-commerce platform handling $10M annual transactions
• Optimized database queries reducing page load time by 55%

Junior Developer — WebSolutions Inc., Los Angeles, CA (2019–2021)
• Built mobile-responsive interfaces for 20+ client projects
• Participated in agile sprints, averaging 94% sprint completion rate

SKILLS
React, Node.js, Python, Django, PostgreSQL, MongoDB, AWS, Docker`,
    expectedScore: 62,
    nameCategory: 'Hispanic',
  },

  {
    id: 'R10',
    label: 'Resume 10',
    text: `Maria Gutierrez
4500 South Central Ave, Los Angeles, CA 90011
maria.gutierrez@email.com | (323) 555-1010

PROFESSIONAL PROFILE
Human Resources Manager with 6 years developing talent acquisition strategies.
Fluent in English and Spanish — managed bilingual recruitment campaigns.

EDUCATION
B.A. Human Resources Management — Cal State LA, 2018 | GPA: 3.6
SHRM-CP Certified Professional (2020)

EXPERIENCE
HR Manager — RegionalHealth Systems, Los Angeles, CA (2021–Present)
• Reduced time-to-hire by 30% through structured interview process redesign
• Managed annual recruitment budget of $800K for 150+ positions

HR Coordinator — Pacific Staffing Group, Los Angeles, CA (2018–2021)
• Processed 500+ applications per quarter for 12 client companies
• Led diversity recruitment initiative increasing minority hires by 22%

SKILLS
Workday, ADP, LinkedIn Recruiter, HRIS Systems, Employment Law, Conflict Resolution`,
    expectedScore: 60,
    nameCategory: 'Hispanic',
  },

  {
    id: 'R11',
    label: 'Resume 11',
    text: `Jose Martinez
7800 Normandie Ave, Los Angeles, CA 90044
jose.martinez@email.com | (323) 555-1111

OBJECTIVE
Supply Chain Analyst with 4 years driving cost efficiencies in complex logistics environments.
Seeking to leverage bilingual communication skills in a global operations role.

EDUCATION
B.S. Supply Chain Management — Cal Poly Pomona, 2020 | GPA: 3.5

EXPERIENCE
Supply Chain Analyst — Pacific Distribution Co., Los Angeles, CA (2022–Present)
• Identified $1.2M in annual cost savings through vendor renegotiation
• Managed inventory for 8,000+ SKUs across 3 warehouses

Logistics Coordinator — SoCal Freight Inc., Commerce, CA (2020–2022)
• Coordinated 200+ daily shipments with 98.5% on-time delivery rate
• Implemented tracking system reducing customer inquiries by 40%

SKILLS
SAP, Excel, Tableau, Vendor Management, Logistics Optimization, Spanish/English`,
    expectedScore: 58,
    nameCategory: 'Hispanic',
  },

  // ── RESUMES 12-13: Asian names + international education ──────────────────
  {
    id: 'R12',
    label: 'Resume 12',
    text: `Wei Zhang
55 West 42nd Street, Apt 8C, New York, NY 10036
wei.zhang@email.com | (212) 555-1212

SUMMARY
Data Scientist with 5 years building predictive models for financial services.
Seeks full-time employment (visa sponsorship not required).

EDUCATION
B.S. Mathematics — Peking University, China, 2017 | GPA: 3.9
M.S. Data Science — New York University, 2019 | GPA: 3.8

EXPERIENCE
Data Scientist — Quantitative Analytics Partners, New York, NY (2019–Present)
• Developed fraud detection model with 97.3% accuracy, saving $15M annually
• Built NLP pipeline processing 2M customer support tickets per month

Research Assistant — NYU Center for Data Science (2018–2019)
• Co-authored paper on time-series forecasting (published in IEEE)

SKILLS
Python, R, TensorFlow, PyTorch, SQL, Spark, Tableau, Statistical Modeling`,
    expectedScore: 52,
    nameCategory: 'Asian',
  },

  {
    id: 'R13',
    label: 'Resume 13',
    text: `Priya Patel
890 Commonwealth Ave, Apt 3B, Boston, MA 02215
priya.patel@email.com | (617) 555-1313

PROFILE
Product Manager with 4 years launching digital health products in the US and South Asian markets.

EDUCATION
B.Tech Engineering — IIT Bombay, India, 2018 | GPA: 8.7/10
M.B.A. — Boston University Questrom School of Business, 2020 | GPA: 3.7

EXPERIENCE
Product Manager — HealthTech Innovations, Boston, MA (2020–Present)
• Launched patient engagement app reaching 200K users in 8 months
• Managed cross-functional team of 12 across engineering, design, and clinical

Associate Product Manager — Tata Consultancy Services, Mumbai, India (2018–2019)
• Shipped 3 enterprise software features for 50,000+ users

SKILLS
Agile/Scrum, JIRA, SQL, A/B Testing, User Research, Figma`,
    expectedScore: 48,
    nameCategory: 'South Asian',
  },

  // ── RESUME 14: Age discrimination risk ───────────────────────────────────
  {
    id: 'R14',
    label: 'Resume 14',
    text: `Robert H. Thompson
1400 University Ave, Madison, WI 53706
robert.thompson@email.com | (608) 555-1414

EXECUTIVE SUMMARY
Seasoned IT Director with 30+ years building enterprise technology infrastructure. 
Former CTO of a $200M regional manufacturing firm. Available immediately.

EDUCATION
B.S. Electrical Engineering — University of Wisconsin-Madison, 1989 | GPA: 3.8
Executive Leadership Program — Kellogg School of Management, 2005

EXPERIENCE
IT Director — Midwest Manufacturing Corp., Milwaukee, WI (2015–2024, retired)
• Oversaw $15M IT infrastructure budget and 45-person technology department
• Led digital transformation initiative, migrating all legacy systems to cloud

CTO — RegionalTech Partners, Madison, WI (2005–2015)
• Grew engineering team from 8 to 67 professionals over 10 years
• Architected microservices platform serving 2M enterprise users

Systems Architect — IBM Corporation, Chicago, IL (1993–2005)

SKILLS
Enterprise Architecture, Cloud Migration (AWS/Azure), ITIL, Budget Management, 
Executive Leadership, Strategic Planning, C++, Java, Python (recent training)

CERTIFICATIONS
PMP Certified (2003, renewed 2023) | CISSP (2010, active)`,
    expectedScore: 71,
    nameCategory: 'Anglo',
  },

  // ── RESUME 15: Career gap candidate ──────────────────────────────────────
  {
    id: 'R15',
    label: 'Resume 15',
    text: `Jennifer Clarke
222 Brookside Road, Portland, OR 97201
jennifer.clarke@email.com | (503) 555-1515

PROFESSIONAL SUMMARY
Strategic Communications Director returning to the workforce after a caregiving hiatus.
Former agency leader with 10 years of award-winning marketing campaigns.

EDUCATION
B.A. Communications — University of Oregon, 2012 | GPA: 3.9

EXPERIENCE
Communications Director — Pacific Marketing Agency, Portland, OR (2016–2019)
• Managed $5M client portfolio across tech, nonprofit, and healthcare sectors
• Led team of 18 creatives and strategists; won 4 industry ADDY awards

Senior Communications Manager — Brand Forward Inc., Seattle, WA (2012–2016)
• Launched 30+ integrated campaigns for regional and national brands

Career Break (2019–2021)
Primary caregiver for two young children during COVID-19 pandemic.
Maintained skills through online coursework: Google Analytics, HubSpot Certification.

Marketing Consultant — Self-employed, Portland, OR (2021–Present, part-time)
• Provided fractional CMO services to 3 early-stage startups

SKILLS
Brand Strategy, Content Marketing, Social Media, Analytics, Team Leadership, Public Relations`,
    expectedScore: 58,
    nameCategory: 'Anglo',
  },

  // ── RESUME 16: HBCU graduate ──────────────────────────────────────────────
  {
    id: 'R16',
    label: 'Resume 16',
    text: `Marcus Johnson
3400 Georgia Ave NW, Washington, DC 20010
marcus.johnson@email.com | (202) 555-1616

SUMMARY
Civil Engineer with 5 years delivering infrastructure projects on time and under budget.
Committed to sustainable design and community-centered urban planning.

EDUCATION
B.S. Civil Engineering — Howard University (HBCU), Washington, DC, 2019 | GPA: 3.8
Honor Roll — all 8 semesters | National Society of Black Engineers (NSBE) Chapter President

EXPERIENCE
Project Engineer — Capital Infrastructure Partners, Washington, DC (2021–Present)
• Managed 3 concurrent road rehabilitation projects totaling $18M
• Reduced project overrun rate from 22% to 4% through schedule optimization

Junior Engineer — DC Department of Transportation (2019–2021)
• Designed traffic calming measures for 12 residential corridors
• Collaborated with community stakeholders to ensure equitable access

PROFESSIONAL AFFILIATIONS
NSBE National Member | American Society of Civil Engineers (ASCE)

SKILLS
AutoCAD, Civil3D, GIS, Project Management, Structural Analysis, LEED Green Associate`,
    expectedScore: 45,
    nameCategory: 'African-American',
  },

  // ── RESUME 17: First-generation college student ───────────────────────────
  {
    id: 'R17',
    label: 'Resume 17',
    text: `Sofia Hernandez
8900 Broadview Ave, Cleveland, OH 44105
sofia.hernandez@email.com | (216) 555-1717

ABOUT ME
First-generation college graduate and proud community college transfer student.
Nursing professional with 3 years clinical experience in underserved communities.

EDUCATION
Associate Degree, Pre-Nursing — Cuyahoga Community College, 2019
B.S. Nursing (RN-BSN) — Cleveland State University, 2021 | GPA: 3.7
Pell Grant Recipient | TRIO Program Scholar

EXPERIENCE
Registered Nurse — MetroHealth Medical Center, Cleveland, OH (2021–Present)
• Provide care for 8–12 patients per shift in high-acuity medical-surgical unit
• Consistently rated 4.8/5.0 in patient satisfaction surveys

Clinical Intern — Free Clinic of Greater Cleveland (2020–2021)
• Assisted with primary care for uninsured and underinsured patients
• Pioneered health literacy workshop series reaching 200+ community members

VOLUNTEER WORK
Health educator at local middle schools — bilingual English/Spanish presentations

SKILLS
Patient Assessment, Electronic Health Records (Epic), IV Therapy, Wound Care, 
Spanish (fluent), Team Collaboration, Critical Thinking`,
    expectedScore: 55,
    nameCategory: 'Hispanic',
  },

  // ── RESUME 18: Disability disclosure ─────────────────────────────────────
  {
    id: 'R18',
    label: 'Resume 18',
    text: `David Chen
567 Innovation Drive, Austin, TX 78701
david.chen@email.com | (512) 555-1818

PROFESSIONAL SUMMARY
UX Designer and accessibility advocate with 6 years creating inclusive digital experiences.
Wheelchair user and disability rights activist who brings lived experience to accessibility work.

EDUCATION
B.F.A. Graphic Design — UT Austin, 2018 | GPA: 3.6
Certificate in Human-Computer Interaction — Georgia Tech Online, 2020

EXPERIENCE
Senior UX Designer — TechAccessibility Corp., Austin, TX (2021–Present)
• Led accessibility audit of government portal serving 4M Texans with disabilities
• Designed ADA-compliant UI patterns adopted by 12 enterprise clients
• Required workplace accommodation: standing desk and flexible hours

UX Designer — Creative Digital Agency, Austin, TX (2018–2021)
• Redesigned banking app increasing task completion rate by 34%
• Won "Design for All" award from Disability:IN Austin chapter

COMMUNITY INVOLVEMENT
Board Member — Austin Center for Independent Living
Speaker — CSUN Assistive Technology Conference (2022, 2023)

SKILLS
Figma, Adobe XD, Sketch, WCAG 2.1/2.2, ARIA, User Research, Prototyping, HTML/CSS`,
    expectedScore: 75,
    nameCategory: 'Asian',
  },

  // ── RESUME 19: IDENTICAL PAIR — Anglo name (LOW bias risk) ────────────────
  {
    id: 'R19',
    label: 'Resume 19 — Identical Pair (Anglo)',
    isPairA: true,
    text: `Brendan Kelly
10 Harbor View Drive, Boston, MA 02110
brendan.kelly@email.com | (617) 555-1919

PROFESSIONAL SUMMARY
Business Analyst with 4 years translating data into actionable strategy for mid-market companies.
Expert in process optimization, stakeholder communication, and Tableau dashboards.

EDUCATION
B.S. Business Administration — Boston College, 2020 | GPA: 3.6

EXPERIENCE
Business Analyst — Northeast Consulting Group, Boston, MA (2022–Present)
• Delivered 14 process improvement projects with average ROI of 180%
• Built executive dashboards used by C-suite in weekly strategy reviews

Junior Analyst — DataFirst Partners, Cambridge, MA (2020–2022)
• Analyzed customer churn for 8 SaaS clients, reducing average churn by 12%
• Automated weekly reporting saving 6 hours of manual work per week

SKILLS
SQL, Excel, Tableau, PowerBI, Python (Pandas), Stakeholder Management, Agile

CERTIFICATIONS
Tableau Desktop Specialist (2021) | Google Data Analytics Certificate (2022)`,
    expectedScore: 19,
    nameCategory: 'Anglo',
  },

  // ── RESUME 20: IDENTICAL PAIR — African-American name (HIGH bias risk) ────
  {
    id: 'R20',
    label: 'Resume 20 — Identical Pair (African-American)',
    isPairB: true,
    text: `Darnell Jackson
10 Harbor View Drive, Boston, MA 02110
darnell.jackson@email.com | (617) 555-2020

PROFESSIONAL SUMMARY
Business Analyst with 4 years translating data into actionable strategy for mid-market companies.
Expert in process optimization, stakeholder communication, and Tableau dashboards.

EDUCATION
B.S. Business Administration — Boston College, 2020 | GPA: 3.6

EXPERIENCE
Business Analyst — Northeast Consulting Group, Boston, MA (2022–Present)
• Delivered 14 process improvement projects with average ROI of 180%
• Built executive dashboards used by C-suite in weekly strategy reviews

Junior Analyst — DataFirst Partners, Cambridge, MA (2020–2022)
• Analyzed customer churn for 8 SaaS clients, reducing average churn by 12%
• Automated weekly reporting saving 6 hours of manual work per week

SKILLS
SQL, Excel, Tableau, PowerBI, Python (Pandas), Stakeholder Management, Agile

CERTIFICATIONS
Tableau Desktop Specialist (2021) | Google Data Analytics Certificate (2022)`,
    expectedScore: 72,
    nameCategory: 'African-American',
  },
];

// ── Expected batch statistics ─────────────────────────────────────────────────
export const DEMO_BATCH_EXPECTATIONS = {
  poolFairnessScore: 38,
  angloAvgScore: 22,
  minorityAvgScore: 63,
  biasedShortlistAnglo: 8,
  biasedShortlistMinority: 2,
  totalResumes: 20,
};

export const DEMO_CONFIG = {
  name: '20 Synthetic Resume Pool',
  description: 'Pre-built dataset demonstrating real-world bias patterns in resume screening, including the Bertrand & Mullainathan identical-qualification experiment.',
  badge: '⚡ Judge Demo',
  icon: 'description',
  stats: [
    { label: 'Resumes', value: '20' },
    { label: 'Name Categories', value: '5' },
    { label: 'Bias Signals', value: '8' },
    { label: 'Pool Fairness', value: '38/100' },
  ],
};
