import { cvData } from '@ahmed-moghazy/shared';
import Terminal from '../components/Terminal';

export default function Home() {
  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hidden semantic HTML for SEO — crawlers see real content */}
      <article className="sr-only">
        <h1>{cvData.name} — Data Science & ML Engineer</h1>
        <p>{cvData.professionalSummary}</p>

        <h2>Education</h2>
        <p>
          {cvData.education.degree}, {cvData.education.institution} (
          {cvData.education.startDate} — {cvData.education.endDate}), GPA:{' '}
          {cvData.education.gpa}
        </p>

        <h2>Experience</h2>
        {cvData.experience.map((exp) => (
          <section key={exp.shortName}>
            <h3>
              {exp.company} — {exp.role}
            </h3>
            <p>
              {exp.startDate} — {exp.endDate}
            </p>
            <ul>
              {exp.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        <h2>Projects</h2>
        {cvData.projects.map((proj) => (
          <section key={proj.shortName}>
            <h3>
              {proj.name} ({proj.techStack})
            </h3>
            <ul>
              {proj.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        <h2>Skills</h2>
        {cvData.skills.map((cat) => (
          <section key={cat.name}>
            <h3>{cat.name}</h3>
            <p>{cat.skills.join(', ')}</p>
          </section>
        ))}

        <h2>Contact</h2>
        <p>Email: {cvData.contact.email}</p>
        <p>
          LinkedIn:{' '}
          <a href={cvData.contact.linkedin}>{cvData.contact.linkedin}</a>
        </p>
        <p>
          GitHub:{' '}
          <a href={cvData.contact.github}>{cvData.contact.github}</a>
        </p>
      </article>

      {/* The actual visible terminal UI */}
      <Terminal />
    </main>
  );
}
