/** Command groups shared by `help` and the web terminal's All-commands sheet. Unlisted menu commands go under Explore. */
export const MENU_GROUPS: ReadonlyArray<{ heading: string; names: ReadonlySet<string> }> = [
  { heading: 'About me', names: new Set(['about', 'resume', 'education', 'certifications', 'contact']) },
  { heading: 'Work', names: new Set(['experience', 'projects', 'skills', 'timeline', 'github']) },
  { heading: 'Explore', names: new Set<string>() },
];
