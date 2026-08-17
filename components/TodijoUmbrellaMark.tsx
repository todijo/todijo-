type Props = { className?: string; animated?: boolean };

export default function TodijoUmbrellaMark({ className = "", animated = false }: Props) {
  return <svg className={`${className}${animated ? " isAnimated" : ""}`} viewBox="0 0 240 240" role="img" aria-label="Todijo">
    <defs>
      <linearGradient id="todijo-canopy" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#e8ddff"/></linearGradient>
      <linearGradient id="todijo-to" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#123a78"/><stop offset="1" stopColor="#19c9e6"/></linearGradient>
      <linearGradient id="todijo-di" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#14cce2"/><stop offset="1" stopColor="#e536b5"/></linearGradient>
      <linearGradient id="todijo-jo" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6d28d9"/><stop offset="1" stopColor="#ff8a28"/></linearGradient>
      <filter id="todijo-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#17073f" floodOpacity=".28"/></filter>
    </defs>
    <g className="umbrellaCanopy" filter="url(#todijo-shadow)">
      <path className="umbrellaPanel umbrellaPanelLeft" d="M120 42C78 43 46 66 31 103c30-13 57-7 89 11V42Z" fill="url(#todijo-canopy)"/>
      <path className="umbrellaPanel umbrellaPanelCenter" d="M120 42c-18 10-28 35-30 66 11-2 21 0 30 6 9-6 19-8 30-6-2-31-12-56-30-66Z" fill="#fff"/>
      <path className="umbrellaPanel umbrellaPanelRight" d="M120 42c42 1 74 24 89 61-30-13-57-7-89 11V42Z" fill="url(#todijo-canopy)"/>
      <circle cx="120" cy="39" r="7" fill="#20c8df" stroke="#fff" strokeWidth="2"/>
      <text x="53" y="91" fill="url(#todijo-to)" className="umbrellaWord umbrellaWordTo">To</text>
      <text x="101" y="91" fill="url(#todijo-di)" className="umbrellaWord umbrellaWordDi">Di</text>
      <text x="153" y="91" fill="url(#todijo-jo)" className="umbrellaWord umbrellaWordJo">Jo</text>
    </g>
    <path className="umbrellaShaft" d="M120 111v82h28" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" filter="url(#todijo-shadow)"/>
  </svg>;
}
