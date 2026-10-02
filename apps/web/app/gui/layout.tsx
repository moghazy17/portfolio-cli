import MotionProvider from '../../components/gui/MotionProvider';
import './gui.css';

export default function GuiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gui-root">
      <noscript>
        <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <a href="#main" className="gui-skip">Skip to content</a>
      <MotionProvider>{children}</MotionProvider>
    </div>
  );
}
