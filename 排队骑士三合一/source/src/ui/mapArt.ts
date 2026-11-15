/** Decorative cartography only; route geometry and all input live in prep.ts. */
export function mapArt(): HTMLElement {
  const art = document.createElement('div');
  art.className = 'map-illustration';
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" preserveAspectRatio="none" focusable="false">
    <defs>
      <g id="map-pine" fill="#76805b" fill-opacity=".24" stroke="#6e7250" stroke-width="1.5" stroke-linejoin="miter">
        <path d="M0 0-8 13H-5L-12 23H-7L-16 35H16L7 23H12L5 13H8Z"/>
        <path d="M0 17V41" fill="none"/>
      </g>
      <g id="map-crag" stroke="#8a704a" stroke-width="1.5" stroke-linejoin="miter">
        <path d="m-37 40 12-15 6 2L0-8 9 9l5-3 23 34" fill="#b2986b" fill-opacity=".14"/>
        <path d="M0-8-2 10l-8 10 7-2-5 15m8-41 9 17-7 1 11 19m-32-2 9 5m25-10 7 10" fill="none"/>
      </g>
    </defs>
    <!-- Long, unlabelled contours leave the route itself as the dominant mark. -->
    <g fill="none" stroke="#a68c60" stroke-width="1.2" opacity=".3">
      <path d="m0 78 47-8 45 7 48-13 53 10 48-4 48 14 39-4 54 12 48-3"/>
      <path d="m0 87 47-7 46 7 48-13 51 11 49-5 48 13 39-3 53 12"/>
      <path d="m747 42 53 12 44-4 32 13 41-3 48 12 50-6 57 14 65-4 63 14"/>
      <path d="m773 29 28 13 44-4 32 13 40-3 49 12 49-6 57 14 65-4 63 14"/>
      <path d="m0 343 48-10 55 4 46-13 45 5 42-12 40 7 44-14 58 5"/>
      <path d="m0 354 49-10 54 4 46-13 45 6 43-13 38 6 46-13 58 6"/>
      <path d="m699 370 43-12 47 7 42-15 56 3 47-13 41 4 46-14 55 6 47-13 77 11"/>
      <path d="m713 381 30-11 47 8 42-16 55 3 47-13 42 4 45-14 55 6 48-12 76 11"/>
    </g>
    <!-- A faded river with two banks, broken by a small stone crossing. -->
    <path d="m551-8 5 36-18 28 5 37-24 34 5 28-17 33 8 32-19 33 6 39-19 35 9 38-21 40h21l19-39-8-37 19-35-5-39 18-35-7-30 16-34-5-29 24-33-5-38 18-29-4-41Z" fill="#7a8d82" opacity=".13"/>
    <g fill="none" stroke="#7b8877" stroke-width="1.5" opacity=".29">
      <path d="m551-8 5 36-18 28 5 37-24 34 5 28-17 33 8 32-19 33 6 39-19 35 9 38-21 40"/>
      <path d="m573-8 4 41-18 29 5 38-24 33 5 29-16 34 7 30-18 35 5 39-19 35 8 37-19 39"/>
      <path d="m546 32-9 17m15 62-11 17m-24 155-8 17m-8 76-8 17"/>
    </g>
    <g opacity=".44">
      <use href="#map-crag" transform="translate(126 20) scale(1.06)"/>
      <use href="#map-crag" transform="translate(183 5) scale(1.35)"/>
      <use href="#map-crag" transform="translate(232 34) scale(.85)"/>
      <use href="#map-crag" transform="translate(284 17) scale(1.12)"/>
      <use href="#map-crag" transform="translate(334 43) scale(.7)"/>
      <use href="#map-crag" transform="translate(809 351) scale(.84)"/>
      <use href="#map-crag" transform="translate(862 329) scale(1.32)"/>
      <use href="#map-crag" transform="translate(925 352) scale(1.02)"/>
      <use href="#map-crag" transform="translate(974 366) scale(.72)"/>
    </g>
    <g opacity=".53">
      <use href="#map-pine" transform="translate(47 277) scale(.7)"/>
      <use href="#map-pine" transform="translate(72 288) scale(.9)"/>
      <use href="#map-pine" transform="translate(98 271) scale(.85)"/>
      <use href="#map-pine" transform="translate(122 291) scale(.75)"/>
      <use href="#map-pine" transform="translate(58 310) scale(.85)"/>
      <use href="#map-pine" transform="translate(88 309)"/>
      <use href="#map-pine" transform="translate(115 320) scale(.8)"/>
      <use href="#map-pine" transform="translate(144 310) scale(.7)"/>
      <use href="#map-pine" transform="translate(906 9) scale(.75)"/>
      <use href="#map-pine" transform="translate(933 18) scale(.9)"/>
      <use href="#map-pine" transform="translate(958 4) scale(.9)"/>
      <use href="#map-pine" transform="translate(984 23) scale(.8)"/>
      <use href="#map-pine" transform="translate(1010 12) scale(.7)"/>
      <use href="#map-pine" transform="translate(925 46) scale(.75)"/>
      <use href="#map-pine" transform="translate(955 43) scale(.85)"/>
      <use href="#map-pine" transform="translate(986 52) scale(.7)"/>
    </g>
    <g transform="translate(1117 344)" stroke="#8d724a" stroke-width="1.5" opacity=".44">
      <circle r="36" fill="none"/>
      <circle r="29" fill="none" stroke-dasharray="1 6"/>
      <path d="M0-46V46M-46 0H46m-26-20 40 40m0-40-40 40" fill="none"/>
      <path d="m0-40 8 32L0 0-8 8Zm0 80L-8 8 0 0l8-8Z" fill="#9c623e" fill-opacity=".46"/>
      <path d="m-40 0 32-8L0 0l8 8Zm80 0L8 8 0 0l-8-8Z" fill="#bba271" fill-opacity=".48"/>
      <path d="m-4-53 4-7 4 7M0-60v12" fill="none"/>
    </g>
    <g fill="none" stroke="#8d724a" stroke-width="1.5" opacity=".35">
      <path d="M36 29V14H78M36 391v15h42M1164 29V14h-42M1164 391v15h-42"/>
      <path d="M12 192v36m-4-28h8m-8 20h8M1188 192v36m-4-28h8m-8 20h8"/>
    </g>
  </svg>`;
  return art;
}
