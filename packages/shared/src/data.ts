import type { CVData } from './types';

export const cvData: CVData = {
  name: 'Ahmed Moghazy',

  professionalSummary:
    'Data Science graduate specializing in machine learning, applied AI, and data-driven systems. ' +
    'Experienced in designing and deploying end-to-end ML solutions including AutoML pipelines, ' +
    'predictive modeling, and retrieval-augmented generation (RAG) applications using large language models. ' +
    'Strong background in data analysis, feature engineering, and model evaluation, with hands-on ' +
    'exposure to data engineering workflows, MLOps practices, and translating complex data into ' +
    'actionable business insights.',

  contact: {
    email: 'akhaledmoghazy@gmail.com',
    phone: '(+20) 115 322 7992',
    linkedin: 'https://linkedin.com/in/ahmed-khaled-17s',
    github: 'https://github.com/moghazy17',
    location: 'Cairo, EG',
  },

  education: {
    degree: 'Computer Science — Bachelor of Science',
    institution: 'Cairo University',
    faculty: 'Faculty of Computers & AI',
    location: 'Giza, Egypt',
    gpa: '3.33',
    startDate: 'Oct 2021',
    endDate: 'June 2025',
    coursework: [
      'Machine Learning',
      'Introduction to Data Science',
      'Mathematical Optimization',
      'Operating Systems',
      'Database Systems',
      'Advanced Databases',
      'Software Engineering',
      'Algorithm Design & Analysis',
      'Object-Oriented Programming',
    ],
  },

  experience: [
    {
      company: 'Advanced Computer Technology (ACT)',
      shortName: 'act',
      role: 'Software Developer (AI & Backend)',
      startDate: 'Oct 2025',
      endDate: 'Present',
      bullets: [
        'Architected a Multi-Agent Concierge System using LangGraph, orchestrating specialized agents with 95% intent classification accuracy.',
        'Engineered a Hierarchical RAG Pipeline in PGVector, reducing hallucinations by 30% on long-form queries.',
        'Integrated LLM Tool-Access with Oracle Opera PMS via REST APIs, reducing manual front-desk workload by 40%.',
        'Containerized the entire multi-agent stack using Docker, streamlining CI/CD pipeline.',
      ],
    },
    {
      company: 'Digital Egypt Pioneers Initiative (DEPI)',
      shortName: 'depi',
      role: 'Machine Learning Engineer Trainee',
      startDate: 'Oct 2024',
      endDate: 'Apr 2025',
      bullets: [
        'Completed the Microsoft ML Engineer track, focusing on scalable production-ready ML solutions.',
        'Built foundations in statistics, linear algebra, Python, classical ML, deep learning, NLP, and computer vision.',
        'Applied Azure AI Fundamentals and Azure AI Engineer Associate concepts with MLflow and Hugging Face.',
      ],
    },
    {
      company: 'Orange Egypt',
      shortName: 'orange',
      role: 'Data Engineer Intern',
      startDate: 'Aug 2024',
      endDate: 'Sep 2024',
      bullets: [
        'Automated and optimized ETL workflows for company voucher data using Apache NiFi and dbt models.',
        'Explored pipeline orchestration and scheduling using Apache Airflow.',
      ],
    },
    {
      company: 'ValU',
      shortName: 'valu',
      role: 'Data Science Intern',
      startDate: 'July 2024',
      endDate: 'July 2024',
      bullets: [
        'Analyzed company growth metrics and customer behavior for data-driven strategic insights.',
        'Designed interactive Power BI dashboards visualizing KPIs for executive decision-making.',
        'Built ML models (Random Forest, XGBoost) for customer lifetime value prediction, achieving AUC of 0.70.',
        'Contributed to a customer-facing chatbot using NER for accurate offer retrieval.',
        'Optimized LLM prompts for intent extraction, reducing inference costs by ~30%.',
      ],
    },
    {
      company: 'Advanced Computer Technology (ACT)',
      shortName: 'act-intern',
      role: 'Data Science Intern',
      startDate: 'Aug 2023',
      endDate: 'Sep 2023',
      bullets: [
        'Conducted EDA on large datasets and presented insights to stakeholders.',
        'Automated web scraping pipelines using BeautifulSoup.',
      ],
    },
  ],

  projects: [
    {
      name: 'AI-Powered Tech News Aggregator',
      shortName: 'news-aggregator',
      techStack: 'n8n, LLMs',
      startDate: 'Jan 2026',
      endDate: 'Jan 2026',
      isGraduation: false,
      bullets: [
        'Built an automated news aggregation pipeline using n8n to ingest RSS feeds on a scheduled basis.',
        'Implemented LLM-based classification and ranking to categorize articles and score importance.',
        'Designed workflows to store results in Google Sheets and deliver curated HTML email summaries.',
      ],
    },
    {
      name: 'AutoML Pipeline',
      shortName: 'automl',
      techStack: 'scikit-learn',
      startDate: 'Oct 2024',
      endDate: 'June 2025',
      isGraduation: true,
      bullets: [
        'Engineered a modular AutoML pipeline with 4 stages: preprocessing, feature selection, model selection, and HPO.',
        'Synthesized AutoML foundations into the system architecture and experiment plan.',
        'Benchmarked Grid Search, Random Search, and Bayesian Optimization for HPO on tabular ML tasks.',
      ],
    },
    {
      name: 'RAG Chatbot',
      shortName: 'rag-chatbot',
      techStack: 'LangChain + FAISS + Ollama',
      startDate: 'Dec 2024',
      endDate: 'Jan 2025',
      isGraduation: false,
      bullets: [
        'Built a retrieval-augmented chatbot with LangChain + Ollama Gemma-3 (12B) and Gradio UI.',
        'Crawled 30 LangChain doc pages; chunked via RecursiveCharacterTextSplitter.',
        'Embedded with all-MiniLM-L6-v2, indexed in FAISS; used MultiQueryRetriever + ContextualCompressionRetriever.',
      ],
    },
    {
      name: 'ExpenSum — Smart Expense Tracker',
      shortName: 'expensum',
      techStack: 'React + Spring Boot + JWT + LLM',
      startDate: 'Apr 2025',
      endDate: 'May 2025',
      isGraduation: false,
      bullets: [
        'Developed a full-stack expense tracker: React frontend + Spring Boot backend secured with JWT.',
        'Integrated Mistral (via Ollama) to convert natural-language inputs into structured expense entries.',
      ],
    },
    {
      name: 'Star-Schema Data Warehouse',
      shortName: 'star-schema',
      techStack: 'SQL, ETL',
      startDate: 'Dec 2023',
      endDate: 'Jan 2024',
      isGraduation: false,
      bullets: [
        'Designed a star schema (fact/dimension) for a recommendation dataset.',
        'Automated daily CSV loads via scheduled SQL jobs (ETL).',
      ],
    },
  ],

  certifications: [
    {
      title: 'Deep Learning Specialization',
      issuer: 'DeepLearning.AI',
      startDate: 'Oct 2024',
      endDate: 'Dec 2024',
      bullets: [],
    },
    {
      title: 'ICT Global Competition — AI Section Lead (Cloud Track)',
      issuer: 'Huawei',
      startDate: 'Nov 2024',
      endDate: 'May 2025',
      bullets: [
        'Won the Second Prize Globally in the Huawei ICT Global Competition (Cloud Track).',
        'Awarded the Grand Prize in the North Africa Region, representing Egypt in the global finals.',
        'Led the AI Technologies section, covering Machine Learning & Deep Learning.',
      ],
    },
  ],

  skills: [
    {
      name: 'Programming',
      skills: ['Python (Advanced)', 'SQL', 'C++', 'JavaScript', 'HTML/CSS'],
    },
    {
      name: 'Machine Learning & AI',
      skills: [
        'Scikit-learn', 'TensorFlow/Keras', 'Classical ML', 'Deep Learning',
        'NLP', 'Computer Vision', 'Feature Engineering', 'Model Evaluation', 'HPO',
      ],
    },
    {
      name: 'LLMs & Generative AI',
      skills: [
        'LangChain', 'RAG', 'Prompt Engineering', 'Hugging Face',
        'Ollama', 'FAISS', 'Vector Databases',
      ],
    },
    {
      name: 'Data Analysis & Visualization',
      skills: ['Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Power BI', 'EDA'],
    },
    {
      name: 'Data Engineering & MLOps',
      skills: ['Apache Airflow', 'Apache NiFi', 'dbt', 'ETL Pipelines', 'MLflow', 'HDFS'],
    },
    {
      name: 'Databases',
      skills: ['PostgreSQL', 'MySQL', 'Star Schema Design', 'Data Warehousing'],
    },
    {
      name: 'Cloud & Tools',
      skills: ['Azure AI Fundamentals', 'Huawei Cloud', 'Git/GitHub', 'Docker', 'Linux'],
    },
  ],
};
