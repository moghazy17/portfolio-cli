import type { TourStep } from '../types';

export function tourSteps(): TourStep[] {
  return [
    { line: 'about', title: 'About', caption: 'Get a quick summary of his work and background.' },
    { line: 'skills', title: 'Skills', caption: 'These bars count public GitHub repos using each skill and refresh nightly.' },
    { line: 'What RAG work has he done?', title: 'Ask anything', caption: 'Ask a plain question; the AI assistant answers from his repos and cites sources.' },
    { line: 'theme crt', title: 'Themes', caption: 'Run theme to restyle the terminal; this step switches to CRT.', motion: true },
    { line: 'who', title: "Who's here", caption: 'See how many visitors are here now; sign the guestbook with sign.' },
  ];
}
