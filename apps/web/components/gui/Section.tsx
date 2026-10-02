interface Props {
  id: string;
  title: string;
  children: React.ReactNode;
  width?: 'wide' | 'narrow';
}

export default function Section({ id, title, children, width = 'wide' }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="py-14 sm:py-20">
      <div className={`mx-auto px-5 sm:px-6 ${width === 'wide' ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <h2 id={`${id}-title`} className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
