/** A quiet little booth companion; purely decorative. */
export default function Cat() {
  return (
    <div aria-hidden="true" className="cat-space pointer-events-none flex min-w-0 justify-center">
      <svg className="booth-cat h-auto w-full" width="180" height="150" viewBox="0 0 180 150" focusable="false">
        <ellipse cx="91" cy="139" rx="53" ry="6" fill="#173210" opacity=".12" />
        <g className="cat-sway">
          <path className="cat-tail" d="M113 128C151 142 163 107 143 100" fill="none" stroke="#191e1b" strokeWidth="13" strokeLinecap="round" />
          <path d="M64 87Q50 103 55 133Q82 144 119 133Q126 103 105 84Z" fill="#191e1b" />
          <ellipse cx="65" cy="133" rx="16" ry="7" fill="#111713" />
          <ellipse cx="106" cy="133" rx="16" ry="7" fill="#111713" />
          <path d="M93 101Q84 118 91 131" fill="none" stroke="#303a32" strokeWidth="3" strokeLinecap="round" />
          <g className="cat-paw">
            <path d="M63 119Q47 108 57 91" fill="none" stroke="#252c27" strokeWidth="15" strokeLinecap="round" />
            <ellipse cx="58" cy="90" rx="9" ry="10" fill="#303a32" />
          </g>
          <g className="cat-head">
            <path d="M52 60L49 25Q51 20 72 40Q87 35 101 40Q123 18 125 26L121 66Q125 96 89 99Q49 97 52 60Z" fill="#191e1b" />
            <path d="M56 34L60 53L69 45Z M117 34L104 46L117 53Z" fill="#49554b" />
            <g className="cat-eyes">
              <ellipse cx="72" cy="69" rx="10" ry="8" fill="#a8e778" />
              <ellipse cx="105" cy="69" rx="10" ry="8" fill="#a8e778" />
              <ellipse cx="73" cy="69" rx="3" ry="7" fill="#111713" />
              <ellipse cx="104" cy="69" rx="3" ry="7" fill="#111713" />
              <circle cx="75" cy="66" r="2" fill="#fff" />
              <circle cx="106" cy="66" r="2" fill="#fff" />
            </g>
            <path d="M84 80Q89 77 94 80L89 84Z" fill="#879783" />
            <path className="cat-tongue" d="M87 87Q86 102 81 96L82 87Z" fill="#e6a0a1" />
            <path d="M89 84Q88 91 82 87M89 84Q90 91 96 87" fill="none" stroke="#70806f" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M62 81L40 77M62 86L42 89M114 81L136 77M114 86L134 89" fill="none" stroke="#49554b" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}
