import { useEffect, useState } from "react";

/** Click or use Enter/Space to play; repeated clicks restart the little routine. */
export default function Cat() {
  const [play, setPlay] = useState(0);
  useEffect(() => {
    if (!play) return;
    const timer = setTimeout(() => setPlay(0), 8800);
    return () => clearTimeout(timer);
  }, [play]);
  return (
    <button type="button" aria-label="Play with the cat" onClick={() => setPlay((value) => value + 1)} className="cat-space flex min-h-11 min-w-0 justify-center">
      <svg key={play} aria-hidden="true" className={`booth-cat h-auto w-full${play ? " cat-playing" : ""}`} width="180" height="150" viewBox="0 0 180 150" focusable="false">
        <ellipse className="cat-shadow" cx="91" cy="139" rx="53" ry="6" fill="#173210" opacity=".12" />
        <g className="cat-jump">
        {play > 0 && (
          <g className="cat-whoosh" fill="none" strokeLinecap="round">
            <path d="M129 60A51 51 0 0 0 47 119" stroke="#fff0cf" strokeWidth="9" opacity=".3" />
            <path d="M129 60A51 51 0 0 0 47 119" stroke="#fff0cf" strokeWidth="3" />
            <path d="M53 129A46 46 0 0 0 133 77" stroke="#ffe9a8" strokeWidth="2.5" />
            <path d="M113 52A43 43 0 0 0 48 90" stroke="#ffffff" strokeWidth="1.5" opacity=".8" />
          </g>
        )}
        <g className="cat-acrobat">
        <g className="cat-sway">
          <g className="cat-flip-tail">
          <path className="cat-tail" d="M113 128C151 142 163 107 143 100" fill="none" stroke="#191e1b" strokeWidth="13" strokeLinecap="round" />
          </g>
          <g className="cat-flip-body">
          <path d="M64 87Q50 103 55 133Q82 144 119 133Q126 103 105 84Z" fill="#191e1b" />
          </g>
          <g className="cat-flip-feet">
          <ellipse cx="65" cy="133" rx="16" ry="7" fill="#111713" />
          <ellipse cx="106" cy="133" rx="16" ry="7" fill="#111713" />
          </g>
          <path d="M93 101Q84 118 91 131" fill="none" stroke="#303a32" strokeWidth="3" strokeLinecap="round" />
          <g className="cat-flip-arm">
          <g className="cat-paw">
            <path d="M63 119Q47 108 57 91" fill="none" stroke="#252c27" strokeWidth="15" strokeLinecap="round" />
            <ellipse cx="58" cy="90" rx="9" ry="10" fill="#303a32" />
          </g>
          </g>
          <g className="cat-flip-far-arm">
            <path d="M108 112Q127 105 118 86" fill="none" stroke="#303a32" strokeWidth="13" strokeLinecap="round" />
            <ellipse cx="118" cy="85" rx="8" ry="9" fill="#3a463d" />
          </g>
          <g className="cat-flip-head">
          <g className="cat-head">
            <path d="M52 60L49 25Q51 20 72 40Q87 35 101 40Q123 18 125 26L121 66Q125 96 89 99Q49 97 52 60Z" fill="#191e1b" />
            <path d="M56 34L60 53L69 45Z M117 34L104 46L117 53Z" fill="#49554b" />
            <g className="cat-eyes">
              <ellipse cx="72" cy="69" rx="10" ry="8" fill="#a8e778" />
              <ellipse cx="73" cy="69" rx="3" ry="7" fill="#111713" />
              <circle cx="75" cy="66" r="2" fill="#fff" />
              <g className="cat-wink">
                <ellipse cx="105" cy="69" rx="10" ry="8" fill="#a8e778" />
                <ellipse cx="104" cy="69" rx="3" ry="7" fill="#111713" />
                <circle cx="106" cy="66" r="2" fill="#fff" />
              </g>
              <path className="cat-wink-lid" d="M97 70Q105 63 113 70" fill="none" stroke="#a8e778" strokeWidth="3" strokeLinecap="round" />
            </g>
            <path d="M84 80Q89 77 94 80L89 84Z" fill="#879783" />
            <path className="cat-tongue" d="M87 87Q86 102 81 96L82 87Z" fill="#e6a0a1" />
            <path d="M89 84Q88 91 82 87M89 84Q90 91 96 87" fill="none" stroke="#70806f" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M62 81L40 77M62 86L42 89M114 81L136 77M114 86L134 89" fill="none" stroke="#49554b" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          </g>
        </g>
        </g>
        </g>
        {play > 0 && (
          <g className="cat-play-toys">
            <g className="cat-reclining">
              <path className="cat-play-tail" d="M131 125Q159 143 163 121Q164 108 152 110" fill="none" stroke="#191e1b" strokeWidth="12" strokeLinecap="round" />
              <g className="cat-play-body">
                <path d="M53 120C52 101 76 95 97 99C117 98 143 107 141 124C139 142 115 141 93 139C72 144 51 138 53 120Z" fill="#191e1b" />
                <ellipse cx="100" cy="119" rx="27" ry="15" fill="#252c27" />
                <ellipse className="cat-back-foot" cx="130" cy="128" rx="14" ry="9" fill="#303a32" />
                <g className="cat-toss-paw cat-toss-paw-far">
                  <path d="M113 120C126 115 129 98 116 87" fill="none" stroke="#252c27" strokeWidth="14" strokeLinecap="round" />
                  <ellipse cx="116" cy="86" rx="9" ry="8" fill="#303a32" />
                </g>
                <g className="cat-toss-paw cat-toss-paw-near">
                  <path d="M82 121C77 110 83 96 93 88" fill="none" stroke="#303a32" strokeWidth="15" strokeLinecap="round" />
                  <ellipse cx="94" cy="87" rx="9" ry="8" fill="#3a463d" />
                  <path d="M90 84v3m5-5v3" stroke="#70806f" strokeWidth="1.5" strokeLinecap="round" />
                </g>
              </g>
              <g className="cat-play-head">
                <path d="M24 106L21 79Q23 73 40 89Q53 85 64 92Q81 78 82 85L77 111Q78 135 50 136Q22 133 24 106Z" fill="#191e1b" />
                <path d="M27 84L29 98L37 92Z M76 89L66 98L75 103Z" fill="#49554b" />
                <ellipse cx="39" cy="110" rx="8" ry="7" fill="#a8e778" />
                <g className="cat-play-wink">
                  </g>
          <g className="cat-flip-feet">
          <ellipse cx="65" cy="111" rx="8" ry="7" fill="#a8e778" />
                  <ellipse cx="67" cy="108" rx="2.5" ry="5.5" fill="#111713" />
                  <circle cx="68" cy="106" r="1.5" fill="#fff" />
                </g>
                <g className="cat-play-pupil">
                  <ellipse cx="41" cy="107" rx="2.5" ry="5.5" fill="#111713" />
                  <circle cx="42" cy="105" r="1.5" fill="#fff" />
                </g>
                <path d="M48 119q4-3 8 0l-4 4Z" fill="#879783" />
                <path d="M52 123q-4 5-8 0m8 0q4 5 8 0M32 120l-15-3m16 8-15 3m52-6 15-3m-16 8 14 3" fill="none" stroke="#70806f" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            </g>
            <g className="cat-yarn">
              <g className="cat-yarn-ball">
                <path d="M100 84q13 6 18-2" fill="none" stroke="#9a2a14" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="100" cy="77" r="11" fill="#e6a0a1" stroke="#9a2a14" strokeWidth="1.5" />
                <path d="M90 73q10-5 20 2M90 79q10-5 20 2M94 68q-2 11 9 19M100 66q-2 10 10 15" fill="none" stroke="#9a2a14" strokeWidth="1" />
              </g>
            </g>
          </g>
        )}
      </svg>
    </button>
  );
}
