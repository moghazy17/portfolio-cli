// Inline SVG icons (Lucide-style strokes), decorative unless the caller adds a label.

interface IconProps {
  className?: string;
}

function Icon({ className = 'h-5 w-5', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const MailIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Icon>
);

export const PhoneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </Icon>
);

export const MapPinIcon = (props: IconProps) => (
  <Icon {...props}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Icon>
);

export const GithubIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.4-.4-2.7-1.3-3.7.4-1.1.4-2.4 0-3.5 0 0-1.1-.3-3.5 1.3a12 12 0 0 0-6.4 0C6.4 1.9 5.3 2.2 5.3 2.2a4.4 4.4 0 0 0 0 3.5A5.4 5.4 0 0 0 4 9.5c0 3.5 3 5.5 6 5.5-.4.5-.8 1.3-.9 2.2V22" />
    <path d="M9 18c-4.5 2-5-2-7-2" />
  </Icon>
);

export const LinkedinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
    <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></Icon>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></Icon>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <Icon {...props}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Icon>
);

export const TerminalIcon = (props: IconProps) => (
  <Icon {...props}><path d="m4 17 6-6-6-6" /><path d="M12 19h8" /></Icon>
);

export const BriefcaseIcon = (props: IconProps) => (
  <Icon {...props}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></Icon>
);

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></Icon>
);

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></Icon>
);

export const GraduationIcon = (props: IconProps) => (
  <Icon {...props}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></Icon>
);
