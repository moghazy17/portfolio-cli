import { Archivo } from 'next/font/google';
import './gui.css';

const archivo = Archivo({ subsets: ['latin'], variable: '--font-be', weight: ['400', '500', '600', '700'] });

export default function GuiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`gui-root ${archivo.variable}`}>
      <a href="#main" className="gui-skip">Skip to content</a>
      {children}
    </div>
  );
}
