import { describe, expect, it } from 'vitest';
import type { CommandOutput } from '../src/types';
import { aboutCommand, projectsCommand } from '../src/commands/cv';
import { timelineCommand } from '../src/commands/utility';
import { renderAnsi } from '../src/render/ansi';
import { toLines } from '../src/shell/lines';
import { defaultTheme } from '../src/theme';

describe('ANSI renderer', () => {
  function plain(output: CommandOutput[]): string {
    const expected = toLines(output).map((line) => line.text).join('\n') + '\n';
    expect(renderAnsi(output, { color: false })).toBe(expected);
    return expected;
  }

  it('renders about as plain text', () => {
    expect(plain(aboutCommand().output)).toMatchInlineSnapshot(`
      "About Ahmed Moghazy
      Computer Science graduate specializing in machine learning, applied AI, and data-driven systems. Experienced in designing and deploying end-to-end ML solutions including AutoML pipelines, predictive modeling, and retrieval-augmented generation (RAG) applications using large language models. Strong background in data analysis, feature engineering, and model evaluation, with hands-on exposure to data engineering workflows, MLOps practices, and translating complex data into actionable business insights.
      "
    `);
  });

  it('renders projects as plain text', () => {
    expect(plain(projectsCommand([]).output)).toMatchInlineSnapshot(`
      "Technical Projects
      AI-Powered Tech News Aggregator (n8n, LLMs)
      Jan 2026 — Jan 2026
      ▸ Built an automated news aggregation pipeline using n8n to ingest RSS feeds from multiple tech sources on a scheduled basis.
      ▸ Implemented an LLM-based classification and ranking system to categorize articles, generate why-it-matters insights, and score news importance.
      ▸ Designed daily and weekly workflows to store structured results in Google Sheets and deliver curated HTML email summaries of top-ranked articles.
      [Graduation] AutoML Pipeline (scikit-learn)
      Oct 2024 — June 2025
      ▸ Engineered a modular AutoML pipeline in Python (scikit-learn) with 4 stages: preprocessing, feature selection, model selection, and hyperparameter optimization.
      ▸ Synthesized AutoML foundations (model selection, HPO, evaluation) into the system architecture and experiment plan.
      ▸ Implemented and benchmarked Grid Search, Random Search, and Bayesian Optimization for HPO on tabular ML tasks.
      RAG Chatbot (LangChain + FAISS + Ollama)
      Dec 2024 — Jan 2025
      ▸ Built a retrieval-augmented chatbot with LangChain + Ollama Gemma-3 (12B) and a Gradio UI for real-time Q&A.
      ▸ Crawled up to 30 LangChain doc pages (BeautifulSoup); chunked via RecursiveCharacterTextSplitter.
      ▸ Embedded with all-MiniLM-L6-v2 and indexed in FAISS; boosted relevance using MultiQueryRetriever + ContextualCompressionRetriever; added SerpAPI + Python REPL tools.
      ExpenSum — Smart Expense Tracker (React + Spring Boot + JWT + LLM)
      Apr 2025 — May 2025
      ▸ Developed a full-stack expense tracker: React frontend + Spring Boot backend secured with JWT.
      ▸ Integrated Mistral (via Ollama) to convert natural-language inputs into structured expense entries for single-step data capture.
      Star-Schema Data Warehouse (SQL, ETL)
      Dec 2023 — Jan 2024
      ▸ Designed a star schema (fact/dimension) for a recommendation dataset.
      ▸ Automated daily CSV loads via scheduled SQL jobs (ETL).
      "
    `);
  });

  it('renders timeline as plain text', () => {
    expect(plain(timelineCommand().output)).toMatchInlineSnapshot(`
      "Period                 Role / Degree                           Organization
      Oct 2025 – Present     Software Developer (AI & Backend)       Advanced Computer Technology (ACT)
      Oct 2021 – June 2025   Computer Science — Bachelor of Science  Cairo University
      Oct 2024 – Apr 2025    Machine Learning Engineer Trainee       Digital Egypt Pioneers Initiative (DEPI)
      Aug 2024 – Sep 2024    Data Engineer Intern                    Orange Egypt
      July 2024 – July 2024  Data Science Intern                     ValU
      Aug 2023 – Sep 2023    Data Science Intern                     Advanced Computer Technology (ACT)
      "
    `);
  });

  it('prefixes shown item ids and leaves empty output empty', () => {
    const output: CommandOutput[] = [{ type: 'lines', showItems: true, lines: [{ text: 'entry', item: 'slug' }] }];
    expect(renderAnsi(output, { color: false })).toBe('slug: entry\n');
    expect(renderAnsi([])).toBe('');
  });

  it('uses truecolor styles and OSC 8 hyperlinks', () => {
    const output: CommandOutput[] = [
      { type: 'text', content: 'styled', style: { color: 'primary', bold: true, dim: true, italic: true } },
      { type: 'text', content: 'plain' },
      { type: 'link', text: 'Site', url: 'https://example.test' },
    ];
    const rgb = defaultTheme.primary.slice(1).match(/../g)!.map((part) => parseInt(part, 16));
    expect(renderAnsi(output)).toContain(`\x1b[38;2;${rgb.join(';')}m\x1b[1m\x1b[2m\x1b[3mstyled\x1b[0m\n`);
    expect(renderAnsi(output)).toContain('\nplain\n');
    expect(renderAnsi(output)).toContain('\x1b]8;;https://example.test\x1b\\Site: https://example.test\x1b]8;;\x1b\\');
  });
});
