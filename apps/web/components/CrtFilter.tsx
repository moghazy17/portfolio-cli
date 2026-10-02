export default function CrtFilter() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <radialGradient id="crt-gradient"><stop offset="65%" stopColor="#808080" /><stop offset="100%" stopColor="#a0a0a0" /></radialGradient>
        <svg id="crt-map" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect width="100" height="100" fill="url(#crt-gradient)" />
        </svg>
        <filter id="crt-barrel" x="0" y="0" width="100%" height="100%">
          <feImage href="#crt-map" result="map" preserveAspectRatio="none" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
