import { LETTERBOXD_URL, LETTERBOXD_USERNAME, stars } from '@ahmed-moghazy/shared';
import type { FilmEntry } from '@ahmed-moghazy/shared';

// Poster stand-ins: a stable colour per title, from a small set picked to sit with the window chrome.
const swatches = ['#23406e', '#b35a74', '#2f6b55', '#7a6bb3', '#a8742d', '#4f7f9c'];
function swatch(title: string): string {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return swatches[hash % swatches.length];
}

export default function FilmsList({ films }: { films: FilmEntry[] }) {
  return (
    <div className="be-tracker">
      {films.length ? (
        <>
          <div className="be-tracker-head be-films-head" aria-hidden="true"><span>Title</span><span>Year</span><span>Rating</span></div>
          <ul className="be-tracker-rows" aria-label="Recently watched">
            {films.slice(0, 5).map((film) => (
              <li key={`${film.title}-${film.watched}`}>
                <div className="be-row be-film">
                  <span className="be-row-name">
                    <span className="be-poster" style={{ background: swatch(film.title) }} aria-hidden="true" />
                    {film.title}
                  </span>
                  <span className="be-num">{film.year ?? ''}</span>
                  <span className="be-stars">
                    {film.rating ? <span aria-label={`${film.rating} out of 5 stars`}>{stars(film.rating)}</span> : null}
                    {film.liked && <span className="be-heart" aria-label="liked">♥</span>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="be-muted be-pad">The projector is warming up.</p>}
      <p className="be-tracker-foot">
        <a href={LETTERBOXD_URL} target="_blank" rel="noopener noreferrer">Full diary on Letterboxd: {LETTERBOXD_USERNAME} ↗</a>
      </p>
    </div>
  );
}
