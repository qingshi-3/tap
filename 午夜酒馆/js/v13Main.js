// v12.0 Midnight Tavern Main Controller — Framework Locked-In Edition
// - Opening 3 Starter Tavern Decks (3+3+2 balanced, Deck #3 starts with 《暗影包厢》!)
// - Beat 1 (Outdoor Mirror-Lake): 4-Round Active-Boss Battle + Transparent Draw/Discard Pile Inspector + 「留手」Tag + Relic-Unlocked 《暗影包厢》!
// - Beat 2 (Indoor Midnight Tavern): 100% Pure Black-Market Shop + Showstopper Booster Pack Opening Ceremony
// - GPT v12 Fixes baked in: Hard >=3 playable cards invariant for Box & Frost Lock; Store leaves 4 in hand (no free 6th card draw); Full-hand recall swaps cleanly!
(function () {
  window.MT = window.MT || {};

  // ─── Bespoke Crisp Pixel-Art SVG Ornaments & Foil Pack Illustrations ───
  function pixelHeartSvg(filled) {
    if (filled) {
      return `<svg class="hud-heart-svg full" viewBox="0 0 13 12" shape-rendering="crispEdges" aria-hidden="true">
        <path d="M2 1h3v1h1v1h1V2h1V1h3v1h1v4h-1v1h-1v1H9v1H8v1H7v1H6v-1H5V9H4V8H3V7H2V6H1V2h1V1z" fill="#22060a"/>
        <path d="M2 2h3v1h1v1h1V3h1V2h3v4h-1v1H9v1H8v1H7v1H6V9H5V8H4V7H3V6H2V2z" fill="#d9263e"/>
        <path d="M3 2h2v1H3V2zm-1 1h2v2H2V3zm6-1h2v1H8V2z" fill="#ff7084"/>
        <rect x="3" y="3" width="1" height="1" fill="#ffd9df"/>
        <path d="M9 5h2v1h-1v1H9v1H8v1H7v1H6V9h1V8h1V7h1V5z" fill="#8f1022"/>
      </svg>`;
    }
    return `<svg class="hud-heart-svg empty" viewBox="0 0 13 12" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M2 1h3v1h1v1h1V2h1V1h3v1h1v4h-1v1h-1v1H9v1H8v1H7v1H6v-1H5V9H4V8H3V7H2V6H1V2h1V1z" fill="#180a07"/>
      <path d="M2 2h3v1h1v1h1V3h1V2h3v4h-1v1H9v1H8v1H7v1H6V9H5V8H4V7H3V6H2V2z" fill="#3a231b"/>
      <path d="M3 3h2v1h1v1h1V4h1V3h2v2H9v1H8v1H7v1H6V7H5V6H4V5H3V3z" fill="#21120d"/>
    </svg>`;
  }

  function packFoilArtSvg(packId) {
    if (packId === 'pack_relic') {
      // Royal Crimson & Burnished Gold: Sunburst Crown & Arcane Chalice Filigree
      return `<svg class="sachet-bg-art" viewBox="0 0 120 156" shape-rendering="crispEdges" aria-hidden="true">
        <g opacity="0.26" fill="#ffd966">
          <rect x="59" y="8" width="2" height="140"/>
          <rect x="10" y="64" width="100" height="2"/>
          <path d="M20 24l4-4 76 86-4 4z"/>
          <path d="M100 24l-4-4-76 86 4 4z"/>
        </g>
        <g fill="none" stroke="#f6c85e" stroke-width="1.5" opacity="0.52">
          <polygon points="60,12 108,36 108,120 60,144 12,120 12,36"/>
          <polygon points="60,20 100,40 100,116 60,136 20,116 20,40" opacity="0.55"/>
        </g>
        <g fill="#ffe38a" opacity="0.88">
          <rect x="52" y="14" width="16" height="3"/>
          <rect x="50" y="10" width="3" height="5"/>
          <rect x="58" y="8" width="4" height="7"/>
          <rect x="67" y="10" width="3" height="5"/>
          <rect x="59" y="138" width="2" height="6"/>
          <rect x="57" y="140" width="6" height="2"/>
        </g>
        <g fill="#ffda75" opacity="0.72">
          <rect x="16" y="20" width="6" height="2"/><rect x="16" y="20" width="2" height="6"/>
          <rect x="98" y="20" width="6" height="2"/><rect x="102" y="20" width="2" height="6"/>
          <rect x="16" y="132" width="6" height="2"/><rect x="16" y="128" width="2" height="6"/>
          <rect x="98" y="132" width="6" height="2"/><rect x="102" y="128" width="2" height="6"/>
        </g>
      </svg>`;
    }
    if (packId === 'pack_hero') {
      // Royal Cobalt Sapphire & Silver-Gold: Crossed Greatswords & Heraldic Banner Crest
      return `<svg class="sachet-bg-art" viewBox="0 0 120 156" shape-rendering="crispEdges" aria-hidden="true">
        <g opacity="0.28" fill="#8ce8ff">
          <path d="M22 18h8l68 112h-8z"/>
          <path d="M98 18h-8l-68 112h8z"/>
        </g>
        <g fill="none" stroke="#8ce8ff" stroke-width="1.5" opacity="0.48">
          <path d="M14 18h92v84L60 142 14 102V18z"/>
          <path d="M22 25h76v72L60 132 22 97V25z" opacity="0.5"/>
        </g>
        <g fill="#e6f7ff" opacity="0.82">
          <rect x="59" y="10" width="2" height="10"/><rect x="55" y="14" width="10" height="2"/>
          <rect x="16" y="114" width="4" height="4"/><rect x="100" y="114" width="4" height="4"/>
          <rect x="58" y="134" width="4" height="4"/>
        </g>
        <g fill="#f6d88b" opacity="0.72">
          <rect x="14" y="18" width="8" height="2"/><rect x="14" y="18" width="2" height="8"/>
          <rect x="98" y="18" width="8" height="2"/><rect x="104" y="18" width="2" height="8"/>
        </g>
      </svg>`;
    }
    // pack_alchemy: Emerald-Amethyst & Rose-Gold Transmutation Circle + Twin Moons
    return `<svg class="sachet-bg-art" viewBox="0 0 120 156" shape-rendering="crispEdges" aria-hidden="true">
      <g fill="none" stroke="#e4a6ff" stroke-width="1.5" opacity="0.46">
        <circle cx="60" cy="68" r="46"/>
        <circle cx="60" cy="68" r="36" stroke-dasharray="4 3"/>
        <polygon points="60,22 98,88 22,88"/>
        <polygon points="60,114 98,48 22,48" opacity="0.65"/>
      </g>
      <g fill="#ffd9a8" opacity="0.82">
        <rect x="58" y="11" width="4" height="4"/>
        <rect x="55" y="13" width="10" height="1"/>
        <rect x="18" y="18" width="5" height="2"/><rect x="18" y="18" width="2" height="5"/>
        <rect x="97" y="18" width="5" height="2"/><rect x="100" y="18" width="2" height="5"/>
        <rect x="18" y="132" width="5" height="2"/><rect x="18" y="129" width="2" height="5"/>
        <rect x="97" y="132" width="5" height="2"/><rect x="100" y="129" width="2" height="5"/>
      </g>
    </svg>`;
  }

  // ─── Unified 16-Bit Pixel-Art Full-Bleed Scenic Dioramas & Single Forged TCG Card Frames ───
  function pixelCardSceneSvg(sceneKey) {
    // 64 x 96 exact integer pixel grid (4x scale on 256x384 / 252x378 reveal cards)
    // Upper half (y=3..50) = full-bleed scenic pixel diorama; Lower half (y=50..92) = engraved dark tablet
    const scenes = {
      holy: `
        <rect x="3" y="3" width="58" height="47" fill="#2a1929"/>
        <rect x="3" y="3" width="58" height="16" fill="#462638"/>
        <rect x="3" y="19" width="58" height="14" fill="#6b3b3c"/>
        <rect x="3" y="33" width="58" height="8" fill="#9a6444"/>
        <!-- Stained Glass Rose Window & Cathedral Pillars -->
        <rect x="24" y="8" width="16" height="16" fill="#c78a46" opacity="0.45"/>
        <rect x="27" y="10" width="10" height="12" fill="#ffe188" opacity="0.52"/>
        <rect x="30" y="12" width="4" height="8" fill="#fff6cc" opacity="0.72"/>
        <rect x="10" y="6" width="5" height="35" fill="#1e1118" opacity="0.78"/>
        <rect x="11" y="6" width="1" height="35" fill="#9a6e4a" opacity="0.5"/>
        <rect x="49" y="6" width="5" height="35" fill="#1e1118" opacity="0.78"/>
        <rect x="50" y="6" width="1" height="35" fill="#9a6e4a" opacity="0.5"/>
        <!-- Sunbeams -->
        <rect x="20" y="20" width="6" height="20" fill="#ffe89c" opacity="0.14"/>
        <rect x="38" y="20" width="6" height="20" fill="#ffe89c" opacity="0.14"/>
        <!-- Limestone Sanctuary Floor -->
        <rect x="3" y="40" width="58" height="10" fill="#3a241b"/>
        <rect x="3" y="40" width="58" height="1" fill="#c79758" opacity="0.6"/>
        <rect x="12" y="43" width="10" height="1" fill="#613e2a"/>
        <rect x="42" y="43" width="10" height="1" fill="#613e2a"/>
        <rect x="24" y="46" width="16" height="1" fill="#613e2a"/>
        <rect x="3" y="50" width="58" height="43" fill="#1c110d"/>
        <rect x="5" y="52" width="54" height="39" fill="#251610"/>`,
      flame: `
        <rect x="3" y="3" width="58" height="47" fill="#1f0a0e"/>
        <rect x="3" y="3" width="58" height="15" fill="#3d1115"/>
        <rect x="3" y="18" width="58" height="14" fill="#6e1d18"/>
        <rect x="3" y="32" width="58" height="9" fill="#a83519"/>
        <!-- Jagged Basalt Crags -->
        <rect x="5" y="22" width="8" height="19" fill="#1c080a"/>
        <rect x="7" y="17" width="4" height="5" fill="#1c080a"/>
        <rect x="50" y="20" width="9" height="21" fill="#1c080a"/>
        <rect x="53" y="14" width="4" height="6" fill="#1c080a"/>
        <!-- Rising Cinder Sparks -->
        <rect x="18" y="12" width="1" height="1" fill="#ffcf66"/>
        <rect x="44" y="16" width="1" height="1" fill="#ff9442"/>
        <rect x="26" y="8" width="1" height="1" fill="#ffe699"/>
        <rect x="39" y="24" width="1" height="1" fill="#ffcf66"/>
        <!-- Cracked Volcanic Floor with Lava Vein -->
        <rect x="3" y="40" width="58" height="10" fill="#260e0d"/>
        <rect x="3" y="40" width="58" height="1" fill="#e86428" opacity="0.72"/>
        <rect x="14" y="44" width="8" height="1" fill="#ff9038" opacity="0.65"/>
        <rect x="40" y="45" width="9" height="1" fill="#ff9038" opacity="0.65"/>
        <rect x="3" y="50" width="58" height="43" fill="#190b0a"/>
        <rect x="5" y="52" width="54" height="39" fill="#23100e"/>`,
      frost: `
        <rect x="3" y="3" width="58" height="47" fill="#0d1b2e"/>
        <rect x="3" y="3" width="58" height="14" fill="#142d4a"/>
        <rect x="3" y="17" width="58" height="15" fill="#1d4a6e"/>
        <rect x="3" y="32" width="58" height="9" fill="#2e6f92"/>
        <!-- Aurora Ribbon & Glacial Spires -->
        <rect x="12" y="9" width="24" height="3" fill="#6bf0e8" opacity="0.28"/>
        <rect x="24" y="12" width="26" height="2" fill="#8cf6ff" opacity="0.24"/>
        <rect x="6" y="21" width="9" height="19" fill="#10253c"/>
        <rect x="9" y="15" width="4" height="6" fill="#163552"/>
        <rect x="49" y="19" width="10" height="21" fill="#10253c"/>
        <rect x="51" y="13" width="4" height="6" fill="#163552"/>
        <!-- Snowflakes -->
        <rect x="18" y="15" width="1" height="1" fill="#e8fbff"/>
        <rect x="42" y="11" width="1" height="1" fill="#e8fbff"/>
        <rect x="33" y="22" width="1" height="1" fill="#b8f2ff"/>
        <!-- Frozen Ice Lake Floor -->
        <rect x="3" y="40" width="58" height="10" fill="#152b40"/>
        <rect x="3" y="40" width="58" height="1" fill="#82e4ff" opacity="0.65"/>
        <rect x="16" y="44" width="12" height="1" fill="#4aa2c7" opacity="0.5"/>
        <rect x="38" y="46" width="10" height="1" fill="#4aa2c7" opacity="0.5"/>
        <rect x="3" y="50" width="58" height="43" fill="#0e1621"/>
        <rect x="5" y="52" width="54" height="39" fill="#142030"/>`,
      shadow: `
        <rect x="3" y="3" width="58" height="47" fill="#140b24"/>
        <rect x="3" y="3" width="58" height="15" fill="#23123b"/>
        <rect x="3" y="18" width="58" height="14" fill="#3a1c5c"/>
        <rect x="3" y="32" width="58" height="9" fill="#522675"/>
        <!-- Eclipsed Violet Moon -->
        <rect x="26" y="9" width="12" height="12" fill="#d994ff" opacity="0.45"/>
        <rect x="28" y="11" width="8" height="8" fill="#f3d4ff" opacity="0.55"/>
        <rect x="29" y="12" width="6" height="6" fill="#23123b"/>
        <!-- Gothic Spires -->
        <rect x="7" y="20" width="6" height="20" fill="#10081c"/>
        <rect x="9" y="13" width="2" height="7" fill="#10081c"/>
        <rect x="51" y="18" width="6" height="22" fill="#10081c"/>
        <rect x="53" y="11" width="2" height="7" fill="#10081c"/>
        <!-- Ritual Obsidian Floor -->
        <rect x="3" y="40" width="58" height="10" fill="#1b102b"/>
        <rect x="3" y="40" width="58" height="1" fill="#c77dff" opacity="0.62"/>
        <rect x="20" y="44" width="24" height="1" fill="#8244b8" opacity="0.5"/>
        <rect x="3" y="50" width="58" height="43" fill="#120a1c"/>
        <rect x="5" y="52" width="54" height="39" fill="#1a1026"/>`,
      beast: `
        <rect x="3" y="3" width="58" height="47" fill="#0d1e17"/>
        <rect x="3" y="3" width="58" height="14" fill="#153226"/>
        <rect x="3" y="17" width="58" height="15" fill="#214d38"/>
        <rect x="3" y="32" width="58" height="9" fill="#2d6647"/>
        <!-- Ancient Forest Trunks & Moonlit Canopy -->
        <rect x="6" y="7" width="7" height="33" fill="#0c1c14"/>
        <rect x="13" y="7" width="4" height="8" fill="#122b1e"/>
        <rect x="51" y="7" width="7" height="33" fill="#0c1c14"/>
        <rect x="47" y="7" width="4" height="9" fill="#122b1e"/>
        <!-- Fireflies -->
        <rect x="20" y="14" width="1" height="1" fill="#9effb8"/>
        <rect x="43" y="18" width="1" height="1" fill="#d4ff9c"/>
        <rect x="35" y="10" width="1" height="1" fill="#9effb8"/>
        <!-- Mossy Glade Floor -->
        <rect x="3" y="40" width="58" height="10" fill="#13291d"/>
        <rect x="3" y="40" width="58" height="1" fill="#63e09b" opacity="0.58"/>
        <rect x="14" y="44" width="9" height="1" fill="#3a7d56"/>
        <rect x="41" y="45" width="9" height="1" fill="#3a7d56"/>
        <rect x="3" y="50" width="58" height="43" fill="#0d1712"/>
        <rect x="5" y="52" width="54" height="39" fill="#13211a"/>`,
      sand: `
        <rect x="3" y="3" width="58" height="47" fill="#2b1812"/>
        <rect x="3" y="3" width="58" height="14" fill="#4f291c"/>
        <rect x="3" y="17" width="58" height="15" fill="#824626"/>
        <rect x="3" y="32" width="58" height="9" fill="#ba7338"/>
        <!-- Desert Sun & Obelisks -->
        <rect x="26" y="11" width="12" height="10" fill="#ffd978" opacity="0.48"/>
        <rect x="28" y="13" width="8" height="6" fill="#fff2b5" opacity="0.62"/>
        <rect x="8" y="23" width="6" height="17" fill="#381d12"/>
        <rect x="10" y="19" width="2" height="4" fill="#381d12"/>
        <rect x="50" y="21" width="6" height="19" fill="#381d12"/>
        <rect x="52" y="17" width="2" height="4" fill="#381d12"/>
        <!-- Sun-Baked Sandstone Floor -->
        <rect x="3" y="40" width="58" height="10" fill="#3d2415"/>
        <rect x="3" y="40" width="58" height="1" fill="#f0b95b" opacity="0.68"/>
        <rect x="14" y="44" width="12" height="1" fill="#8c5a2c"/>
        <rect x="39" y="46" width="11" height="1" fill="#8c5a2c"/>
        <rect x="3" y="50" width="58" height="43" fill="#1c110b"/>
        <rect x="5" y="52" width="54" height="39" fill="#26170f"/>`,
      relic_add: `
        <rect x="3" y="3" width="58" height="47" fill="#26160a"/>
        <rect x="3" y="3" width="58" height="18" fill="#3d2410"/>
        <rect x="12" y="10" width="40" height="30" fill="#5e3a18" opacity="0.5"/>
        <rect x="20" y="14" width="24" height="22" fill="#9c6928" opacity="0.45"/>
        <rect x="26" y="18" width="12" height="14" fill="#ffe188" opacity="0.28"/>
        <rect x="31" y="7" width="2" height="36" fill="#ffe188" opacity="0.16"/>
        <rect x="12" y="24" width="40" height="2" fill="#ffe188" opacity="0.14"/>
        <rect x="3" y="41" width="58" height="9" fill="#2e1b0d"/>
        <rect x="3" y="41" width="58" height="1" fill="#e8b854" opacity="0.65"/>
        <rect x="3" y="50" width="58" height="43" fill="#1a1008"/>
        <rect x="5" y="52" width="54" height="39" fill="#24160c"/>`,
      relic_vfx: `
        <rect x="3" y="3" width="58" height="47" fill="#0d1f29"/>
        <rect x="3" y="3" width="58" height="18" fill="#153545"/>
        <rect x="12" y="10" width="40" height="30" fill="#1d4d61" opacity="0.55"/>
        <rect x="20" y="14" width="24" height="22" fill="#2d7a94" opacity="0.45"/>
        <rect x="26" y="18" width="12" height="14" fill="#94f2ff" opacity="0.28"/>
        <rect x="31" y="7" width="2" height="36" fill="#82ebff" opacity="0.18"/>
        <rect x="12" y="24" width="40" height="2" fill="#82ebff" opacity="0.14"/>
        <rect x="3" y="41" width="58" height="9" fill="#112633"/>
        <rect x="3" y="41" width="58" height="1" fill="#70dcf2" opacity="0.65"/>
        <rect x="3" y="50" width="58" height="43" fill="#0c171f"/>
        <rect x="5" y="52" width="54" height="39" fill="#12222d"/>`,
      relic_mult: `
        <rect x="3" y="3" width="58" height="47" fill="#260c1a"/>
        <rect x="3" y="3" width="58" height="18" fill="#42142b"/>
        <rect x="12" y="10" width="40" height="30" fill="#631e40" opacity="0.52"/>
        <rect x="20" y="14" width="24" height="22" fill="#942d5e" opacity="0.42"/>
        <rect x="26" y="18" width="12" height="14" fill="#ff9cc8" opacity="0.28"/>
        <rect x="31" y="7" width="2" height="36" fill="#ff9cc8" opacity="0.18"/>
        <rect x="12" y="24" width="40" height="2" fill="#ff9cc8" opacity="0.14"/>
        <rect x="3" y="41" width="58" height="9" fill="#2b0f1e"/>
        <rect x="3" y="41" width="58" height="1" fill="#f082b4" opacity="0.65"/>
        <rect x="3" y="50" width="58" height="43" fill="#1a0912"/>
        <rect x="5" y="52" width="54" height="39" fill="#240d19"/>`,
      alchemy: `
        <rect x="3" y="3" width="58" height="47" fill="#1a0e29"/>
        <rect x="3" y="3" width="58" height="18" fill="#2d1747"/>
        <rect x="14" y="11" width="36" height="26" fill="#46226b" opacity="0.5"/>
        <rect x="22" y="15" width="20" height="18" fill="#7c3ea8" opacity="0.42"/>
        <rect x="16" y="14" width="1" height="1" fill="#ffe89c"/>
        <rect x="47" y="12" width="1" height="1" fill="#e6a8ff"/>
        <rect x="44" y="30" width="1" height="1" fill="#ffe89c"/>
        <rect x="19" y="32" width="1" height="1" fill="#e6a8ff"/>
        <rect x="3" y="41" width="58" height="9" fill="#201133"/>
        <rect x="3" y="41" width="58" height="1" fill="#d994ff" opacity="0.65"/>
        <rect x="3" y="50" width="58" height="43" fill="#140a1f"/>
        <rect x="5" y="52" width="54" height="39" fill="#1d0f2c"/>`
    };
    return `<svg class="pcard-scene-svg" viewBox="0 0 64 96" shape-rendering="crispEdges" aria-hidden="true">
      ${scenes[sceneKey] || scenes.relic_add}
    </svg>`;
  }

  function pixelCardFrameSvg(midCol = '#c99742', hiCol = '#ffe9a3', loCol = '#5c3b14', gemCol = '#ffd966') {
    // ONE single hand-sculpted 16-bit cast-metal TCG frame (64 x 96) — ZERO concentric inner boxes!
    return `<svg class="pcard-frame-svg" viewBox="0 0 64 96" shape-rendering="crispEdges" aria-hidden="true">
      <!-- Outer Forged Dark Silhouette Outline (Stepped Beveled Corners) -->
      <rect x="3" y="1" width="58" height="1" fill="#0d0604"/>
      <rect x="2" y="2" width="2" height="1" fill="#0d0604"/><rect x="60" y="2" width="2" height="1" fill="#0d0604"/>
      <rect x="1" y="3" width="1" height="90" fill="#0d0604"/><rect x="62" y="3" width="1" height="90" fill="#0d0604"/>
      <rect x="2" y="93" width="2" height="1" fill="#0d0604"/><rect x="60" y="93" width="2" height="1" fill="#0d0604"/>
      <rect x="3" y="94" width="58" height="1" fill="#0d0604"/>

      <!-- Main Forged Metallic Rim (2px thick, single cohesive border) -->
      <rect x="4" y="2" width="56" height="2" fill="${midCol}"/>
      <rect x="4" y="2" width="56" height="1" fill="${hiCol}"/>
      <rect x="2" y="4" width="2" height="88" fill="${midCol}"/>
      <rect x="2" y="4" width="1" height="86" fill="${hiCol}" opacity="0.72"/>
      <rect x="60" y="4" width="2" height="88" fill="${midCol}"/>
      <rect x="61" y="5" width="1" height="86" fill="${loCol}"/>
      <rect x="4" y="92" width="56" height="2" fill="${midCol}"/>
      <rect x="4" y="93" width="56" height="1" fill="${loCol}"/>

      <!-- Sculpted Cast-Corner Studs (Integrated directly into the rim corners!) -->
      <rect x="2" y="2" width="4" height="4" fill="${midCol}"/><rect x="3" y="3" width="2" height="2" fill="${hiCol}"/><rect x="4" y="4" width="1" height="1" fill="${loCol}"/>
      <rect x="58" y="2" width="4" height="4" fill="${midCol}"/><rect x="59" y="3" width="2" height="2" fill="${hiCol}"/><rect x="60" y="4" width="1" height="1" fill="${loCol}"/>
      <rect x="2" y="90" width="4" height="4" fill="${midCol}"/><rect x="3" y="91" width="2" height="2" fill="${hiCol}"/><rect x="4" y="92" width="1" height="1" fill="${loCol}"/>
      <rect x="58" y="90" width="4" height="4" fill="${midCol}"/><rect x="59" y="91" width="2" height="2" fill="${hiCol}"/><rect x="60" y="92" width="1" height="1" fill="${loCol}"/>

      <!-- Recessed Inner Dark Bevel Hairline (separates metal frame from art) -->
      <rect x="4" y="4" width="56" height="1" fill="#0d0604" opacity="0.8"/>
      <rect x="4" y="4" width="1" height="88" fill="#0d0604" opacity="0.7"/>
      <rect x="59" y="4" width="1" height="88" fill="#0d0604" opacity="0.7"/>
      <rect x="4" y="91" width="56" height="1" fill="#0d0604" opacity="0.8"/>

      <!-- Forged Top Crown Keystone + Faceted Pixel Gem Breaking the Top Silhouette -->
      <rect x="26" y="0" width="12" height="6" fill="#0d0604"/>
      <rect x="27" y="1" width="10" height="4" fill="${midCol}"/>
      <rect x="28" y="1" width="8" height="1" fill="${hiCol}"/>
      <rect x="29" y="2" width="6" height="3" fill="#1a0b08"/>
      <rect x="30" y="2" width="4" height="3" fill="${gemCol}"/>
      <rect x="30" y="2" width="2" height="1" fill="#ffffff" opacity="0.85"/>
      <rect x="25" y="2" width="2" height="2" fill="${hiCol}"/>
      <rect x="37" y="2" width="2" height="2" fill="${hiCol}"/>

      <!-- Side Hinge Brackets Anchoring the Horizontal Nameplate Horizon (y=47..55) -->
      <rect x="1" y="46" width="4" height="10" fill="#0d0604"/>
      <rect x="2" y="47" width="2" height="8" fill="${midCol}"/>
      <rect x="2" y="47" width="1" height="3" fill="${hiCol}"/>
      <rect x="59" y="46" width="4" height="10" fill="#0d0604"/>
      <rect x="60" y="47" width="2" height="8" fill="${midCol}"/>
      <rect x="60" y="47" width="1" height="3" fill="${hiCol}"/>
    </svg>`;
  }

  function pixelShopRelicSvg(cat, gemCol = '#ffd966') {
    // Unified 56 x 84 (exact 2:3 slender TCG ratio!) 16-bit Shop Relic Card: Full-bleed alcove + single forged frame
    const pal = cat === 'mult'
      ? { mid: '#d96b9f', hi: '#ffc4df', lo: '#5e1a3a', bg1: '#260b19', bg2: '#4a1530', bg3: '#75234c', tab: '#1c0913', ray: '#ff9ec8' }
      : cat === 'vfx'
      ? { mid: '#56bed6', hi: '#c2f6ff', lo: '#194959', bg1: '#0c1e29', bg2: '#16394a', bg3: '#245b73', tab: '#0c1821', ray: '#8ceeff' }
      : { mid: '#d4a146', hi: '#ffebb0', lo: '#5e3c10', bg1: '#24150a', bg2: '#422710', bg3: '#6b4218', tab: '#1a1008', ray: '#ffe188' };
    return `<svg class="rtc-pixel-svg" viewBox="0 0 56 84" shape-rendering="crispEdges" aria-hidden="true">
      <!-- Full-Bleed Upper Velvet Altar Alcove (y=3..41) -->
      <rect x="3" y="3" width="50" height="39" fill="${pal.bg1}"/>
      <rect x="6" y="5" width="44" height="35" fill="${pal.bg2}"/>
      <rect x="12" y="8" width="32" height="29" fill="${pal.bg3}" opacity="0.65"/>
      <rect x="19" y="12" width="18" height="21" fill="${pal.ray}" opacity="0.22"/>
      <!-- Subtle Pixel Starlight Rays -->
      <rect x="27" y="6" width="2" height="33" fill="${pal.ray}" opacity="0.16"/>
      <rect x="10" y="22" width="36" height="2" fill="${pal.ray}" opacity="0.14"/>
      <rect x="3" y="39" width="50" height="3" fill="${pal.bg1}" opacity="0.72"/>
      <!-- Engraved Lower Tablet (y=42..81) -->
      <rect x="3" y="42" width="50" height="39" fill="${pal.tab}"/>
      <rect x="5" y="44" width="46" height="35" fill="${pal.bg1}"/>

      <!-- Single Cohesive Forged Outer Rim (ZERO nested concentric boxes!) -->
      <rect x="3" y="1" width="50" height="1" fill="#0d0604"/>
      <rect x="2" y="2" width="2" height="1" fill="#0d0604"/><rect x="52" y="2" width="2" height="1" fill="#0d0604"/>
      <rect x="1" y="3" width="1" height="78" fill="#0d0604"/><rect x="54" y="3" width="1" height="78" fill="#0d0604"/>
      <rect x="2" y="81" width="2" height="1" fill="#0d0604"/><rect x="52" y="81" width="2" height="1" fill="#0d0604"/>
      <rect x="3" y="82" width="50" height="1" fill="#0d0604"/>

      <rect x="4" y="2" width="48" height="2" fill="${pal.mid}"/>
      <rect x="4" y="2" width="48" height="1" fill="${pal.hi}"/>
      <rect x="2" y="4" width="2" height="76" fill="${pal.mid}"/>
      <rect x="2" y="4" width="1" height="74" fill="${pal.hi}" opacity="0.72"/>
      <rect x="52" y="4" width="2" height="76" fill="${pal.mid}"/>
      <rect x="53" y="5" width="1" height="74" fill="${pal.lo}"/>
      <rect x="4" y="80" width="48" height="2" fill="${pal.mid}"/>
      <rect x="4" y="81" width="48" height="1" fill="${pal.lo}"/>

      <!-- Forged Corner Studs -->
      <rect x="2" y="2" width="4" height="4" fill="${pal.mid}"/><rect x="3" y="3" width="2" height="2" fill="${pal.hi}"/>
      <rect x="50" y="2" width="4" height="4" fill="${pal.mid}"/><rect x="51" y="3" width="2" height="2" fill="${pal.hi}"/>
      <rect x="2" y="78" width="4" height="4" fill="${pal.mid}"/><rect x="3" y="79" width="2" height="2" fill="${pal.hi}"/>
      <rect x="50" y="78" width="4" height="4" fill="${pal.mid}"/><rect x="51" y="79" width="2" height="2" fill="${pal.hi}"/>

      <!-- Top Crown Keystone + Faceted Gem -->
      <rect x="23" y="0" width="10" height="5" fill="#0d0604"/>
      <rect x="24" y="1" width="8" height="3" fill="${pal.mid}"/>
      <rect x="26" y="1" width="4" height="3" fill="${gemCol}"/>
      <rect x="26" y="1" width="2" height="1" fill="#ffffff" opacity="0.85"/>

      <!-- Side Brackets Anchoring the Nameplate Seam -->
      <rect x="1" y="39" width="3" height="8" fill="#0d0604"/><rect x="2" y="40" width="2" height="6" fill="${pal.mid}"/>
      <rect x="52" y="39" width="3" height="8" fill="#0d0604"/><rect x="52" y="40" width="2" height="6" fill="${pal.mid}"/>
    </svg>`;
  }

  function tarotBackSvg() {
    // Pure 16-Bit Pixel-Art Eclipse Card Back (64 x 96 matching exact front silhouette!)
    return `<svg class="tarot-back-svg" viewBox="0 0 64 96" shape-rendering="crispEdges" aria-hidden="true">
      <rect x="2" y="2" width="60" height="92" fill="#180a0b"/>
      <rect x="4" y="4" width="56" height="88" fill="#2c1215"/>
      <rect x="8" y="8" width="48" height="80" fill="#1c0b0d"/>
      <!-- Stepped Pixel Gold Rim -->
      <rect x="3" y="2" width="58" height="2" fill="#d4a146"/><rect x="3" y="2" width="58" height="1" fill="#ffe89c"/>
      <rect x="3" y="92" width="58" height="2" fill="#9c6c22"/>
      <rect x="2" y="3" width="2" height="90" fill="#d4a146"/><rect x="60" y="3" width="2" height="90" fill="#9c6c22"/>
      <!-- Pixel Sunburst & Eclipsed Crescent Emblem -->
      <rect x="31" y="16" width="2" height="64" fill="#d4a146" opacity="0.38"/>
      <rect x="14" y="47" width="36" height="2" fill="#d4a146" opacity="0.38"/>
      <rect x="24" y="36" width="16" height="24" fill="#3d171c"/>
      <rect x="22" y="40" width="20" height="16" fill="#3d171c"/>
      <rect x="25" y="39" width="14" height="18" fill="#e5b34c"/>
      <rect x="27" y="41" width="10" height="14" fill="#1a090c"/>
      <rect x="28" y="43" width="6" height="10" fill="#ffe48c"/>
      <rect x="31" y="44" width="5" height="8" fill="#1a090c"/>
      <rect x="30" y="12" width="4" height="4" fill="#ffe48c"/>
      <rect x="30" y="80" width="4" height="4" fill="#ffe48c"/>
    </svg>`;
  }

  // ─── 16-Bit Pixel-Art Hearthstone Sculpted Parchment Scrolls, Arches & Melted Wax Seals ───
  function hsScrollBackdropSvg(kind) {
    if (kind === 'bounty') {
      // 16-Bit Pixel-Art Tall Vertical Hanging Boss Bounty Scroll (78 x 90 => crisp 4px blocks, vertical scroll silhouette!)
      return `<svg class="hs-scroll-svg bounty" viewBox="0 0 78 90" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">
        <!-- Forged Iron Nail & Brass Hanging Loop -->
        <rect x="37" y="0" width="4" height="3" fill="#180a04"/>
        <rect x="38" y="1" width="2" height="1" fill="#fff0b0"/>
        <rect x="35" y="3" width="2" height="3" fill="#c89034"/>
        <rect x="41" y="3" width="2" height="3" fill="#c89034"/>
        <rect x="36" y="2" width="6" height="1" fill="#e5b34c"/>

        <!-- Stepped Pixel Hand-Torn Vertical Parchment Body -->
        <rect x="6" y="10" width="66" height="77" fill="#2e1508"/>
        <rect x="7" y="11" width="64" height="75" fill="#c69d5f"/>
        <rect x="8" y="12" width="62" height="73" fill="#ebd5a4"/>
        <rect x="9" y="13" width="60" height="4" fill="#f6e9c8"/>
        <!-- Subtle Edge Vignette Pixel Shading & Dither -->
        <rect x="8" y="12" width="1" height="73" fill="#d4b175"/>
        <rect x="69" y="12" width="1" height="73" fill="#d4b175"/>
        <rect x="8" y="83" width="62" height="2" fill="#cfa96b"/>
        <rect x="9" y="82" width="2" height="1" fill="#cfa96b"/>
        <rect x="13" y="82" width="2" height="1" fill="#cfa96b"/>
        <rect x="59" y="82" width="2" height="1" fill="#cfa96b"/>
        <rect x="65" y="82" width="2" height="1" fill="#cfa96b"/>
        <!-- Hand-Torn Pixel Notches (Left, Right, Bottom) -->
        <rect x="6" y="36" width="2" height="3" fill="#26170f"/>
        <rect x="8" y="37" width="2" height="1" fill="#26170f"/>
        <rect x="8" y="36" width="1" height="1" fill="#5b3416"/>
        <rect x="8" y="38" width="1" height="1" fill="#5b3416"/>
        <rect x="70" y="54" width="2" height="3" fill="#26170f"/>
        <rect x="68" y="55" width="2" height="1" fill="#26170f"/>
        <rect x="69" y="54" width="1" height="1" fill="#5b3416"/>
        <rect x="69" y="56" width="1" height="1" fill="#5b3416"/>
        <rect x="28" y="85" width="3" height="2" fill="#26170f"/>
        <rect x="29" y="84" width="1" height="1" fill="#5b3416"/>

        <!-- Stepped Pixel Dog-Eared Curled Corner at Bottom-Right -->
        <rect x="65" y="80" width="7" height="7" fill="#26170f"/>
        <rect x="64" y="79" width="1" height="8" fill="#5b3416"/>
        <rect x="64" y="79" width="8" height="1" fill="#5b3416"/>
        <rect x="65" y="80" width="6" height="1" fill="#9c6c34"/>
        <rect x="65" y="81" width="5" height="1" fill="#e6cf9b"/>
        <rect x="65" y="82" width="4" height="1" fill="#fff4d4"/>
        <rect x="65" y="83" width="3" height="1" fill="#f3e2b8"/>
        <rect x="65" y="84" width="2" height="1" fill="#d9ba80"/>
        <rect x="65" y="85" width="1" height="1" fill="#5b3416"/>

        <!-- Vintage Ink Corner Brackets & Subtle Paper Fold -->
        <rect x="10" y="15" width="4" height="1" fill="#7c4b22" opacity="0.7"/>
        <rect x="10" y="15" width="1" height="3" fill="#7c4b22" opacity="0.7"/>
        <rect x="64" y="15" width="4" height="1" fill="#7c4b22" opacity="0.7"/>
        <rect x="67" y="15" width="1" height="3" fill="#7c4b22" opacity="0.7"/>
        <rect x="11" y="50" width="56" height="1" fill="#8b5a28" opacity="0.18"/>

        <!-- Cast Shadow Beneath Top Roll -->
        <rect x="7" y="11" width="64" height="2" fill="#4f290e" opacity="0.48"/>
        <rect x="9" y="13" width="60" height="1" fill="#6b3e19" opacity="0.26"/>

        <!-- TOP PROTRUDING PIXEL WOODEN & BRASS SCROLL ROLLER + 3D ROLLED PARCHMENT CYLINDER -->
        <rect x="0" y="5" width="4" height="5" fill="#180a04"/>
        <rect x="1" y="6" width="2" height="3" fill="#d99f3c"/>
        <rect x="1" y="6" width="2" height="1" fill="#fff2b5"/>
        <rect x="3" y="4" width="3" height="7" fill="#180a04"/>
        <rect x="4" y="5" width="1" height="5" fill="#e5af46"/>
        <rect x="4" y="5" width="1" height="2" fill="#fff4bd"/>

        <rect x="74" y="5" width="4" height="5" fill="#180a04"/>
        <rect x="75" y="6" width="2" height="3" fill="#d99f3c"/>
        <rect x="75" y="6" width="2" height="1" fill="#fff2b5"/>
        <rect x="72" y="4" width="3" height="7" fill="#180a04"/>
        <rect x="73" y="5" width="1" height="5" fill="#e5af46"/>
        <rect x="73" y="5" width="1" height="2" fill="#fff4bd"/>

        <!-- Rolled Paper Cylinder -->
        <rect x="6" y="4" width="66" height="7" fill="#2e1508"/>
        <rect x="7" y="5" width="64" height="1" fill="#fff9e2"/>
        <rect x="7" y="6" width="64" height="2" fill="#efd8a4"/>
        <rect x="7" y="8" width="64" height="1" fill="#c79755"/>
        <rect x="7" y="9" width="64" height="1" fill="#75471c"/>
        <rect x="6" y="6" width="2" height="3" fill="#593112"/>
        <rect x="6" y="7" width="1" height="1" fill="#1f0d05"/>
        <rect x="70" y="6" width="2" height="3" fill="#593112"/>
        <rect x="71" y="7" width="1" height="1" fill="#1f0d05"/>
      </svg>`;
    }

    // Full 16-Bit Pixel-Art Double-Roller Unrolled Warband Contract Scroll (92 x 146 pixel grid => crisp 4px blocks!)
    return `<svg class="hs-scroll-svg contract" viewBox="0 0 92 146" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">
      <!-- Pixel Crimson Bookmark Ribbon Tail Peeking Below Bottom Roll -->
      <rect x="72" y="140" width="7" height="5" fill="#2b0409"/>
      <rect x="73" y="140" width="5" height="4" fill="#a81d2f"/>
      <rect x="74" y="140" width="1" height="3" fill="#e5b34c"/>
      <rect x="77" y="140" width="1" height="3" fill="#e5b34c"/>
      <rect x="75" y="143" width="1" height="2" fill="#140905"/>

      <!-- Stepped Pixel Hand-Torn Parchment Body -->
      <rect x="8" y="10" width="76" height="125" fill="#2e1508"/>
      <rect x="9" y="11" width="74" height="123" fill="#c79e5e"/>
      <rect x="10" y="12" width="72" height="121" fill="#ebd6a6"/>
      <!-- Stepped Pixel Warm Highlight & Edge Patina -->
      <rect x="11" y="13" width="70" height="5" fill="#f7e9c7"/>
      <rect x="10" y="12" width="2" height="121" fill="#d7b67c"/>
      <rect x="80" y="12" width="2" height="121" fill="#d7b67c"/>
      <!-- Subtle Pixel Checkerboard Dither on Edges -->
      <rect x="12" y="20" width="1" height="2" fill="#d7b67c"/>
      <rect x="12" y="26" width="1" height="2" fill="#d7b67c"/>
      <rect x="12" y="96" width="1" height="2" fill="#d7b67c"/>
      <rect x="79" y="24" width="1" height="2" fill="#d7b67c"/>
      <rect x="79" y="88" width="1" height="2" fill="#d7b67c"/>

      <!-- Authentic Stepped Pixel Torn Notches Along Left & Right Paper Sides -->
      <rect x="8" y="40" width="2" height="4" fill="#1b100a"/>
      <rect x="10" y="41" width="2" height="2" fill="#1b100a"/>
      <rect x="10" y="40" width="1" height="1" fill="#5b3416"/>
      <rect x="10" y="43" width="1" height="1" fill="#5b3416"/>
      <rect x="8" y="102" width="2" height="3" fill="#1b100a"/>
      <rect x="10" y="103" width="1" height="1" fill="#5b3416"/>

      <rect x="82" y="54" width="2" height="4" fill="#1b100a"/>
      <rect x="80" y="55" width="2" height="2" fill="#1b100a"/>
      <rect x="81" y="54" width="1" height="1" fill="#5b3416"/>
      <rect x="81" y="57" width="1" height="1" fill="#5b3416"/>
      <rect x="82" y="108" width="2" height="3" fill="#1b100a"/>
      <rect x="81" y="109" width="1" height="1" fill="#5b3416"/>

      <!-- Pixel Medieval Corner Flourishes & Faint Age Creases -->
      <rect x="13" y="15" width="5" height="1" fill="#7c4b22" opacity="0.68"/>
      <rect x="13" y="15" width="1" height="4" fill="#7c4b22" opacity="0.68"/>
      <rect x="74" y="15" width="5" height="1" fill="#7c4b22" opacity="0.68"/>
      <rect x="78" y="15" width="1" height="4" fill="#7c4b22" opacity="0.68"/>
      <rect x="13" y="129" width="5" height="1" fill="#7c4b22" opacity="0.68"/>
      <rect x="13" y="126" width="1" height="4" fill="#7c4b22" opacity="0.68"/>
      <rect x="74" y="129" width="5" height="1" fill="#7c4b22" opacity="0.68"/>
      <rect x="78" y="126" width="1" height="4" fill="#7c4b22" opacity="0.68"/>
      <rect x="14" y="73" width="64" height="1" fill="#8b5a28" opacity="0.18"/>
      <rect x="16" y="23" width="1" height="1" fill="#8b5a28" opacity="0.28"/>
      <rect x="76" y="31" width="1" height="1" fill="#8b5a28" opacity="0.28"/>
      <rect x="15" y="119" width="1" height="1" fill="#8b5a28" opacity="0.28"/>

      <!-- Cast Shadows Below Top Roll & Above Bottom Roll -->
      <rect x="9" y="11" width="74" height="2" fill="#4d280d" opacity="0.5"/>
      <rect x="11" y="13" width="70" height="1" fill="#6b3e19" opacity="0.25"/>
      <rect x="9" y="132" width="74" height="2" fill="#4d280d" opacity="0.45"/>
      <rect x="11" y="131" width="70" height="1" fill="#6b3e19" opacity="0.22"/>

      <!-- ═══ TOP PIXEL WOODEN & BRASS SCROLL ROLLER + ROLLED PAPER TUBE ═══ -->
      <rect x="0" y="4" width="5" height="6" fill="#180a04"/>
      <rect x="1" y="5" width="3" height="4" fill="#d99f3c"/>
      <rect x="1" y="5" width="2" height="1" fill="#fff2b5"/>
      <rect x="2" y="8" width="2" height="1" fill="#7c4b12"/>
      <rect x="4" y="3" width="3" height="8" fill="#180a04"/>
      <rect x="5" y="4" width="1" height="6" fill="#e5af46"/>
      <rect x="5" y="4" width="1" height="2" fill="#fff4bd"/>

      <rect x="87" y="4" width="5" height="6" fill="#180a04"/>
      <rect x="88" y="5" width="3" height="4" fill="#d99f3c"/>
      <rect x="88" y="5" width="2" height="1" fill="#fff2b5"/>
      <rect x="89" y="8" width="2" height="1" fill="#7c4b12"/>
      <rect x="85" y="3" width="3" height="8" fill="#180a04"/>
      <rect x="86" y="4" width="1" height="6" fill="#e5af46"/>
      <rect x="86" y="4" width="1" height="2" fill="#fff4bd"/>

      <rect x="7" y="3" width="78" height="8" fill="#2e1508"/>
      <rect x="8" y="4" width="76" height="1" fill="#fff9e2"/>
      <rect x="8" y="5" width="76" height="2" fill="#f0d9a6"/>
      <rect x="8" y="7" width="76" height="2" fill="#c79755"/>
      <rect x="8" y="9" width="76" height="1" fill="#704219"/>
      <rect x="7" y="5" width="2" height="4" fill="#593112"/>
      <rect x="7" y="6" width="1" height="2" fill="#1f0d05"/>
      <rect x="83" y="5" width="2" height="4" fill="#593112"/>
      <rect x="84" y="6" width="1" height="2" fill="#1f0d05"/>

      <!-- ═══ BOTTOM PIXEL WOODEN & BRASS SCROLL ROLLER + ROLLED PAPER TUBE ═══ -->
      <rect x="0" y="135" width="5" height="6" fill="#180a04"/>
      <rect x="1" y="136" width="3" height="4" fill="#d99f3c"/>
      <rect x="1" y="136" width="2" height="1" fill="#fff2b5"/>
      <rect x="2" y="139" width="2" height="1" fill="#7c4b12"/>
      <rect x="4" y="134" width="3" height="8" fill="#180a04"/>
      <rect x="5" y="135" width="1" height="6" fill="#e5af46"/>
      <rect x="5" y="135" width="1" height="2" fill="#fff4bd"/>

      <rect x="87" y="135" width="5" height="6" fill="#180a04"/>
      <rect x="88" y="136" width="3" height="4" fill="#d99f3c"/>
      <rect x="88" y="136" width="2" height="1" fill="#fff2b5"/>
      <rect x="89" y="139" width="2" height="1" fill="#7c4b12"/>
      <rect x="85" y="134" width="3" height="8" fill="#180a04"/>
      <rect x="86" y="135" width="1" height="6" fill="#e5af46"/>
      <rect x="86" y="135" width="1" height="2" fill="#fff4bd"/>

      <rect x="7" y="134" width="78" height="8" fill="#2e1508"/>
      <rect x="8" y="135" width="76" height="1" fill="#8f5c28"/>
      <rect x="8" y="136" width="76" height="1" fill="#fff8de"/>
      <rect x="8" y="137" width="76" height="2" fill="#ebd29e"/>
      <rect x="8" y="139" width="76" height="1" fill="#b78544"/>
      <rect x="8" y="140" width="76" height="1" fill="#5e3615"/>
      <rect x="7" y="136" width="2" height="4" fill="#593112"/>
      <rect x="7" y="137" width="1" height="2" fill="#1f0d05"/>
      <rect x="83" y="136" width="2" height="4" fill="#593112"/>
      <rect x="84" y="137" width="1" height="2" fill="#1f0d05"/>
    </svg>`;
  }

  function hsArchFrameSvg(accentColor) {
    // Pure 16-Bit Stepped Pixel-Art Gothic Arch Bezel + Side Volutes + Faceted Apex Jewel (64 x 44 pixel grid)
    return `<svg class="hs-arch-frame-svg" viewBox="0 0 64 44" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">
      <!-- Outer Dark Ink Outline of Stepped Pixel Arch -->
      <rect x="19" y="2" width="26" height="4" fill="#1c0d05"/>
      <rect x="13" y="4" width="7" height="4" fill="#1c0d05"/>
      <rect x="44" y="4" width="7" height="4" fill="#1c0d05"/>
      <rect x="9" y="7" width="5" height="4" fill="#1c0d05"/>
      <rect x="50" y="7" width="5" height="4" fill="#1c0d05"/>
      <rect x="6" y="10" width="4" height="5" fill="#1c0d05"/>
      <rect x="54" y="10" width="4" height="5" fill="#1c0d05"/>
      <rect x="4" y="14" width="4" height="24" fill="#1c0d05"/>
      <rect x="56" y="14" width="4" height="24" fill="#1c0d05"/>

      <!-- Burnished Gold Stepped Pixel Arch Core -->
      <rect x="20" y="3" width="24" height="2" fill="#e5af46"/>
      <rect x="14" y="5" width="7" height="2" fill="#e5af46"/>
      <rect x="43" y="5" width="7" height="2" fill="#e5af46"/>
      <rect x="10" y="8" width="5" height="2" fill="#d99f3c"/>
      <rect x="49" y="8" width="5" height="2" fill="#d99f3c"/>
      <rect x="7" y="11" width="2" height="4" fill="#c98e30"/>
      <rect x="55" y="11" width="2" height="4" fill="#c98e30"/>
      <rect x="5" y="15" width="2" height="22" fill="#b67d26"/>
      <rect x="57" y="15" width="2" height="22" fill="#b67d26"/>

      <!-- Crisp Cream-Gold Top Pixel Specular Highlights -->
      <rect x="21" y="3" width="22" height="1" fill="#fff4bd"/>
      <rect x="15" y="5" width="5" height="1" fill="#fff4bd"/>
      <rect x="44" y="5" width="5" height="1" fill="#fff4bd"/>
      <rect x="5" y="15" width="1" height="18" fill="#f3ca6e"/>
      <rect x="57" y="15" width="1" height="18" fill="#f3ca6e"/>

      <!-- Chunky Pixel Shoulder Volute Ornaments (Left & Right) -->
      <rect x="2" y="21" width="3" height="6" fill="#1c0d05"/>
      <rect x="3" y="22" width="2" height="4" fill="#e5af46"/>
      <rect x="3" y="22" width="1" height="2" fill="#fff4bd"/>
      <rect x="59" y="21" width="3" height="6" fill="#1c0d05"/>
      <rect x="59" y="22" width="2" height="4" fill="#e5af46"/>
      <rect x="59" y="22" width="1" height="2" fill="#fff4bd"/>

      <!-- Faceted Pixel Diamond Crown Jewel at Arch Apex -->
      <rect x="30" y="0" width="4" height="7" fill="#1c0d05"/>
      <rect x="28" y="1" width="8" height="5" fill="#1c0d05"/>
      <rect x="27" y="2" width="10" height="3" fill="#1c0d05"/>
      <rect x="30" y="1" width="4" height="5" fill="#e5af46"/>
      <rect x="28" y="2" width="8" height="3" fill="#e5af46"/>
      <rect x="30" y="2" width="4" height="3" fill="${accentColor || '#ffd966'}"/>
      <rect x="31" y="1" width="2" height="5" fill="${accentColor || '#ffd966'}"/>
      <rect x="30" y="2" width="2" height="1" fill="#ffffff" opacity="0.82"/>
    </svg>`;
  }

  function hsWaxSealSvg(char) {
    // Pure 16-Bit 18x18 Pixel-Art Scalloped Melted Wax Seal + Embossed Seal Glyph
    return `<span class="hs-wax-pixel-wrap">
      <svg class="hs-wax-svg" viewBox="0 0 18 18" shape-rendering="crispEdges" aria-hidden="true">
        <!-- Irregular Melted Pixel Wax Outline -->
        <rect x="6" y="0" width="6" height="18" fill="#260308"/>
        <rect x="3" y="1" width="12" height="16" fill="#260308"/>
        <rect x="1" y="3" width="16" height="12" fill="#260308"/>
        <rect x="0" y="6" width="18" height="6" fill="#260308"/>
        <!-- Organic Scalloped Melted Wax Drips -->
        <rect x="2" y="2" width="2" height="2" fill="#260308"/>
        <rect x="14" y="2" width="2" height="2" fill="#260308"/>
        <rect x="2" y="14" width="2" height="2" fill="#260308"/>
        <rect x="14" y="14" width="2" height="2" fill="#260308"/>
        <!-- Crimson Melted Wax Body -->
        <rect x="6" y="1" width="6" height="16" fill="#a8182a"/>
        <rect x="4" y="2" width="10" height="14" fill="#a8182a"/>
        <rect x="2" y="4" width="14" height="10" fill="#a8182a"/>
        <rect x="1" y="6" width="16" height="6" fill="#a8182a"/>
        <!-- Top-Left Glossy Wax Highlight Pixels -->
        <rect x="6" y="1" width="5" height="1" fill="#f04c60"/>
        <rect x="4" y="2" width="3" height="1" fill="#f04c60"/>
        <rect x="2" y="4" width="2" height="3" fill="#f04c60"/>
        <rect x="4" y="3" width="2" height="1" fill="#ff9ca8"/>
        <!-- Bottom-Right Deep Wax Shadow -->
        <rect x="6" y="16" width="6" height="1" fill="#5e0914"/>
        <rect x="12" y="14" width="2" height="2" fill="#5e0914"/>
        <rect x="15" y="8" width="2" height="4" fill="#5e0914"/>
        <!-- Stamped Inner Gold Pixel Ring -->
        <rect x="6" y="3" width="6" height="1" fill="#e5b34c"/>
        <rect x="6" y="14" width="6" height="1" fill="#c98e30"/>
        <rect x="3" y="6" width="1" height="6" fill="#e5b34c"/>
        <rect x="14" y="6" width="1" height="6" fill="#c98e30"/>
        <rect x="4" y="4" width="2" height="1" fill="#e5b34c"/>
        <rect x="4" y="5" width="1" height="1" fill="#e5b34c"/>
        <rect x="12" y="4" width="2" height="1" fill="#e5b34c"/>
        <rect x="13" y="5" width="1" height="1" fill="#e5b34c"/>
        <rect x="4" y="13" width="2" height="1" fill="#c98e30"/>
        <rect x="4" y="12" width="1" height="1" fill="#c98e30"/>
        <rect x="12" y="13" width="2" height="1" fill="#c98e30"/>
        <rect x="13" y="12" width="1" height="1" fill="#c98e30"/>
        <!-- Recessed Dark Stamp Center -->
        <rect x="5" y="5" width="8" height="8" fill="#6b0d19"/>
      </svg>
      <span class="hs-wax-glyph">${char}</span>
    </span>`;
  }

  // ─── Pack Opening Ceremony 60fps Artisan Ritual Canvas FX ───
  class PackCeremonyFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.time = 0;
      this.phase = 'idle';
      this.accent = '#ffd966';
      this.glow = '#ff942e';
      this.sparks = [];
      this.embers = [];
      this.rings = [];
      this.activeVfx = [];
      this.pillars = [];
      this.flashAlpha = 0;
      this.slashLife = 0;
    }

    start(accent, glow) {
      this.accent = accent || '#ffd966';
      this.glow = glow || '#ff942e';
      this.phase = 'charge';
      this.time = 0;
      this.sparks = [];
      this.rings = [];
      this.activeVfx = [];
      this.pillars = [];
      this.flashAlpha = 0;
      this.slashLife = 0;
      this.embers = Array.from({ length: 34 }, () => ({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        vy: -14 - Math.random() * 28,
        vx: (Math.random() - 0.5) * 16,
        size: Math.random() < 0.35 ? 4 : 2.5,
        phase: Math.random() * 6.28
      }));
      this.running = true;
      this.lastTs = performance.now();
      this.loop(this.lastTs);
    }

    stop() {
      this.running = false;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      this.ctx.clearRect(0, 0, 1280, 720);
    }

    triggerBurst(burstVfxKey) {
      this.phase = 'burst';
      this.flashAlpha = 0.88;
      this.slashLife = 0.52;
      this.rings.push({ x: 640, y: 345, r: 22, maxR: 520, color: '#fff7d6', life: 0.58, maxLife: 0.58, lw: 9 });
      this.rings.push({ x: 640, y: 345, r: 16, maxR: 410, color: this.accent, life: 0.72, maxLife: 0.72, lw: 6 });

      if (window.MT.vfx) {
        const v1 = window.MT.vfx.createInstance('fxExplosionBigWhiteHot', 640, 345, { scale: 3.0 });
        if (v1) this.activeVfx.push(v1);
        const v2 = window.MT.vfx.createInstance(burstVfxKey || 'fx_f1_holyimmolation', 640, 355, { scale: 2.7 });
        if (v2) this.activeVfx.push(v2);
      }

      const colors = ['#fff9e2', this.accent, this.glow, '#ffe08a'];
      for (let i = 0; i < 96; i++) {
        const ang = (i / 96) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const spd = 190 + Math.random() * 690;
        this.sparks.push({
          x: 640, y: 345, px: 640, py: 345,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 55,
          size: 3 + Math.random() * 5,
          star: i % 3 === 0,
          color: colors[i % colors.length],
          life: 0.6 + Math.random() * 0.6, maxLife: 1.2
        });
      }
    }

    addCardRevealPillar(x, color, isRainbow = false) {
      this.phase = 'reveal';
      this.pillars.push({ x, color, rainbow: isRainbow, alpha: 0, targetAlpha: isRainbow ? 0.52 : 0.36, born: this.time });
      this.rings.push({ x, y: 365, r: 18, maxR: 158, color: isRainbow ? '#fff7d6' : color, life: 0.44, maxLife: 0.44, lw: 4.5 });
      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2, spd = 75 + Math.random() * 230;
        this.sparks.push({
          x, y: 365, px: x, py: 365,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 115,
          size: 3 + Math.random() * 4.5,
          star: i % 2 === 0,
          color: isRainbow ? `hsl(${(i * 25) % 360}, 95%, 74%)` : color,
          life: 0.5 + Math.random() * 0.38, maxLife: 0.88
        });
      }
    }

    loop(ts) {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      this.time += dt;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);
      if (this.slashLife > 0) this.slashLife = Math.max(0, this.slashLife - dt);

      if (this.phase === 'charge' && Math.random() < 0.55) {
        const ang = Math.random() * Math.PI * 2, dist = 135 + Math.random() * 170;
        const sx = 640 + Math.cos(ang) * dist, sy = 345 + Math.sin(ang) * dist;
        this.sparks.push({
          x: sx, y: sy, px: sx, py: sy,
          vx: (640 - sx) * 3.1, vy: (345 - sy) * 3.1,
          size: 4.5, star: true,
          color: Math.random() < 0.45 ? '#fff8de' : this.accent,
          life: 0.34, maxLife: 0.34
        });
      }

      // Gentle upward ambient gold/rarity motes under revealed cards
      if (this.phase === 'reveal' && this.pillars.length > 0 && Math.random() < 0.32) {
        const pil = this.pillars[Math.floor(Math.random() * this.pillars.length)];
        const sx = pil.x + (Math.random() - 0.5) * 185;
        const sy = 530 + (Math.random() - 0.5) * 34;
        this.sparks.push({
          x: sx, y: sy, px: sx, py: sy,
          vx: (Math.random() - 0.5) * 18, vy: -52 - Math.random() * 58,
          size: 3 + Math.random() * 3, star: true,
          color: pil.rainbow ? `hsl(${(this.time * 180 + sx) % 360}, 95%, 74%)` : pil.color,
          life: 0.9 + Math.random() * 0.6, maxLife: 1.5
        });
      }

      for (const e of this.embers) {
        e.x += (e.vx + Math.sin(this.time * 1.4 + e.phase) * 10) * dt;
        e.y += e.vy * dt;
        if (e.y < -12) { e.y = 732; e.x = Math.random() * 1280; }
        if (e.x < -12) e.x = 1292;
        if (e.x > 1292) e.x = -12;
      }

      for (const pil of this.pillars) pil.alpha += (pil.targetAlpha - pil.alpha) * Math.min(1, dt * 6.5);
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i]; s.px = s.x; s.py = s.y; s.x += s.vx * dt; s.y += s.vy * dt;
        if (this.phase === 'burst') { s.vx *= Math.pow(0.16, dt); s.vy += 170 * dt; }
        s.life -= dt; if (s.life <= 0) this.sparks.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
      if (window.MT.vfx) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    drawPixelStar(ctx, x, y, r, color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      const w = Math.max(1.5, r * 0.28);
      ctx.fillRect(x - r, y - w * 0.5, r * 2, w);
      ctx.fillRect(x - w * 0.5, y - r, w, r * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - w * 0.7, y - w * 0.7, w * 1.4, w * 1.4);
      ctx.restore();
    }

    drawSacredMandala(ctx) {
      const cx = 640, cy = 358;
      const scale = this.phase === 'charge' ? (0.94 + Math.sin(this.time * 9) * 0.04) : 1.08;
      const alpha = this.phase === 'charge' ? 0.34 : 0.16;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Outer rotating astrolabe ring with arcane compass ticks
      ctx.save();
      ctx.rotate(this.time * (this.phase === 'charge' ? 0.65 : 0.14));
      ctx.strokeStyle = this.accent;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 236, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(0, 0, 218, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r0 = i % 2 === 0 ? 196 : 218;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * 244, Math.sin(a) * 244);
        ctx.stroke();
      }
      ctx.restore();

      // Counter-rotating 8-point celestial star
      ctx.save();
      ctx.rotate(-this.time * (this.phase === 'charge' ? 0.9 : 0.2));
      ctx.strokeStyle = '#ffe79e';
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI) / 4);
        ctx.strokeRect(-132, -132, 264, 264);
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, 148, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      ctx.restore();
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 1280, 720);
      ctx.save();

      // 1. Sacred rotating astrolabe & celestial sunburst rays
      ctx.globalCompositeOperation = 'lighter';
      this.drawSacredMandala(ctx);

      const rayCount = 12, raySpeed = this.phase === 'charge' ? 1.1 : 0.18, baseAlpha = this.phase === 'charge' ? 0.16 : 0.075;
      ctx.save(); ctx.translate(640, 355); ctx.rotate(this.time * raySpeed);
      for (let i = 0; i < rayCount; i++) {
        const a0 = (i / rayCount) * Math.PI * 2, a1 = a0 + (Math.PI / rayCount) * 0.56;
        const g = ctx.createRadialGradient(0, 0, 26, 0, 0, 620);
        g.addColorStop(0, this.accent); g.addColorStop(0.45, this.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = baseAlpha * (i % 2 === 0 ? 1 : 0.48);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 620, a0, a1); ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      // 2. Tapered Volumetric Cathedral Light Cones + Glowing Elliptical Floor Magic Sigils (NO flat rectangles!)
      for (const pil of this.pillars) {
        const col = pil.rainbow ? `hsl(${(this.time * 140 + pil.x) % 360}, 95%, 68%)` : pil.color;
        const pulse = 0.88 + Math.sin(this.time * 4.2 + pil.x) * 0.12;
        const topW = pil.rainbow ? 128 : 106;
        const botW = pil.rainbow ? 210 : 178;

        // Tapered volumetric cone from ceiling canopy down to card pedestal
        const coneGrad = ctx.createLinearGradient(pil.x, 76, pil.x, 595);
        coneGrad.addColorStop(0, 'rgba(0,0,0,0)');
        coneGrad.addColorStop(0.28, col);
        coneGrad.addColorStop(0.76, col);
        coneGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = pil.alpha * 0.42 * pulse;
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(pil.x - topW * 0.5, 76);
        ctx.lineTo(pil.x + topW * 0.5, 76);
        ctx.lineTo(pil.x + botW * 0.5, 595);
        ctx.lineTo(pil.x - botW * 0.5, 595);
        ctx.closePath();
        ctx.fill();

        // Soft glowing elliptical floor rune pedestal under each card
        ctx.save();
        ctx.translate(pil.x, 562);
        ctx.scale(1, 0.24);
        const floorGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 112);
        floorGrad.addColorStop(0, '#fff7dc');
        floorGrad.addColorStop(0.35, col);
        floorGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = pil.alpha * 0.9 * pulse;
        ctx.fillStyle = floorGrad;
        ctx.beginPath(); ctx.arc(0, 0, 112, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.globalAlpha = pil.alpha * 0.72;
        ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // 3. Diagonal Blazing Tear-Open Slash Arc on Burst
      if (this.slashLife > 0) {
        const p = this.slashLife / 0.52;
        ctx.save();
        ctx.translate(640, 345);
        ctx.rotate(-0.32);
        const sg = ctx.createLinearGradient(-460, 0, 460, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.32, this.accent);
        sg.addColorStop(0.5, '#ffffff');
        sg.addColorStop(0.68, this.accent);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = Math.min(1, p * 1.4);
        ctx.fillStyle = sg;
        const thick = 26 * p;
        ctx.beginPath();
        ctx.moveTo(-460, 0);
        ctx.quadraticCurveTo(0, -thick, 460, 0);
        ctx.quadraticCurveTo(0, thick, -460, 0);
        ctx.fill();
        ctx.restore();
      }

      // 4. Shockwave rings
      for (const rg of this.rings) {
        const p = 1 - Math.max(0, rg.life / rg.maxLife), r = rg.r + (rg.maxR - rg.r) * (1 - Math.pow(1 - p, 3));
        ctx.globalAlpha = (1 - p) * 0.85; ctx.strokeStyle = rg.color; ctx.lineWidth = Math.max(1.5, rg.lw * (1 - p * 0.6));
        ctx.beginPath(); ctx.arc(rg.x, rg.y, r, 0, Math.PI * 2); ctx.stroke();
      }

      // 5. Duelyst Burst VFX sprites
      if (window.MT.vfx) {
        ctx.globalCompositeOperation = 'source-over';
        for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);
        ctx.globalCompositeOperation = 'lighter';
      }

      // 6. Floating Candle Embers + 4-Point Diamond Pixel Stars
      for (const e of this.embers) {
        const a = 0.28 + Math.sin(this.time * 3 + e.phase) * 0.2;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffda7a';
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }
      for (const s of this.sparks) {
        const a = Math.max(0, s.life / s.maxLife);
        if (s.star) {
          this.drawPixelStar(ctx, s.x, s.y, s.size * 1.65, s.color, a);
        } else {
          ctx.globalAlpha = a; ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
          ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
        }
      }

      if (this.flashAlpha > 0) { ctx.globalAlpha = this.flashAlpha * 0.72; ctx.fillStyle = '#fff5d6'; ctx.fillRect(0, 0, 1280, 720); }
      ctx.restore();
    }
  }

  // ─── Main v12 Game Controller ───
  class V12Game {
    constructor() {
      this.stageEl = document.getElementById('stage');
      this.titleFx = window.MT.TitleRainFX ? new window.MT.TitleRainFX(document.getElementById('title-fx-canvas')) : null;
      this.tavern = new window.MT.EclipseAltarBg(document.getElementById('altar-bg-canvas'));
      this.battle = new window.MT.V12Battle(document.getElementById('battle-canvas'));
      this.packFx = new PackCeremonyFX(document.getElementById('pack-fx-canvas'));

      this.state = null;
      this.swapSlotIdx = -1;
      this.activePack = null;
      this.packTimers = [];
      this.muted = false;
      this._enteringFromTitle = false;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.addEventListener('change', () => this.syncTitleMotion());

      this.bindGlobalEvents();
      this.fitStage();
      window.addEventListener('resize', () => this.fitStage());
    }

    fitStage() {
      const viewport = this.stageEl.parentElement;
      const { paddingLeft, paddingRight, paddingTop, paddingBottom } = getComputedStyle(viewport);
      const width = viewport.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
      const height = viewport.clientHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
      if (width <= 0 || height <= 0) return;

      const scale = Math.min(width / 1280, height / 720);
      const stageWidth = Math.max(1280, Math.min(1640, width / scale));
      this.stageEl.style.setProperty('--stage-width', `${stageWidth}px`);
      this.stageEl.style.setProperty('--tap-size', `${width >= height ? Math.max(48, Math.ceil(44 / scale)) : 48}px`);
      this.stageEl.style.transform = `scale(${scale})`;
      const pop = document.getElementById('shop-detail-popover');
      if (this.shopAnchor && !pop.classList.contains('hidden')) this.positionShopInspector(pop, this.shopAnchor);
    }

    async init() {
      await Promise.all([
        window.MT.sprites ? window.MT.sprites.load() : Promise.resolve(),
        window.MT.vfx ? window.MT.vfx.load() : Promise.resolve()
      ]);
      this.showTitleScreen();
    }

    // ─── BEAT 0: Rainy Midnight Tavern Exterior Title Screen ───
    showTitleScreen() {
      this._enteringFromTitle = false;
      this.closeAllModals();
      if (this.tavern) this.tavern.stop();
      document.getElementById('battle-view').classList.add('hidden');
      document.getElementById('tavern-view').classList.add('hidden');
      document.getElementById('top-hud').classList.add('hidden');
      document.getElementById('market-main-stage').classList.add('hidden');
      document.getElementById('relic-inspect-bar').classList.add('hidden');

      const titleEl = document.getElementById('title-screen-view');
      if (titleEl) {
        titleEl.classList.remove('hidden', 'entering');
      }
      this.syncTitleMotion();
      this.syncMuteLabels();
    }

    syncTitleMotion() {
      if (!this.titleFx || document.getElementById('title-screen-view').classList.contains('hidden')) return;
      if (this.reducedMotion.matches) this.titleFx.stop();
      else this.titleFx.start();
    }

    enterDeckSelectFromTitle() {
      if (this._enteringFromTitle) return;
      this._enteringFromTitle = true;
      if (window.MT.sfx) window.MT.sfx.playChainDing(4, false);

      const titleEl = document.getElementById('title-screen-view');
      if (titleEl) titleEl.classList.add('entering');

      // Warm doorway transition onto the live candlelit walnut tabletop
      setTimeout(() => {
        if (this.titleFx) this.titleFx.stop();
        if (titleEl) titleEl.classList.add('hidden', 'entering');
        this.tavern.start();
        this.showStarterDeckSelect();
        this._enteringFromTitle = false;
      }, this.reducedMotion.matches ? 0 : 340);
    }

    syncMuteLabels() {
      const topBtn = document.getElementById('btn-mute');
      if (topBtn) topBtn.textContent = this.muted ? '静音' : '音效';
      const cBtn = document.getElementById('btn-contracts-mute');
      if (cBtn) cBtn.textContent = this.muted ? '静音' : '音效';
      const tBtn = document.getElementById('btn-title-mute');
      if (tBtn) tBtn.textContent = this.muted ? '音效：关' : '音效：开';
    }

    toggleMute() {
      this.muted = !this.muted;
      if (window.MT.sfx) window.MT.sfx.muted = this.muted;
      this.syncMuteLabels();
    }

    // ─── Opening 3 Aged-Parchment Warband Contracts Spread Directly on the Walnut Tabletop ───
    showStarterDeckSelect() {
      const D = window.MT.V12_DATA;
      const fallbackIcon = './assets/gear/eq_dragon_heart.png';
      this.closeAllModals();
      if (this.titleFx) this.titleFx.stop();
      const titleEl = document.getElementById('title-screen-view');
      if (titleEl) titleEl.classList.add('hidden', 'entering');

      document.getElementById('battle-view').classList.add('hidden');
      document.getElementById('tavern-view').classList.remove('hidden');
      document.getElementById('top-hud').classList.add('hidden');
      document.getElementById('market-main-stage').classList.add('hidden');
      document.getElementById('relic-inspect-bar').classList.add('hidden');
      this.tavern.syncMercenaries([]);
      this.tavern.start();
      this.syncMuteLabels();

      const shortPitch = {
        deck_balanced: '盾刃法均衡稳健，主打换桌凑铁三角与稳定破招。',
        deck_frostsand: '秘术偏多放大秘宝收益，专克魔盾与蓄力 Boss。',
        deck_shadowbox: '开局解锁《暗影包厢》，暂存蓄力 ×1.5 一击核爆。'
      };

      const grid = document.getElementById('deck-select-grid');
      grid.innerHTML = D.STARTER_DECKS.map((dk, idx) => {
        const relic = D.RELICS.find((r) => r.id === dk.relicId);
        const rIcon = relic && window.MT.vfx ? window.MT.vfx.getIconUrl(relic.icon, fallbackIcon) : fallbackIcon;

        // Compute live faction breakdown from heroIds for visual ratio bar
        const facCounts = {};
        for (const hid of dk.heroIds) {
          const tpl = D.HEROES.find((h) => h.id === hid);
          if (tpl) facCounts[tpl.faction] = (facCounts[tpl.faction] || 0) + 1;
        }
        const total = Math.max(1, dk.heroIds.length);
        const sortedFacs = Object.entries(facCounts).sort((a, b) => b[1] - a[1]);
        const segBar = sortedFacs.map(([fid, cnt]) => {
          const f = D.FACTIONS[fid];
          return `<i style="width:${(cnt / total) * 100}%;background:${f.color}"></i>`;
        }).join('');
        const facTags = sortedFacs.map(([fid, cnt]) => {
          const f = D.FACTIONS[fid];
          return `<span class="wc-fac-item"><em style="background:${f.color}"></em>${f.name} <b>${cnt}</b></span>`;
        }).join('');

        return `
          <button class="warband-contract-card tilt-${idx}" data-deckid="${dk.id}" style="--dcol:${dk.color}">
            ${hsScrollBackdropSvg('contract', dk.id)}
            <div class="wc-scroll-content">
              <div class="wc-head">
                <span class="wc-seal-tag">${dk.tag}</span>
              </div>
              <div class="wc-arch-stage">
                <div class="wc-arch-backdrop">
                  <div class="wc-plinth" aria-hidden="true"></div>
                </div>
                ${hsArchFrameSvg(dk.color, dk.id)}
                <div class="wc-sprite" data-unit="${dk.previewUnit}"></div>
                <div class="wc-name-ribbon">
                  <span class="wc-rib-tail l" aria-hidden="true"></span>
                  <b>${dk.name}</b>
                  <span class="wc-rib-tail r" aria-hidden="true"></span>
                </div>
              </div>
              <div class="wc-comp">
                <div class="wc-comp-tags">${facTags}</div>
                <div class="wc-comp-bar">${segBar}</div>
              </div>
              <div class="wc-ink-divider" aria-hidden="true"><span></span><i>◆</i><span></span></div>
              <div class="wc-relic-crest">
                <div class="wc-relic-medallion">
                  <img src="${rIcon}" alt="${relic ? relic.name : ''}" onerror="this.onerror=null;this.src='${fallbackIcon}'" />
                </div>
                <div class="wc-relic-txt">
                  <span class="wc-relic-kicker">开局秘宝</span>
                  <b>${relic ? relic.name : ''} <em>${relic ? relic.short : ''}</em></b>
                </div>
              </div>
              <div class="wc-pitch">${shortPitch[dk.id] || dk.desc}</div>
              <div class="wc-sign-cta">
                <span class="wc-wax-holder" aria-hidden="true">${hsWaxSealSvg('契')}</span>
                <span class="wc-cta-label">签约出战</span>
              </div>
            </div>
          </button>`;
      }).join('');

      grid.querySelectorAll('.wc-sprite').forEach((s) => {
        const sp = window.MT.sprites.createDomSprite(s.dataset.unit, 'idle', 162);
        if (sp) s.appendChild(sp);
      });
      grid.querySelectorAll('.warband-contract-card').forEach((btn) => {
        btn.onclick = () => {
          if (window.MT.sfx) window.MT.sfx.playChainDing(4, true);
          this.startNewRun(btn.dataset.deckid);
        };
      });

      document.getElementById('deck-select-modal').classList.remove('hidden');
    }

    startNewRun(deckId = 'deck_balanced') {
      const D = window.MT.V12_DATA;
      const deck = D.STARTER_DECKS.find((d) => d.id === deckId) || D.STARTER_DECKS[0];
      const starterRelicTpl = D.RELICS.find((r) => r.id === deck.relicId) || D.RELICS[0];

      document.getElementById('deck-select-modal').classList.add('hidden');
      document.getElementById('top-hud').classList.remove('hidden');
      document.getElementById('market-main-stage').classList.remove('hidden');

      this.state = {
        deckId: deck.id,
        runSeed: Math.floor(Math.random() * 1000),
        wave: 1,
        hearts: 3,
        maxHearts: 3,
        gold: 6,
        view: 'battle',
        roster: D.createStarterRoster(deck.id),
        drawPile: [],
        discardPile: [],
        hand: [],
        boxedHero: null,  // Independent Shadow Box Hold Slot (only usable if owning r_shadowbox!)
        selectedIds: [],
        frozenUid: null,
        discardsLeft: D.MAX_DISCARDS,
        relics: [{ uid: 'r_start_1', tplId: starterRelicTpl.id, tpl: starterRelicTpl, edition: 'normal' }],
        handLevels: { royal_triangle: 1, three_kind: 1, flush: 1, triangle: 1, pair: 1, high_card: 1 },
        shop: null,
        rerollCost: 3,
        endless: false
      };
      this.swapSlotIdx = -1;
      this.closeAllModals();
      this.enterBattleWave();
    }

    getMaxRelicSlots() {
      return 5 + this.state.relics.filter((r) => r.edition === 'negative').length;
    }

    hasShadowBox() {
      return this.state.relics.some((r) => r.tpl && r.tpl.unlocksBox);
    }

    // ─── Deck Management Inside Mirror-Lake 4-Round Battle ───
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    initWaveDeck() {
      // Clear per-wave temporary buffs (Shadow Box charge, held tags)
      for (const h of this.state.roster) { h.boxMult = 1; h.heldFromPrev = false; }
      this.state.drawPile = this.shuffle(this.state.roster);
      this.state.discardPile = [];
      this.state.hand = [];
      this.state.boxedHero = null;
      this.state.selectedIds = [];
      this.state.frozenUid = null;
      this.state.discardsLeft = window.MT.V12_DATA.MAX_DISCARDS;
      this.refillBattleHand(5);
    }

    // GPT Fix #1: Treat 5 as hand CAP, never draw boxed or currently-in-hand heroes!
    refillBattleHand(targetCap = 5) {
      const excluded = new Set(this.state.hand.map((h) => h.uid));
      if (this.state.boxedHero) excluded.add(this.state.boxedHero.uid);
      const maxTotal = Math.min(targetCap, this.state.roster.length - (this.state.boxedHero ? 1 : 0));

      while (this.state.hand.length < maxTotal) {
        if (this.state.drawPile.length === 0) {
          const recycle = this.state.roster.filter((h) => !excluded.has(h.uid));
          if (recycle.length === 0) break;
          this.state.drawPile = this.shuffle(recycle);
          this.state.discardPile = [];
        }
        const next = this.state.drawPile.pop();
        if (!next || excluded.has(next.uid)) continue;
        const live = this.state.roster.find((r) => r.uid === next.uid);
        if (!live) continue;
        excluded.add(live.uid);
        live.heldFromPrev = false;
        this.state.hand.push(live);
      }
    }

    // ─── BEAT 1: Enter Outdoor Mirror-Lake 4-Round Battle ───
    enterBattleWave() {
      const D = window.MT.V12_DATA;
      this.dismissToast();
      this.state.view = 'battle';
      document.getElementById('tavern-view').classList.add('hidden');
      document.getElementById('battle-view').classList.remove('hidden');

      this.initWaveDeck();
      const bossCfg = D.getWaveBoss(this.state.wave, this.state.runSeed);

      this.battle.startWave({
        bossCfg,
        relics: this.state.relics,
        maxRelicSlots: this.getMaxRelicSlots(),
        runCtx: {
          wave: this.state.wave,
          gold: this.state.gold,
          discardsLeft: this.state.discardsLeft,
          rosterSize: this.state.roster.length
        },
        onRoundReady: ({ freezeRight }) => this.handleNextBattleRound(freezeRight),
        onDone: (res) => this.handleBattleDone(res)
      });

      this.showBattlePickDock(true);
      this.renderBattleHandDock();
    }

    handleNextBattleRound(freezeRight) {
      // Mark surviving unplayed hand cards with 「留手」 badge!
      for (const h of this.state.hand) h.heldFromPrev = true;

      // Shadow Box hero charges up ×1.5 at end of round (capped at ×3.0)!
      if (this.state.boxedHero) {
        const nextMult = Math.min(3.0, +((this.state.boxedHero.boxMult || 1) * 1.5).toFixed(2));
        this.state.boxedHero.boxMult = nextMult;
        this.toast(`暗影包厢蓄力：【${this.state.boxedHero.name}】本波攻击 ×${nextMult}！`);
      }

      this.state.selectedIds = [];
      this.state.frozenUid = null;
      this.refillBattleHand(5);

      // GPT Fix #1: Only freeze rightmost card if main hand has >= 4 cards (guarantees >= 3 playable!)
      if (freezeRight && this.state.hand.length >= 4) {
        this.state.frozenUid = this.state.hand[this.state.hand.length - 1].uid;
      }
      this.showBattlePickDock(true);
      this.renderBattleHandDock();
    }

    showBattlePickDock(show) {
      document.getElementById('bt-hand-dock').classList.toggle('hidden', !show);
      document.getElementById('bt-forecast-bar').classList.toggle('hidden', !show);
      document.getElementById('battle-live-telemetry').classList.toggle('hidden', show);
    }

    toggleSelectBattleHero(uid) {
      if (this.battle.phase !== 'picking') return;
      if (uid === this.state.frozenUid) { this.toast('这张卡牌被 Boss 冰封，本回合无法选中！'); return; }
      const idx = this.state.selectedIds.indexOf(uid);
      if (idx >= 0) this.state.selectedIds.splice(idx, 1);
      else {
        if (this.state.selectedIds.length >= 3) this.state.selectedIds.shift();
        this.state.selectedIds.push(uid);
      }
      if (window.MT.sfx) window.MT.sfx.playChainDing(this.state.selectedIds.length, false);
      const selected = this.state.selectedIds.map((id) => this.state.hand.find((h) => h.uid === id)).filter(Boolean);
      this.battle.previewSelectedHeroes(selected);
      this.renderBattleHandDock();
    }

    // ─── 《暗影包厢》 Store / Recall / Swap (Strictly follows GPT v12 Fixes #1 & #2!) ───
    handleShadowBoxClick() {
      if (this.battle.phase !== 'picking' || !this.hasShadowBox()) return;

      const unfrozenHand = this.state.hand.filter((h) => h.uid !== this.state.frozenUid);

      // Case A: Box is EMPTY -> Store the single selected unfrozen hero!
      if (!this.state.boxedHero) {
        if (this.state.selectedIds.length !== 1) {
          this.toast('请先只选中 1 张手牌，再点击【暗影包厢】存入蓄力！');
          return;
        }
        // GPT Fix #1: Hard invariant — at least 3 unfrozen playable cards must remain in main hand!
        if (unfrozenHand.length < 4) {
          this.toast('主手至少需保留 3 张可出击侠客，当前无法存入包厢！');
          return;
        }
        const uid = this.state.selectedIds[0];
        const idx = this.state.hand.findIndex((h) => h.uid === uid);
        if (idx < 0 || uid === this.state.frozenUid) return;

        // GPT Fix #2: Store leaves 4 cards in main hand (NO extra free card draw this turn!)
        const [hero] = this.state.hand.splice(idx, 1);
        hero.heldFromPrev = false;
        this.state.boxedHero = hero;
        this.state.selectedIds = [];
        if (window.MT.sfx) window.MT.sfx.playChainDing(4, true);
        this.battle.previewSelectedHeroes([]);
        this.renderBattleHandDock();
        this.toast(`【${hero.name}】进入暗影包厢！回合结束攻击 ×1.5（下回合补满 5 张手牌）`);
        return;
      }

      // Case B: Box is OCCUPIED -> Recall (if hand < 5) OR Swap with 1 selected unfrozen card (if hand == 5)!
      if (this.state.hand.length < 5) {
        const hero = this.state.boxedHero;
        this.state.boxedHero = null;
        this.state.hand.unshift(hero);
        if (this.state.selectedIds.length < 3) this.state.selectedIds.push(hero.uid);
        if (window.MT.sfx) window.MT.sfx.playChainDing(5, true);
        const selected = this.state.selectedIds.map((id) => this.state.hand.find((h) => h.uid === id)).filter(Boolean);
        this.battle.previewSelectedHeroes(selected);
        this.renderBattleHandDock();
        this.toast(`召回【${hero.name}】出击！（当前攻击 ×${hero.boxMult || 1}）`);
      } else {
        // GPT Fix #2: Full 5-card hand requires selecting 1 unfrozen card to swap!
        if (this.state.selectedIds.length !== 1) {
          this.toast('手牌已满 5 张！请先只选中 1 张手牌，再点包厢互换！');
          return;
        }
        const uid = this.state.selectedIds[0];
        const idx = this.state.hand.findIndex((h) => h.uid === uid);
        if (idx < 0 || uid === this.state.frozenUid) return;
        const incoming = this.state.boxedHero;
        const outgoing = this.state.hand[idx];
        outgoing.heldFromPrev = false;
        this.state.hand[idx] = incoming;
        this.state.boxedHero = outgoing;
        this.state.selectedIds = [incoming.uid];
        if (window.MT.sfx) window.MT.sfx.playChainDing(5, true);
        this.battle.previewSelectedHeroes([incoming]);
        this.renderBattleHandDock();
        this.toast(`互换成功：【${incoming.name}】登台，【${outgoing.name}】入包厢蓄力！`);
      }
    }

    discardAndRedrawBattle() {
      if (this.battle.phase !== 'picking') return;
      if (this.state.discardsLeft <= 0) { this.toast('本波换桌次数已用完！'); return; }

      const keepSet = new Set(this.state.selectedIds);
      if (this.state.frozenUid) keepSet.add(this.state.frozenUid);
      const toSwap = this.state.hand.filter((h) => !keepSet.has(h.uid));
      if (toSwap.length === 0) { this.toast('请先取消选中想换掉的侠客'); return; }

      const currentCap = this.state.hand.length; // Preserve 4-card hand if stored into Shadow Box this turn!
      this.state.discardsLeft--;
      this.state.discardPile.push(...toSwap);
      this.state.hand = this.state.hand.filter((h) => keepSet.has(h.uid));
      this.refillBattleHand(currentCap);

      if (window.MT.sfx) window.MT.sfx.playChainDing(2, false);
      this.battle.shake(4, 0.14);
      const selected = this.state.selectedIds.map((id) => this.state.hand.find((h) => h.uid === id)).filter(Boolean);
      this.battle.previewSelectedHeroes(selected);
      this.renderBattleHandDock();
      this.toast(`换桌重抽 ${toSwap.length} 人！剩余 ${this.state.discardsLeft} 次`);
    }

    strikeWithSelectedHand() {
      if (this.battle.phase !== 'picking') return;
      const D = window.MT.V12_DATA;
      const squad3 = this.state.selectedIds.map((uid) => this.state.hand.find((h) => h.uid === uid)).filter(Boolean);
      if (squad3.length < 3) { this.toast('请先点选 3 位侠客出击！'); return; }

      const handEval = D.evaluateHand(squad3, this.state.handLevels);
      // Snapshot combat copies before resetting temp boxMult/heldFromPrev on discard
      const combatSquad = squad3.map((h) => ({ ...h }));

      const playedSet = new Set(squad3.map((h) => h.uid));
      for (const h of squad3) { h.boxMult = 1; h.heldFromPrev = false; }
      this.state.discardPile.push(...squad3);
      this.state.hand = this.state.hand.filter((h) => !playedSet.has(h.uid));
      this.state.selectedIds = [];

      this.showBattlePickDock(false);
      document.getElementById('bt-hand-pill').innerHTML = `<b style="color:${handEval.hand.color}">${handEval.hand.name} Lv.${handEval.lv}</b> <span>×${handEval.mult}</span>`;

      this.battle.executeHand({
        squad3: combatSquad,
        handEval,
        runCtx: {
          wave: this.state.wave,
          gold: this.state.gold,
          discardsLeft: this.state.discardsLeft,
          rosterSize: this.state.roster.length
        }
      });
    }

    renderBattleHandDock() {
      const D = window.MT.V12_DATA;
      const selected = this.state.selectedIds.map((uid) => this.state.hand.find((h) => h.uid === uid)).filter(Boolean);
      const ev = D.evaluateHand(selected, this.state.handLevels);
      const intent = this.battle.bossIntent;
      const row = document.getElementById('bt-cards-row');
      const focusedHero = row.contains(document.activeElement) ? document.activeElement.dataset.huid : null;

      // Update Transparent Draw / Discard Pile Counts!
      document.getElementById('btn-draw-pile').innerHTML = `抽牌堆 <b>${this.state.drawPile.length}</b>`;
      document.getElementById('btn-discard-pile').innerHTML = `弃牌堆 <b>${this.state.discardPile.length}</b>`;

      // Tactical Forecast Bar
      const fBar = document.getElementById('bt-forecast-bar');
      let counterTag = '';
      if (intent) {
        if (intent.kind === 'charge') {
          const strikerBonus = selected.some((h) => h.role === 'striker') ? 1.15 : 1.0;
          const estBreak = Math.round(ev.estBaseDmg * strikerBonus);
          if (ev.ready && estBreak >= intent.breakNeed) counterTag = `<span class="fc-pill ok">可破招</span>`;
          else counterTag = `<span class="fc-pill warn">${ev.ready ? `差 ${Math.max(0, intent.breakNeed - estBreak)} 伤破招` : `破招需 ${intent.breakNeed} 伤`}</span>`;
        } else if (intent.dmg > 0) {
          const hpLoss = Math.max(0, intent.dmg - ev.shield);
          if (ev.shield >= intent.dmg) counterTag = `<span class="fc-pill ok">完全格挡</span>`;
          else if (hpLoss >= this.battle.squadHp) counterTag = `<span class="fc-pill danger">致命 · −${hpLoss} 气血</span>`;
          else counterTag = `<span class="fc-pill warn">预计失去 ${hpLoss} 气血</span>`;
        } else if (intent.kind === 'stunned') {
          counterTag = `<span class="fc-pill ok">眩晕易伤 +50%</span>`;
        }
      }

      const fcCore = document.getElementById('fc-core-content');
      if (ev.ready) {
        fBar.className = 'bt-forecast-bar ready';
        fcCore.innerHTML = `
          <div class="fc-left">
            <b style="color:${ev.hand.color}">${ev.hand.name} Lv.${ev.lv}</b>
            <span class="fc-mult" style="background:${ev.hand.color}">×${ev.mult}</span>
            <span class="fc-dmg">基础 ~${ev.estBaseDmg}+</span>
            ${ev.shield > 0 ? `<span class="fc-shield">🛡 +${ev.shield}盾</span>` : ''}
          </div>
          <div class="fc-right">${counterTag}</div>`;
      } else {
        fBar.className = 'bt-forecast-bar';
        fcCore.innerHTML = `
          <div class="fc-left">
            <b>已选 ${ev.count}/3</b>
          </div>
          <div class="fc-right">${counterTag}</div>`;
      }

      // Discard Wing
      const discBtn = document.getElementById('btn-bt-discard');
      const swappable = this.state.hand.filter((h) => !this.state.selectedIds.includes(h.uid) && h.uid !== this.state.frozenUid).length;
      discBtn.disabled = this.state.discardsLeft <= 0 || swappable === 0;
      discBtn.innerHTML = `<span class="wing-title">重抽</span><span class="wing-sub">剩 ${this.state.discardsLeft} 次</span><span class="wing-sub">换未选 ${swappable} 张</span>`;

      // Relic-Unlocked 《暗影包厢》 Slot (Hidden unless player owns r_shadowbox!)
      const hasBox = this.hasShadowBox();
      const dockEl = document.getElementById('bt-hand-dock');
      dockEl.classList.toggle('with-box', hasBox);
      const boxBtn = document.getElementById('btn-shadow-box');
      boxBtn.classList.toggle('hidden', !hasBox);
      if (hasBox) {
        const bh = this.state.boxedHero;
        if (!bh) {
          boxBtn.className = 'shadow-box-slot empty';
          boxBtn.innerHTML = `
            <span class="sb-title">☾ 暗影包厢</span>
            <span class="sb-hint">选1张点此存入<br>每回合攻 ×1.5</span>`;
        } else {
          const fac = D.FACTIONS[bh.faction];
          const effAtk = Math.round(bh.atk * (bh.boxMult || 1));
          boxBtn.className = 'shadow-box-slot filled';
          boxBtn.style.setProperty('--fcol', fac.color);
          boxBtn.innerHTML = `
            <span class="sb-mult">×${bh.boxMult || 1}</span>
            <div class="sb-sprite" data-unit="${bh.unitId}"></div>
            <div class="sb-name">${bh.name.slice(0, 5)}</div>
            <div class="sb-atk">攻 ${effAtk} · 点取回</div>`;
          const spWrap = boxBtn.querySelector('.sb-sprite');
          const sp = window.MT.sprites.createDomSprite(bh.unitId, 'idle', 68);
          if (sp && spWrap) spWrap.appendChild(sp);
        }
      }

      const strikeBtn = document.getElementById('btn-bt-strike');
      strikeBtn.disabled = !ev.ready;
      strikeBtn.innerHTML = '<span class="wing-title">出击</span>';

      // Main Hand Cards (4 or 5) — Big Tactile Cards!
      row.innerHTML = this.state.hand.map((h) => {
        const fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
        const selIdx = this.state.selectedIds.indexOf(h.uid);
        const isSel = selIdx >= 0;
        const isFrozen = h.uid === this.state.frozenUid;
        const effAtk = Math.round(h.atk * (h.boxMult || 1));
        return `
          <button class="hero-hand-card ${isSel ? 'selected' : ''} ${h.redSeal ? 'has-seal' : ''} ${h.heldFromPrev ? 'is-held' : ''} ${isFrozen ? 'frozen' : ''}" data-huid="${h.uid}" aria-pressed="${isSel}" ${isFrozen ? 'disabled' : ''} style="--fcol:${fac.color};--fbg:${fac.bg}">
            <div class="hhc-top">
              <span class="hhc-fac">${fac.name}</span>
              <span class="hhc-role" style="color:${role.color}">${role.short}·${role.perkShort}</span>
            </div>
            <div class="hhc-sprite" data-unit="${h.unitId}"></div>
            <div class="hhc-name">${h.redSeal ? '◈' : ''}${h.ironPlated ? '🛡' : ''}${h.name}</div>
            <div class="hhc-atk">攻 <b>${effAtk}</b>${h.boxMult > 1 ? ` <i>×${h.boxMult}</i>` : ''}${h.ironPlated ? ' · +15盾' : ''}</div>
            ${isSel ? `<span class="hhc-pick-badge">出击 #${selIdx + 1}</span>` : (h.heldFromPrev ? `<span class="hhc-held-badge">留手</span>` : '')}
            ${isFrozen ? `<span class="hhc-frozen-badge">❄ 冻结</span>` : ''}
          </button>`;
      }).join('');

      row.querySelectorAll('.hhc-sprite').forEach((s) => {
        const sp = window.MT.sprites.createDomSprite(s.dataset.unit, 'idle', 96);
        if (sp) s.appendChild(sp);
      });
      row.querySelectorAll('.hero-hand-card').forEach((btn) => {
        btn.onclick = () => this.toggleSelectBattleHero(btn.dataset.huid);
        if (btn.dataset.huid === focusedHero) btn.focus({ preventScroll: true });
      });
    }

    // ─── Draw / Discard Pile Inspector Modal (Slay the Spire Card-Counting!) ───
    openPileModal(kind = 'draw') {
      const D = window.MT.V12_DATA;
      const list = kind === 'draw' ? [...this.state.drawPile] : [...this.state.discardPile];
      // Sort by faction so draw order is NEVER leaked!
      list.sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));

      this.showRosterDialog('pile');

      const counts = {};
      for (const h of list) counts[h.faction] = (counts[h.faction] || 0) + 1;
      document.getElementById('rm-summary').innerHTML =
        `<span class="rm-fac-pill" style="background:#262d47;color:#ffd966">${kind === 'draw' ? '抽牌堆' : '弃牌堆'} ${list.length} 张</span>` +
        Object.entries(counts).map(([fid, c]) => `<span class="rm-fac-pill" style="background:${D.FACTIONS[fid].bg};color:${D.FACTIONS[fid].color}">${D.FACTIONS[fid].name} ×${c}</span>`).join('');

      const body = document.getElementById('rm-body');
      if (list.length === 0) {
        body.innerHTML = '<p class="rm-empty">牌堆为空</p>';
        return;
      }
      body.innerHTML = `<div class="rm-roster-grid">` + list.map((h) => {
        const fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
        return `<div class="rm-hero-tile" style="--fcol:${fac.color}"><div class="rm-spr" data-unit="${h.unitId}"></div><div class="rm-hname">${h.redSeal ? '◈' : ''}${h.ironPlated ? '🛡' : ''}${h.name}</div><div class="rm-htags"><span style="color:${fac.color}">${fac.name}</span> · <span style="color:${role.color}">${role.name}</span> · 攻${h.atk}</div></div>`;
      }).join('') + `</div>`;
      body.querySelectorAll('.rm-spr').forEach((s) => {
        const sp = window.MT.sprites.createDomSprite(s.dataset.unit, 'idle', 78);
        if (sp) s.appendChild(sp);
      });
    }

    // ─── Battle Done -> Payout -> BEAT 2: Pure Indoor Tavern Shop! ───
    handleBattleDone(res) {
      const D = window.MT.V12_DATA;
      // Clear any leftover Shadow Box temp multipliers
      for (const h of this.state.roster) { h.boxMult = 1; h.heldFromPrev = false; }
      this.state.boxedHero = null;

      const bossCfg = D.getWaveBoss(res.wave, this.state.runSeed);
      const interest = Math.min(5, Math.floor(this.state.gold / 5));
      let baseGold = 0, speedBonus = 0;

      if (res.win) { baseGold = bossCfg.reward; speedBonus = res.handsSaved * 2; }
      else {
        this.state.hearts = Math.max(0, this.state.hearts - 1);
        baseGold = Math.max(3, Math.round(bossCfg.reward * Math.max(0.45, res.bossDamagePct)));
      }
      const totalEarned = baseGold + speedBonus + interest + (res.combatGold || 0);
      this.state.gold += totalEarned;

      const modal = document.getElementById('payout-modal');
      const title = document.getElementById('po-title');
      const sub = document.getElementById('po-sub');
      const rows = document.getElementById('po-rows');
      const btn = document.getElementById('po-next-btn');

      const gameOver = !res.win && this.state.hearts <= 0;
      const victory = res.win && res.wave === 8 && !this.state.endless;

      if (gameOver) {
        title.textContent = `止步第 ${res.wave} 波 · 酒馆打烊`;
        title.className = 'po-title lose';
        sub.textContent = `${res.reason === 'squad_wiped' ? '小队阵亡' : '4回合耗尽'} · 最高一击 ${res.peakHit.toLocaleString()}`;
        btn.textContent = '重新挑选酒馆牌组';
        btn.onclick = () => { modal.classList.add('hidden'); this.showStarterDeckSelect(); };
      } else if (victory) {
        title.textContent = '★ 8波通关 · 镜湖传奇! ★';
        title.className = 'po-title win';
        sub.textContent = `最高牌型【${res.handName} ×${res.handMult}】· 最高单击 ${res.peakHit.toLocaleString()}`;
        btn.textContent = '进酒馆开包 · 继续无尽 →';
        btn.onclick = () => { modal.classList.add('hidden'); this.state.endless = true; this.enterTavernShop(true); };
      } else {
        const loseTag = res.reason === 'squad_wiped' ? '小队被 Boss 击溃 (生命 -1❤)' : '4回合耗尽未击杀 (生命 -1❤)';
        title.textContent = res.win ? `W${res.wave} 讨伐成功!` : `W${res.wave} ${loseTag}`;
        title.className = `po-title ${res.win ? 'win' : 'lose'}`;
        sub.textContent = `最佳牌型 ${res.handName} ×${res.handMult} · 最高一击 ${res.peakHit.toLocaleString()} · 秘宝连锁 ${res.totalTriggers} 次`;
        btn.textContent = '推门进酒馆 · 开包构筑 →';
        btn.onclick = () => { modal.classList.add('hidden'); this.enterTavernShop(res.win); };
      }

      rows.innerHTML = `
        <div class="po-row"><span>${res.win ? '悬赏基础赏金' : '战损保底补贴'}</span><b>+${baseGold}G</b></div>
        ${speedBonus > 0 ? `<div class="po-row"><span>余合速通赏金 (剩${res.handsSaved}回 ×2G)</span><b>+${speedBonus}G</b></div>` : ''}
        <div class="po-row"><span>酒馆存款利息 (每5G+1)</span><b>+${interest}G</b></div>
        ${res.combatGold > 0 ? `<div class="po-row"><span>秘宝战中吸金</span><b>+${res.combatGold}G</b></div>` : ''}
        <div class="po-row total"><span>本波实得金币</span><b>+${totalEarned}G</b></div>
      `;
      modal.classList.remove('hidden');
    }

    // ─── BEAT 2: Pure Indoor Midnight Tavern Shop ───
    enterTavernShop(didWin) {
      if (didWin) this.state.wave++;
      this.state.view = 'shop';
      this.state.rerollCost = 3;
      this.swapSlotIdx = -1;
      this.rollShopInventory();

      document.getElementById('battle-view').classList.add('hidden');
      document.getElementById('tavern-view').classList.remove('hidden');

      this.syncTavernHeroes();
      this.renderShopAll();
    }

    syncTavernHeroes() {
      const D = window.MT.V12_DATA;
      const mercs = this.state.roster.map((h) => {
        const fac = D.FACTIONS[h.faction] || { name: '', short: '', color: '#ffd966' };
        const role = D.ROLES[h.role] || { name: '', short: '', color: '#d6c3a5' };
        return {
          id: h.uid,
          unitId: h.unitId,
          name: h.name,
          power: h.atk,
          effectivePower: h.atk,
          tier: 'A',
          factionName: fac.name,
          factionColor: fac.color,
          factionTag: fac.short,
          roleName: role.name,
          roleColor: role.color,
          roleTag: role.short,
          redSeal: Boolean(h.redSeal),
          ironPlated: Boolean(h.ironPlated)
        };
      });
      this.tavern.syncMercenaries(mercs, new Set());
    }

    rollShopInventory() {
      const D = window.MT.V12_DATA;
      const ownedIds = new Set(this.state.relics.map((r) => r.tplId));
      const pool = D.RELICS.filter((r) => !ownedIds.has(r.id));
      const shuffled = [...pool].sort(() => Math.random() - 0.5);

      const shopRelics = shuffled.slice(0, 3).map((tpl, idx) => {
        const edition = D.rollEdition(false), ed = D.EDITIONS[edition];
        return { shopId: `sr_${Date.now()}_${idx}`, tplId: tpl.id, tpl, edition, cost: tpl.cost + ed.priceAdd, sold: false };
      });
      const packOrder = [...D.PACKS].sort(() => Math.random() - 0.5).slice(0, 2);
      const shopPacks = packOrder.map((p, idx) => ({ shopId: `sp_${Date.now()}_${idx}`, packId: p.id, tpl: p, cost: p.cost, sold: false }));
      const tomeHand = D.HAND_TYPES[Math.floor(Math.random() * 5)];
      const shopTome = { shopId: `st_${Date.now()}`, handId: tomeHand.id, hand: tomeHand, cost: 4, sold: false };
      this.state.shop = { relics: shopRelics, packs: shopPacks, tome: shopTome };
    }

    rerollShop() {
      if (this.state.view !== 'shop') return;
      if (this.state.gold < this.state.rerollCost) { this.toast('金币不足！'); return; }
      this.state.gold -= this.state.rerollCost;
      this.state.rerollCost = Math.min(7, this.state.rerollCost + 1);
      this.rollShopInventory();
      if (window.MT.sfx) window.MT.sfx.playChainDing(2, false);
      this.renderShopAll();
    }

    buyShopRelic(shopId) {
      const item = this.state.shop.relics.find((r) => r.shopId === shopId);
      if (!item || item.sold) return;
      if (this.state.gold < item.cost) { this.toast('金币不足！'); return; }
      if (item.edition !== 'negative' && this.state.relics.length >= this.getMaxRelicSlots()) { this.toast('秘宝栏已满！点击顶部秘宝可出售'); return; }
      this.state.gold -= item.cost;
      item.sold = true;
      this.state.relics.push({ uid: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), tplId: item.tplId, tpl: item.tpl, edition: item.edition });
      if (window.MT.sfx) window.MT.sfx.playChainDing(4, item.edition === 'polychrome' || item.tpl.cat === 'mult');
      this.renderShopAll();
      this.toast(`装备【${item.tpl.name}】！点击顶部两个秘宝可左右换序`);
    }

    buyPlanetTome() {
      const t = this.state.shop && this.state.shop.tome;
      if (!t || t.sold) return;
      if (this.state.gold < t.cost) { this.toast('金币不足！'); return; }
      this.state.gold -= t.cost;
      t.sold = true;
      this.state.handLevels[t.handId] = (this.state.handLevels[t.handId] || 1) + 1;
      if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
      this.tavern.shake(7, 0.22);
      this.renderShopAll();
      this.toast(`【${t.hand.name}】升至 Lv.${this.state.handLevels[t.handId]}（永久增倍）!`);
    }

    buyBoosterPack(shopId) {
      const p = this.state.shop.packs.find((x) => x.shopId === shopId);
      if (!p || p.sold) return;
      if (this.state.gold < p.cost) { this.toast('金币不足！'); return; }
      this.state.gold -= p.cost;
      p.sold = true;
      this.renderShopAll();
      this.openPackCeremony(p.tpl);
    }

    // ─── SHOWSTOPPER: Booster Pack Opening Ceremony ───
    clearPackTimers() { for (const id of this.packTimers) clearTimeout(id); this.packTimers = []; }

    generatePackChoices(packTpl) {
      const D = window.MT.V12_DATA;
      if (packTpl.id === 'pack_relic') {
        const owned = new Set(this.state.relics.map((r) => r.tplId));
        return [...D.RELICS.filter((r) => !owned.has(r.id))].sort(() => Math.random() - 0.5).slice(0, 4)
          .map((tpl, i) => ({ kind: 'relic', idx: i, tpl, edition: D.rollEdition(true) }));
      }
      if (packTpl.id === 'pack_hero') {
        return [...D.HEROES].sort(() => Math.random() - 0.5).slice(0, 4).map((tpl, i) => {
          const r = Math.random();
          const redSeal = r < 0.28;
          const ironPlated = !redSeal && r < 0.56;
          const bonusAtk = (!redSeal && !ironPlated) || Math.random() < 0.4 ? 14 : 0;
          return { kind: 'hero', idx: i, tpl, redSeal, ironPlated, bonusAtk };
        });
      }
      return [...D.ALCHEMY_CARDS].sort(() => Math.random() - 0.5).slice(0, 3).map((tpl, i) => ({ kind: 'alchemy', idx: i, tpl }));
    }

    openPackCeremony(packTpl) {
      this.dismissToast();
      this.clearPackTimers();
      this.activePack = { tpl: packTpl, choices: this.generatePackChoices(packTpl), stage: 'charge' };
      const modal = document.getElementById('pack-ceremony-modal'), env = document.getElementById('pack-foil-envelope');
      const fallbackIcon = './assets/gear/eq_greed_dice.png';
      const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(packTpl.icon, fallbackIcon) : fallbackIcon;

      modal.classList.remove('hidden');
      document.getElementById('pack-sealed-stage').classList.remove('hidden');
      document.getElementById('pack-reveal-stage').classList.add('hidden');
      document.getElementById('pack-target-stage').classList.add('hidden');

      env.style.setProperty('--p-accent', packTpl.accent);
      env.style.setProperty('--p-glow', packTpl.glow);
      env.className = `ceremony-foil-pouch pack-theme-${packTpl.id}`;
      env.innerHTML = `
        <span class="sachet-teeth-top" aria-hidden="true"></span>
        <div class="sachet-crimp-band top" aria-hidden="true"></div>
        <div class="ceremony-pouch-body">
          ${packFoilArtSvg(packTpl.id)}
          <div class="foil-volume-sheen" aria-hidden="true"></div>
          <div class="foil-shimmer" aria-hidden="true"></div>
          <div class="ceremony-tear-seam" aria-hidden="true"></div>
          <div class="foil-emblem-crest">
            <img src="${iconUrl}" alt="${packTpl.name}" onerror="this.onerror=null;this.src='${fallbackIcon}'" />
          </div>
          <div class="foil-title-banner">
            <div class="foil-title">${packTpl.name}</div>
            <div class="foil-sub">${packTpl.subtitle}</div>
          </div>
          <div class="foil-tap-hint">点击撕开封印</div>
        </div>
        <div class="sachet-crimp-band bot" aria-hidden="true"></div>
        <span class="sachet-teeth-bot" aria-hidden="true"></span>`;
      document.getElementById('pack-ceremony-title').textContent = `${packTpl.name} · ${packTpl.subtitle}`;
      document.getElementById('pack-ceremony-sub').textContent = packTpl.desc;

      this.packFx.start(packTpl.accent, packTpl.glow);
      if (window.MT.sfx) {
        window.MT.sfx.playChainDing(1, false);
        this.packTimers.push(setTimeout(() => window.MT.sfx && window.MT.sfx.playChainDing(3, false), 220));
        this.packTimers.push(setTimeout(() => window.MT.sfx && window.MT.sfx.playChainDing(5, false), 440));
      }
      env.onclick = () => this.tearOpenPack();
      this.packTimers.push(setTimeout(() => this.tearOpenPack(), 760));
    }

    tearOpenPack() {
      if (!this.activePack || this.activePack.stage !== 'charge') return;
      this.clearPackTimers();
      this.activePack.stage = 'burst';
      document.getElementById('pack-foil-envelope').classList.add('tearing');
      this.packFx.triggerBurst(this.activePack.tpl.burstVfx);
      if (window.MT.sfx) window.MT.sfx.playChainDing(7, true);
      this.packTimers.push(setTimeout(() => this.showPackRevealCards(), 320));
    }

    showPackRevealCards() {
      if (!this.activePack) return;
      this.activePack.stage = 'reveal';
      document.getElementById('pack-sealed-stage').classList.add('hidden');
      document.getElementById('pack-reveal-stage').classList.remove('hidden');

      const grid = document.getElementById('pack-cards-grid'), D = window.MT.V12_DATA, choices = this.activePack.choices;
      const fallbackIcon = './assets/gear/eq_dragon_heart.png';
      grid.innerHTML = choices.map((c, idx) => {
        if (c.kind === 'relic') {
          const r = c.tpl, ed = D.EDITIONS[c.edition], iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon, fallbackIcon) : fallbackIcon;
          const gemCol = r.cat === 'mult' ? '#ff84b8' : r.cat === 'vfx' ? '#7ce8ff' : '#ffd966';
          const framePal = r.cat === 'mult' ? ['#d96b9f', '#ffc7e1', '#5e1a3a'] : r.cat === 'vfx' ? ['#56bed6', '#c2f6ff', '#194959'] : ['#d6a346', '#ffebb0', '#5e3c10'];
          const beamCol = c.edition === 'polychrome' ? '#ff7be5' : c.edition === 'foil' ? '#ffd966' : c.edition === 'negative' ? '#b088ff' : gemCol;
          return `
            <div class="pcard-wrap ed-${c.edition}" data-cidx="${idx}" data-beam="${beamCol}" data-rainbow="${c.edition === 'polychrome' ? '1' : '0'}">
              <div class="pcard-inner">
                <div class="pcard-back">${tarotBackSvg()}</div>
                <div class="pcard-front cat-${r.cat} ed-${c.edition}" style="--gem:${gemCol}">
                  ${pixelCardSceneSvg(`relic_${r.cat}`)}
                  ${pixelCardFrameSvg(framePal[0], framePal[1], framePal[2], gemCol)}
                  <div class="pcard-glare" aria-hidden="true"></div>
                  <div class="pcard-art-stage">
                    <div class="pcard-top">
                      <span class="pcard-crest-tag" style="--tag-c:${gemCol}">${r.cat === 'mult' ? '× 倍率秘宝' : r.cat === 'vfx' ? '⚡ 连锁特效' : '+ 基础增伤'}</span>
                      ${ed.badge ? `<span class="ed-pill ed-${c.edition}">${ed.badge}</span>` : ''}
                    </div>
                    <div class="pcard-relic-pedestal" aria-hidden="true"></div>
                    <img class="pcard-relic-img" src="${iconUrl}" alt="${r.name}" onerror="this.onerror=null;this.src='${fallbackIcon}'" />
                  </div>
                  <div class="pcard-nameplate">
                    <span class="pcard-rivet" aria-hidden="true"></span>
                    <div class="pcard-name">${r.name}</div>
                    <span class="pcard-rivet" aria-hidden="true"></span>
                  </div>
                  <div class="pcard-tablet">
                    <div class="pcard-stat-strip">${r.short}</div>
                    <div class="pcard-desc">${this.formatRichDesc(r.desc)}${ed.desc ? `<br><b class="ed-note">${this.formatRichDesc(ed.desc)}</b>` : ''}</div>
                    <div class="pcard-cta">收入秘宝栏</div>
                  </div>
                </div>
              </div>
            </div>`;
        }
        if (c.kind === 'hero') {
          const h = c.tpl, fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
          const rarityCls = c.redSeal ? 'hero-redseal' : c.ironPlated ? 'hero-iron' : '';
          const gemCol = c.redSeal ? '#ff5268' : c.ironPlated ? '#70e8ff' : fac.color;
          const framePal = c.redSeal
            ? ['#d94358', '#ffb3bf', '#59101c']
            : c.ironPlated
            ? ['#52bce0', '#ccf7ff', '#164559']
            : [fac.color, '#fff2c4', '#3b2412'];
          const perkBadge = c.redSeal ? `<span class="ed-pill seal-pill">◈ 红印·2连击</span>`
            : c.ironPlated ? `<span class="ed-pill iron-pill">🛡 铁甲·+15盾</span>`
            : `<span class="pcard-role-tag" style="--tag-c:${role.color}">${role.name}</span>`;
          const perkDesc = c.redSeal ? '<b class="perk-red">自带【红印】：每次出击打 2 下！</b>'
            : c.ironPlated ? '<b class="perk-iron">自带【铁甲】：出战额外 +15 蓝盾！</b>'
            : `加入战团花名册，助你凑齐【${fac.name}】同花！`;
          return `
            <div class="pcard-wrap ${c.redSeal || c.ironPlated ? 'ed-foil' : ''} ${rarityCls}" data-cidx="${idx}" data-beam="${gemCol}" data-rainbow="${c.redSeal ? '1' : '0'}">
              <div class="pcard-inner">
                <div class="pcard-back">${tarotBackSvg()}</div>
                <div class="pcard-front hero-card ${rarityCls}" style="--fcol:${fac.color};--gem:${gemCol}">
                  ${pixelCardSceneSvg(h.faction)}
                  ${pixelCardFrameSvg(framePal[0], framePal[1], framePal[2], gemCol)}
                  <div class="pcard-glare" aria-hidden="true"></div>
                  <div class="pcard-art-stage">
                    <div class="pcard-top">
                      <span class="pcard-crest-tag" style="--tag-c:${fac.color}">${fac.name}</span>
                      ${perkBadge}
                    </div>
                    <div class="pcard-plinth" aria-hidden="true"></div>
                    <div class="pcard-sprite-slot" data-unit="${h.unitId}"></div>
                  </div>
                  <div class="pcard-nameplate">
                    <span class="pcard-rivet" aria-hidden="true"></span>
                    <div class="pcard-name">${c.redSeal ? '◈ ' : ''}${c.ironPlated ? '🛡 ' : ''}${h.name}</div>
                    <span class="pcard-rivet" aria-hidden="true"></span>
                  </div>
                  <div class="pcard-tablet">
                    <div class="pcard-stat-strip">攻 ${h.atk + c.bonusAtk}${c.bonusAtk ? ` (+${c.bonusAtk})` : ''} · ${role.perkShort}</div>
                    <div class="pcard-desc">${perkDesc}</div>
                    <div class="pcard-cta">招募入战团</div>
                  </div>
                </div>
              </div>
            </div>`;
        }
        const al = c.tpl, iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(al.icon, fallbackIcon) : fallbackIcon;
        const disabled = al.minRoster && this.state.roster.length < al.minRoster;
        return `
          <div class="pcard-wrap ${disabled ? 'disabled' : ''}" data-cidx="${idx}" data-beam="${al.color}" data-rainbow="0">
            <div class="pcard-inner">
              <div class="pcard-back">${tarotBackSvg()}</div>
              <div class="pcard-front alchemy-card" style="--acol:${al.color};--gem:${al.color}">
                ${pixelCardSceneSvg('alchemy')}
                ${pixelCardFrameSvg('#b973e8', '#f0d4ff', '#421a66', al.color)}
                <div class="pcard-glare" aria-hidden="true"></div>
                <div class="pcard-art-stage">
                  <div class="pcard-top">
                    <span class="pcard-crest-tag" style="--tag-c:${al.color}">炼金塔罗</span>
                  </div>
                  <div class="pcard-relic-pedestal alchemy" aria-hidden="true"></div>
                  <img class="pcard-relic-img" src="${iconUrl}" alt="${al.name}" onerror="this.onerror=null;this.src='${fallbackIcon}'" />
                </div>
                <div class="pcard-nameplate">
                  <span class="pcard-rivet" aria-hidden="true"></span>
                  <div class="pcard-name">${al.name}</div>
                  <span class="pcard-rivet" aria-hidden="true"></span>
                </div>
                <div class="pcard-tablet">
                  <div class="pcard-stat-strip">即刻施法 · 永久改造</div>
                  <div class="pcard-desc">${al.desc}</div>
                  <div class="pcard-cta">${disabled ? '花名册已达3人下限' : '施展炼金秘术'}</div>
                </div>
              </div>
            </div>
          </div>`;
      }).join('');

      grid.querySelectorAll('.pcard-sprite-slot').forEach((slot) => {
        const spr = window.MT.sprites.createDomSprite(slot.dataset.unit, 'idle', 152);
        if (spr) slot.appendChild(spr);
      });

      const centerXs = choices.length === 3 ? [380, 640, 900] : [235, 505, 775, 1045];
      grid.querySelectorAll('.pcard-wrap').forEach((el, i) => {
        this.packTimers.push(setTimeout(() => {
          el.classList.add('flipped');
          const isRainbow = el.dataset.rainbow === '1';
          this.packFx.addCardRevealPillar(centerXs[i] || 640, el.dataset.beam || '#ffd966', isRainbow);
          if (window.MT.sfx) window.MT.sfx.playChainDing(2 + i, isRainbow);
        }, 120 + i * 145));

        // Tactile 3D perspective tilt + dynamic specular foil glare on hover
        el.addEventListener('mousemove', (e) => {
          if (!el.classList.contains('flipped') || el.classList.contains('disabled')) return;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          el.style.setProperty('--rx', `${((0.5 - py) * 14).toFixed(1)}deg`);
          el.style.setProperty('--ry', `${((px - 0.5) * 16).toFixed(1)}deg`);
          el.style.setProperty('--gx', `${(px * 100).toFixed(0)}%`);
          el.style.setProperty('--gy', `${(py * 100).toFixed(0)}%`);
        });
        el.addEventListener('mouseleave', () => {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        });
        el.onclick = () => {
          if (!el.classList.contains('flipped') || el.classList.contains('disabled')) return;
          this.claimPackChoice(Number(el.dataset.cidx));
        };
      });
    }

    claimPackChoice(idx) {
      if (!this.activePack) return;
      const c = this.activePack.choices[idx];
      if (!c) return;
      const D = window.MT.V12_DATA;
      if (c.kind === 'relic') {
        if (c.edition !== 'negative' && this.state.relics.length >= this.getMaxRelicSlots()) { this.toast('秘宝栏已满！可点【放弃本包 (+2G)】'); return; }
        this.state.relics.push({ uid: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), tplId: c.tpl.id, tpl: c.tpl, edition: c.edition });
        if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
        this.closePackCeremony();
        this.toast(`获得秘宝【${c.tpl.name}】!`);
        return;
      }
      if (c.kind === 'hero') {
        const inst = D.makeHeroInstance(c.tpl, { redSeal: c.redSeal, ironPlated: c.ironPlated, bonusAtk: c.bonusAtk });
        this.state.roster.push(inst);
        if (window.MT.sfx) window.MT.sfx.playChainDing(5, c.redSeal || c.ironPlated);
        this.closePackCeremony();
        this.toast(`招募【${inst.redSeal ? '◈' : ''}${inst.ironPlated ? '🛡' : ''}${inst.name}】加入花名册！`);
        return;
      }
      const al = c.tpl;
      if (!al.needsHero) {
        const gain = Math.min(18, this.state.gold);
        this.state.gold += gain;
        if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
        this.closePackCeremony();
        this.toast(`点金黑市契生效！获得 +${gain}G！`);
        return;
      }
      if (al.id === 'al_banish' && this.state.roster.length <= 3) { this.toast('花名册至少需保留 3 人！'); return; }
      this.renderAlchemyTargetPicker(al);
    }

    renderAlchemyTargetPicker(al) {
      const D = window.MT.V12_DATA;
      document.getElementById('pack-reveal-stage').classList.add('hidden');
      document.getElementById('pack-target-stage').classList.remove('hidden');
      document.getElementById('pack-target-title').textContent = `选择【${al.name}】施展目标（花名册共 ${this.state.roster.length} 人）`;
      const grid = document.getElementById('pack-target-grid');
      grid.innerHTML = this.state.roster.map((h) => {
        const fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
        return `
          <button class="target-hero-btn" data-huid="${h.uid}" style="--fcol:${fac.color}">
            <div class="th-sprite" data-unit="${h.unitId}"></div>
            <div class="th-info">
              <div class="th-name">${h.redSeal ? '◈' : ''}${h.ironPlated ? '🛡' : ''}${h.name}</div>
              <div class="th-tags"><span style="color:${fac.color}">${fac.name}</span> · <span style="color:${role.color}">${role.name}</span> · 攻${h.atk}</div>
            </div>
          </button>`;
      }).join('');
      grid.querySelectorAll('.th-sprite').forEach((s) => {
        const sp = window.MT.sprites.createDomSprite(s.dataset.unit, 'idle', 72);
        if (sp) s.appendChild(sp);
      });
      grid.querySelectorAll('.target-hero-btn').forEach((btn) => { btn.onclick = () => this.applyAlchemyToHero(al, btn.dataset.huid); });
    }

    applyAlchemyToHero(al, uid) {
      const D = window.MT.V12_DATA;
      const idx = this.state.roster.findIndex((h) => h.uid === uid);
      if (idx < 0) return;
      const hero = this.state.roster[idx];
      if (al.id === 'al_red_seal') { hero.redSeal = true; this.toast(`【${hero.name}】已烙上红印（每次出击打2下）！`); }
      else if (al.id === 'al_shift_f') {
        const counts = {};
        for (const h of this.state.roster) counts[h.faction] = (counts[h.faction] || 0) + 1;
        const topFac = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        hero.faction = topFac;
        this.toast(`【${hero.name}】已同化为【${D.FACTIONS[topFac].name}】阵营！`);
      } else if (al.id === 'al_clone') {
        this.state.roster.push({ ...hero, uid: 'h_clone_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5) });
        this.toast(`成功克隆【${hero.name}】加入花名册！`);
      } else if (al.id === 'al_banish') {
        if (this.state.roster.length <= 3) return;
        this.state.roster.splice(idx, 1);
        this.toast(`已驱逐【${hero.name}】，牌库更精纯了！`);
      } else if (al.id === 'al_forge') {
        hero.atk += 28;
        this.toast(`【${hero.name}】淬体成功，攻击 +28！`);
      }
      if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
      this.closePackCeremony();
    }

    abandonActivePack() {
      if (!this.activePack) return;
      this.state.gold += 2;
      if (window.MT.sfx) window.MT.sfx.playChainDing(1, false);
      this.closePackCeremony();
      this.toast('已放弃本包，获得拆封回收 +2G');
    }

    closePackCeremony() {
      this.clearPackTimers();
      this.activePack = null;
      this.packFx.stop();
      document.getElementById('pack-ceremony-modal').classList.add('hidden');
      this.syncTavernHeroes();
      this.renderShopAll();
    }

    // ─── Shop Rendering & Top Relic Rack Reordering ───
    handleRelicSlotClick(idx) {
      if (idx >= this.state.relics.length) { this.swapSlotIdx = -1; this.renderShopAll(); return; }
      if (this.swapSlotIdx === -1) this.swapSlotIdx = idx;
      else if (this.swapSlotIdx === idx) this.swapSlotIdx = -1;
      else {
        [this.state.relics[this.swapSlotIdx], this.state.relics[idx]] = [this.state.relics[idx], this.state.relics[this.swapSlotIdx]];
        this.swapSlotIdx = -1;
        if (window.MT.sfx) window.MT.sfx.playChainDing(3, false);
        this.toast('秘宝顺序已调换（战斗按从左到右连锁触发）');
      }
      this.renderShopAll();
    }

    sellRelicAt(idx) {
      const r = this.state.relics[idx];
      if (!r) return;
      const refund = Math.max(2, Math.floor((r.tpl.cost || 4) * 0.5));
      this.state.relics.splice(idx, 1);
      this.state.gold += refund;
      this.swapSlotIdx = -1;
      if (window.MT.sfx) window.MT.sfx.playChainDing(1, false);
      this.renderShopAll();
      this.toast(`出售【${r.tpl.name}】回收 +${refund}G`);
    }

    formatRichDesc(text) {
      if (!text) return '';
      return String(text)
        .replace(/([×xX]\d+(?:\.\d+)?)/g, '<em class="num-hi mult">$1</em>')
        .replace(/(\+\d+\s*[伤攻盾G%]?)/g, '<em class="num-hi add">$1</em>');
    }

    renderShopAll() {
      const D = window.MT.V12_DATA;
      const gold = this.state.gold;
      const fallbackIcon = './assets/gear/eq_dragon_heart.png';
      const fallbackAttr = `onerror="this.onerror=null;this.src='${fallbackIcon}'"`;

      document.getElementById('hud-wave').textContent = `W${this.state.wave}${this.state.endless ? '∞' : '/8'}`;
      let heartsHtml = '';
      for (let i = 0; i < this.state.maxHearts; i++) heartsHtml += pixelHeartSvg(i < this.state.hearts);
      document.getElementById('hud-hearts').innerHTML = heartsHtml;
      document.getElementById('hud-gold').textContent = `${gold}G`;

      // 1. Unified Brass Top Relic Chain Rack
      const rack = document.getElementById('top-relic-rack');
      const maxSlots = this.getMaxRelicSlots();
      const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
      let html = `<span class="rack-dir-tag" title="战斗按从左到右顺序依次触发">连锁</span>`;
      for (let i = 0; i < maxSlots; i++) {
        if (i > 0) html += `<span class="rack-arrow" aria-hidden="true">›</span>`;
        const inst = this.state.relics[i];
        if (!inst) { html += `<div class="rack-slot empty"><span>${roman[i] || (i + 1)}</span></div>`; continue; }
        const r = inst.tpl, ed = D.EDITIONS[inst.edition] || D.EDITIONS.normal;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon, fallbackIcon) : fallbackIcon;
        const isSel = this.swapSlotIdx === i;
        html += `
          <button type="button" class="rack-slot filled cat-${r.cat} ed-${inst.edition} ${isSel ? 'swap-active' : ''}" data-ridx="${i}" aria-label="${r.name}" aria-pressed="${isSel}">
            ${ed.badge ? `<i class="ed-pip ed-${inst.edition}">${ed.badge}</i>` : ''}
            <img src="${iconUrl}" alt="${r.name}" ${fallbackAttr} />
            <span class="rack-badge">${r.short}</span>
          </button>`;
      }
      rack.innerHTML = html;
      rack.querySelectorAll('.rack-slot.filled').forEach((el) => {
        el.onclick = () => this.handleRelicSlotClick(Number(el.dataset.ridx));
      });

      // Tap-to-Inspect Equipped Relic Strip
      const inspBar = document.getElementById('relic-inspect-bar');
      if (this.swapSlotIdx >= 0 && this.state.relics[this.swapSlotIdx]) {
        const inst = this.state.relics[this.swapSlotIdx];
        const r = inst.tpl, ed = D.EDITIONS[inst.edition] || D.EDITIONS.normal;
        const refund = Math.max(2, Math.floor((r.cost || 4) * 0.5));
        inspBar.classList.remove('hidden');
        inspBar.innerHTML = `
          <div class="rib-info">
            <b>【${r.name}】</b>${ed.badge ? `<span class="ed-pill sm ed-${inst.edition}">${ed.badge}</span>` : ''}
            <span>${r.desc}${ed.desc ? ` · ${ed.desc}` : ''}</span>
          </div>
          <div class="rib-actions">
            <span class="rib-tip">点另一秘宝可互换顺序</span>
            <button class="steel-btn crimson rib-btn" id="btn-rib-sell">出售 +${refund}G</button>
            <button class="steel-btn tavern-btn rib-btn" id="btn-rib-cancel">取消</button>
          </div>`;
        document.getElementById('btn-rib-sell').onclick = () => this.sellRelicAt(this.swapSlotIdx);
        document.getElementById('btn-rib-cancel').onclick = () => { this.swapSlotIdx = -1; this.renderShopAll(); };
      } else {
        inspBar.classList.add('hidden');
      }

      // 2. LEFT WALNUT SIDE: Pinned Aged-Parchment Wanted Poster + Wax-Seal Battle Contract
      const nextBoss = D.getWaveBoss(this.state.wave, this.state.runSeed);
      const intentMeta = {
        heavy:  { txt: '重击', ico: './assets/icons/role_assassin.png', cls: 'it-heavy' },
        charge: { txt: '蓄力', ico: './assets/icons/el_fire.png',       cls: 'it-charge' },
        shield: { txt: '魔盾', ico: './assets/icons/role_tank.png',     cls: 'it-shield' },
        freeze: { txt: '霜锁', ico: './assets/icons/el_ice.png',        cls: 'it-freeze' }
      };
      const patternSlice = (nextBoss.pattern || ['heavy', 'charge', 'heavy', 'heavy']).slice(0, 4);
      let chargeRound = -1;
      const patternHtml = patternSlice.map((k, idx) => {
        const safeK = (k === 'charge' && idx >= 2) ? 'heavy' : k;
        if (safeK === 'charge' && chargeRound < 0) chargeRound = idx + 1;
        const info = intentMeta[safeK] || intentMeta.heavy;
        return `
          <span class="pp-step ${info.cls}">
            <i>R${idx + 1}</i>
            <img class="px-ico" src="${info.ico}" alt="${info.txt}" />
            <span>${info.txt}</span>
          </span>`;
      }).join('');

      const bossPanel = document.getElementById('boss-bounty-panel');
      bossPanel.innerHTML = `
        ${hsScrollBackdropSvg('bounty', `w${this.state.wave}`)}
        <div class="pp-scroll-content">
          <div class="pp-header">
            <span class="pp-title">W${this.state.wave} 悬赏令</span>
            <span class="pp-hp-stamp">${nextBoss.maxHp.toLocaleString()} HP</span>
          </div>
          <div class="pp-arch-stage">
            <div class="pp-arch-backdrop">
              <div class="pp-plinth" aria-hidden="true"></div>
            </div>
            ${hsArchFrameSvg('#e04658', `boss${this.state.wave}`)}
            <div class="pp-boss-sprite" data-unit="${nextBoss.unitId}"></div>
            <div class="pp-name-ribbon">
              <b>${nextBoss.name}</b>
              <span>${nextBoss.title}</span>
            </div>
          </div>
          <div class="pp-pattern-row">${patternHtml}</div>
          <div class="pp-break-note">
            <span class="pp-break-main">${chargeRound > 0 ? `R${chargeRound}破招` : '蓄力破招'} ≥ <b>${nextBoss.breakThreshold}</b> · 灭世 <b>${nextBoss.ultDmg}</b>伤</span>
          </div>
        </div>
      `;
      const bossSlot = bossPanel.querySelector('.pp-boss-sprite');
      const bossSpr = window.MT.sprites.createDomSprite(nextBoss.unitId, 'idle', 156);
      if (bossSpr && bossSlot) bossSlot.appendChild(bossSpr);

      // Attached Crimson Swallowtail Ribbon + Oversized Melted Wax-Seal Battle CTA
      const nextBtn = document.getElementById('btn-shop-next');
      nextBtn.innerHTML = `
        <span class="wax-seal-holder" aria-hidden="true">${hsWaxSealSvg('战')}</span>
        <span class="wax-cta-copy">
          <span class="wax-cta-main">迎战 W${this.state.wave} · ${nextBoss.name}</span>
        </span>
        <span class="wax-cta-arrow" aria-hidden="true">→</span>
      `;

      // 3. LOWER-LEFT OPEN WALNUT PROMENADE: Slim Single-Bar Squad Ledger + Free-Roaming Squad Canvas Floor
      const facCounts = {};
      for (const h of this.state.roster) {
        facCounts[h.faction] = (facCounts[h.faction] || 0) + 1;
      }
      const totalN = Math.max(1, this.state.roster.length);
      const sortedFacs = Object.entries(facCounts).sort((a, b) => b[1] - a[1]);
      const segBarHtml = sortedFacs.map(([fid, cnt]) => {
        const f = D.FACTIONS[fid];
        const pct = Math.max(8, (cnt / totalN) * 100);
        return `<i style="width:${pct}%;background:${f.color}" title="${f.name} ${cnt}人"></i>`;
      }).join('');
      const facInlineHtml = sortedFacs.slice(0, 3).map(([fid, cnt]) => {
        const f = D.FACTIONS[fid];
        return `<span class="sp-fac-txt" style="color:${f.color}">${f.name}<b>${cnt}</b></span>`;
      }).join('');

      const ledgerStrip = document.getElementById('squad-ledger-strip');
      if (ledgerStrip) {
        ledgerStrip.innerHTML = `
          <div class="sp-top-row">
            <span class="sp-title">战团 <b>${this.state.roster.length}</b>人</span>
            <div class="sp-fac-inline">${facInlineHtml}</div>
            <span class="sp-more">全表 ›</span>
          </div>
          <div class="sp-ratio-bar">${segBarHtml}</div>
        `;
      }

      const deckPanel = document.getElementById('deck-overview-panel');
      deckPanel.onclick = () => this.openRosterModal('roster');
      deckPanel.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openRosterModal('roster'); }
      };

      // Interactive pointer hover over roaming squad heroes on the bare walnut promenade
      const roamZone = document.getElementById('squad-roam-zone');
      const hoverTip = document.getElementById('squad-hover-tip');
      if (roamZone && hoverTip && !roamZone._boundHover) {
        roamZone._boundHover = true;
        roamZone.addEventListener('mousemove', (e) => {
          const rect = this.stageEl.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const sx = ((e.clientX - rect.left) / rect.width) * 1280;
          const sy = ((e.clientY - rect.top) / rect.height) * 720;
          const hit = this.tavern.pickHeroAt(sx, sy);
          if (hit) {
            this.tavern.setHoveredHero(hit.uid);
            const zRect = roamZone.getBoundingClientRect();
            const localX = ((e.clientX - zRect.left) / zRect.width) * roamZone.offsetWidth;
            const localY = ((e.clientY - zRect.top) / zRect.height) * roamZone.offsetHeight;
            hoverTip.innerHTML = `
              <b>${hit.redSeal ? '◈' : ''}${hit.ironPlated ? '🛡' : ''}${hit.name}</b>
              <span><em style="color:${hit.factionColor}">${hit.factionName}</em> · ${hit.roleName} · 攻 ${hit.atk}</span>
            `;
            hoverTip.style.left = `${Math.max(66, Math.min(roamZone.offsetWidth - 66, localX))}px`;
            hoverTip.style.top = `${Math.max(4, localY - 46)}px`;
            hoverTip.classList.remove('hidden');
          } else {
            this.tavern.setHoveredHero(null);
            hoverTip.classList.add('hidden');
          }
        });
        roamZone.addEventListener('mouseleave', () => {
          this.tavern.setHoveredHero(null);
          hoverTip.classList.add('hidden');
        });
      }

      // 4. RIGHT BAIZE TABLETOP MAT: Mobile-First Tap-to-Inspect + Confirm-to-Buy Cards (NO hover dependency!)
      this.closeShopInspector();
      const sh = this.state.shop;
      if (!sh) return;
      const rerollBtn = document.getElementById('btn-shop-reroll');
      rerollBtn.innerHTML = `<span class="rr-ico">↻</span><span>刷新</span><b>${this.state.rerollCost}G</b>`;
      rerollBtn.disabled = gold < this.state.rerollCost;

      const relicsRow = document.getElementById('shop-relics-row');
      relicsRow.innerHTML = sh.relics.map((item, idx) => {
        const r = item.tpl;
        const ed = D.EDITIONS[item.edition] || D.EDITIONS.normal;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon, fallbackIcon) : fallbackIcon;
        const canBuy = gold >= item.cost;
        const catLabel = r.cat === 'mult' ? '×倍率' : r.cat === 'vfx' ? '⚡连锁' : '+增伤';
        const gemCol = r.cat === 'mult' ? '#ff84b8' : r.cat === 'vfx' ? '#7ce8ff' : '#ffd966';
        const priceLabel = item.sold ? '已购' : `${item.cost}G`;
        const noteText = ed.desc ? ed.desc : r.desc;
        return `
          <button class="relic-tarot-card tilt-${idx} cat-${r.cat} ed-${item.edition} ${item.sold ? 'sold' : ''} ${!item.sold && !canBuy ? 'cant-afford' : ''}" data-srid="${item.shopId}" style="--gem:${gemCol}" aria-haspopup="dialog" aria-expanded="false" ${item.sold ? 'disabled' : ''}>
            ${pixelShopRelicSvg(r.cat, gemCol)}
            <div class="rtc-alcove">
              <div class="rtc-top">
                <span class="rtc-cat">${catLabel}</span>
                ${ed.badge ? `<span class="ed-pill ed-${item.edition}">${ed.badge}</span>` : ''}
              </div>
              <div class="rtc-glow-ring" aria-hidden="true"></div>
              <img class="rtc-icon-img" src="${iconUrl}" alt="${r.name}" ${fallbackAttr} />
            </div>
            <div class="rtc-nameplate">
              <span class="rtc-name">${r.name}</span>
            </div>
            <div class="rtc-tablet">
              <div class="rtc-stat">${r.short}</div>
              <div class="rtc-note ${ed.desc ? 'has-ed' : ''}">${noteText}</div>
              <div class="rtc-price ${!item.sold && !canBuy ? 'poor' : ''}">${priceLabel}</div>
            </div>
          </button>`;
      }).join('');
      relicsRow.querySelectorAll('.relic-tarot-card').forEach((btn) => {
        const item = sh.relics.find((x) => x.shopId === btn.dataset.srid);
        if (!item || item.sold) return;
        const key = `relic:${item.shopId}`;
        const r = item.tpl;
        const ed = D.EDITIONS[item.edition] || D.EDITIONS.normal;
        const catTag = r.cat === 'mult' ? '× 乘区倍率' : r.cat === 'vfx' ? '⚡ 连锁特效' : '+ 基础增伤';
        const gemCol = r.cat === 'mult' ? '#ff84b8' : r.cat === 'vfx' ? '#7ce8ff' : '#ffd966';
        btn.onclick = (e) => {
          e.stopPropagation();
          if (this.inspectedShopKey === key) {
            this.closeShopInspector();
            this.buyShopRelic(item.shopId);
            return;
          }
          const slotsFull = item.edition !== 'negative' && this.state.relics.length >= this.getMaxRelicSlots();
          const canAfford = this.state.gold >= item.cost;
          let btnLabel = `确认购入 · ${item.cost}G`;
          let disabled = false;
          if (!canAfford) { btnLabel = `金币不足 · 需 ${item.cost}G`; disabled = true; }
          else if (slotsFull) { btnLabel = '秘宝栏已满 · 先卸除'; disabled = true; }
          this.inspectShopItem(key, btn, {
            title: r.name,
            stat: r.short,
            badge: catTag,
            badgeColor: gemCol,
            edBadge: ed.badge ? `<span class="ed-pill ed-${item.edition}">${ed.badge}</span>` : '',
            descHtml: this.formatRichDesc(r.desc),
            edHtml: ed.desc ? this.formatRichDesc(ed.desc) : '',
            foot: '摆放提示：+伤秘宝居左 → ×倍秘宝居右',
            confirmLabel: btnLabel,
            confirmTheme: 'gold',
            confirmDisabled: disabled,
            onConfirm: () => this.buyShopRelic(item.shopId)
          });
        };
      });

      const packTag = {
        pack_relic:   '4选1',
        pack_hero:    '4选1',
        pack_alchemy: '3选1'
      };
      const packPitch = {
        pack_relic:   '稀有秘宝 · 概率闪金',
        pack_hero:    '传奇侠客 · 概率红印',
        pack_alchemy: '烙印 · 同化 · 淬体'
      };
      const packDetailDesc = {
        pack_relic:   '撕开即享全屏抽卡仪式，从 4 件稀有星界秘宝中任选 1 件，高概率开出闪金、多彩或负片版本。',
        pack_hero:    '从 4 名高阶侠客中招募 1 名入团，概率自带【红印·2连击】或【铁甲·+15盾】强力词条。',
        pack_alchemy: '从 3 张炼金塔罗中择 1 张施法：为侠客刻印红印/铁甲、同化阵营或永久淬炼攻击力。'
      };
      const packsRow = document.getElementById('shop-packs-row');
      const packsHtml = sh.packs.map((p, idx) => {
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(p.tpl.icon, './assets/gear/eq_greed_dice.png') : './assets/gear/eq_greed_dice.png';
        const canBuy = gold >= p.cost;
        const tag = packTag[p.tpl.id] || '4选1';
        const pitch = packPitch[p.tpl.id] || p.tpl.desc;
        const priceLabel = p.sold ? '已拆' : `${p.cost}G`;
        return `
          <button class="foil-sachet-card pack-theme-${p.tpl.id} sachet-${idx} ${p.sold ? 'sold' : ''} ${!p.sold && !canBuy ? 'cant-afford' : ''}" data-spid="${p.shopId}" style="--pcol:${p.tpl.accent};--pglow:${p.tpl.glow}" aria-haspopup="dialog" aria-expanded="false" ${p.sold ? 'disabled' : ''}>
            <span class="sachet-teeth-top" aria-hidden="true"></span>
            <div class="sachet-crimp-band top" aria-hidden="true"></div>
            <div class="sachet-body">
              ${packFoilArtSvg(p.tpl.id)}
              <div class="foil-volume-sheen" aria-hidden="true"></div>
              <div class="pack-pulse-bg" aria-hidden="true"></div>
              <div class="pack-foil-streak" aria-hidden="true"></div>
              <span class="sachet-tear-notch" aria-hidden="true"></span>
              <div class="sachet-sub">${tag}</div>
              <div class="sachet-medallion">
                <img src="${iconUrl}" alt="${p.tpl.name}" ${fallbackAttr} />
              </div>
              <div class="sachet-copy">
                <div class="sachet-name">${p.tpl.name}</div>
                <div class="sachet-desc">${pitch}</div>
              </div>
              <div class="sachet-price ${!p.sold && !canBuy ? 'poor' : ''}">${priceLabel}</div>
            </div>
            <div class="sachet-crimp-band bot" aria-hidden="true"></div>
            <span class="sachet-teeth-bot" aria-hidden="true"></span>
          </button>`;
      }).join('');

      const t = sh.tome;
      const tIcon = window.MT.vfx ? window.MT.vfx.getIconUrl(t.hand.icon, './assets/gear/eq_storm_staff.png') : './assets/gear/eq_storm_staff.png';
      const curLv = this.state.handLevels[t.handId] || 1;
      const curM = +(t.hand.baseMult + (curLv - 1) * t.hand.multPerLv).toFixed(2);
      const nextM = +(t.hand.baseMult + curLv * t.hand.multPerLv).toFixed(2);
      const canBuyTome = gold >= t.cost;
      const tomePriceLabel = t.sold ? '已研读' : `${t.cost}G`;
      const tomeHtml = `
        <button class="grimoire-book-card ${t.sold ? 'sold' : ''} ${!t.sold && !canBuyTome ? 'cant-afford' : ''}" id="btn-buy-tome" aria-haspopup="dialog" aria-expanded="false" ${t.sold ? 'disabled' : ''}>
          <span class="gb-bookmark" aria-hidden="true">Lv.${curLv}→${curLv + 1}</span>
          <span class="gb-pages-right" aria-hidden="true"></span>
          <span class="gb-pages-bottom" aria-hidden="true"></span>
          <span class="gb-metal-clasp" aria-hidden="true"></span>
          <div class="gb-cover">
            <div class="gb-spine" aria-hidden="true">
              <i></i><i></i><i></i><i></i>
            </div>
            <div class="gb-face">
              <span class="gb-brass-corner tl" aria-hidden="true"></span>
              <span class="gb-brass-corner tr" aria-hidden="true"></span>
              <span class="gb-brass-corner bl" aria-hidden="true"></span>
              <span class="gb-brass-corner br" aria-hidden="true"></span>
              <div class="gb-crest">
                <img src="${tIcon}" alt="${t.hand.name}谱" ${fallbackAttr} />
              </div>
              <div class="gb-name">${t.hand.name}谱</div>
              <div class="gb-mult">×${curM} → ×${nextM}</div>
              <div class="gb-bonus">基伤 +${t.hand.bonusPerLv}</div>
              <div class="gb-clasp ${!t.sold && !canBuyTome ? 'poor' : ''}">${tomePriceLabel}</div>
            </div>
          </div>
        </button>`;
      packsRow.innerHTML = packsHtml + tomeHtml;
      packsRow.querySelectorAll('.foil-sachet-card').forEach((btn) => {
        const p = sh.packs.find((x) => x.shopId === btn.dataset.spid);
        if (!p || p.sold) return;
        const key = `pack:${p.shopId}`;
        btn.onclick = (e) => {
          e.stopPropagation();
          if (this.inspectedShopKey === key) {
            this.closeShopInspector();
            this.buyBoosterPack(p.shopId);
            return;
          }
          const canAfford = this.state.gold >= p.cost;
          this.inspectShopItem(key, btn, {
            title: p.tpl.name,
            stat: packTag[p.tpl.id] || '4选1',
            badge: '命运卡包',
            badgeColor: p.tpl.accent || '#ffd966',
            edBadge: '',
            descHtml: this.formatRichDesc(packDetailDesc[p.tpl.id] || p.tpl.desc),
            edHtml: '',
            foot: '拆封进入全屏抽卡仪式，可放弃不拿',
            confirmLabel: canAfford ? `确认撕开 · ${p.cost}G` : `金币不足 · 需 ${p.cost}G`,
            confirmTheme: 'gold',
            confirmDisabled: !canAfford,
            onConfirm: () => this.buyBoosterPack(p.shopId)
          });
        };
      });
      const tomeBtn = document.getElementById('btn-buy-tome');
      if (tomeBtn && !t.sold) {
        const key = 'tome';
        tomeBtn.onclick = (e) => {
          e.stopPropagation();
          if (this.inspectedShopKey === key) {
            this.closeShopInspector();
            this.buyPlanetTome();
            return;
          }
          const canAfford = this.state.gold >= t.cost;
          this.inspectShopItem(key, tomeBtn, {
            title: `${t.hand.name}谱`,
            stat: `Lv.${curLv} → Lv.${curLv + 1}`,
            badge: '战技升阶',
            badgeColor: '#84ead9',
            edBadge: '',
            descHtml: this.formatRichDesc(`永久提升【${t.hand.name}】牌型倍率 ×${curM} → ×${nextM}，基础伤害 +${t.hand.bonusPerLv}。`),
            edHtml: '',
            foot: '不占用任何秘宝栏位 · 本局永久生效',
            confirmLabel: canAfford ? `确认研读 · ${t.cost}G` : `金币不足 · 需 ${t.cost}G`,
            confirmTheme: 'teal',
            confirmDisabled: !canAfford,
            onConfirm: () => this.buyPlanetTome()
          });
        };
      }
    }

    inspectShopItem(key, anchorEl, data) {
      const pop = document.getElementById('shop-detail-popover');
      if (!pop || !anchorEl || !this.stageEl) return;

      // Clear any previous selection & top relic inspect bar
      this.closeShopInspector();
      this.swapSlotIdx = -1;
      document.getElementById('relic-inspect-bar').classList.add('hidden');
      const selectedRelic = document.querySelector('#top-relic-rack .swap-active');
      if (selectedRelic) {
        selectedRelic.classList.remove('swap-active');
        selectedRelic.setAttribute('aria-pressed', 'false');
      }

      this.inspectedShopKey = key;
      this.shopAnchor = anchorEl;
      anchorEl.classList.add('is-inspected');
      anchorEl.setAttribute('aria-expanded', 'true');
      if (window.MT.sfx) window.MT.sfx.playChainDing(1, false);

      pop.innerHTML = `
        <div class="sdp-head">
          <div class="sdp-title-group">
            <span class="sdp-title">${data.title}</span>
            <span class="sdp-stat">${data.stat}</span>
          </div>
        </div>
        <div class="sdp-tags">
          <span class="sdp-badge" style="--bc:${data.badgeColor || '#ffd966'}">${data.badge}</span>
          ${data.edBadge || ''}
        </div>
        <div class="sdp-desc">${data.descHtml}</div>
        ${data.edHtml ? `<div class="sdp-ed">${data.edHtml}</div>` : ''}
        ${data.foot ? `<div class="sdp-foot">${data.foot}</div>` : ''}
        <div class="sdp-actions">
          <button type="button" class="sdp-confirm-btn ${data.confirmTheme || 'gold'}" ${data.confirmDisabled ? 'disabled' : ''}>${data.confirmLabel}</button>
          <button type="button" class="sdp-cancel-btn">取消</button>
        </div>
      `;
      pop.classList.remove('hidden');

      pop.onclick = (e) => e.stopPropagation();
      const cancelBtn = pop.querySelector('.sdp-cancel-btn');
      const confirmBtn = pop.querySelector('.sdp-confirm-btn');
      cancelBtn.onclick = () => this.closeShopInspector(true);
      if (confirmBtn) {
        confirmBtn.onclick = (e) => {
          e.stopPropagation();
          if (data.confirmDisabled) return;
          this.closeShopInspector();
          if (typeof data.onConfirm === 'function') data.onConfirm();
        };
      }

      this.positionShopInspector(pop, anchorEl);
      if (anchorEl.matches(':focus-visible')) (confirmBtn.disabled ? cancelBtn : confirmBtn).focus({ preventScroll: true });
    }

    positionShopInspector(pop, anchorEl) {
      const sRect = this.stageEl.getBoundingClientRect();
      const aRect = anchorEl.getBoundingClientRect();
      if (!sRect.width || !sRect.height) return;
      const stageWidth = this.stageEl.offsetWidth;
      const stageHeight = this.stageEl.offsetHeight;
      const scaleX = stageWidth / sRect.width;
      const scaleY = stageHeight / sRect.height;
      const ax = (aRect.left - sRect.left) * scaleX;
      const ay = (aRect.top - sRect.top) * scaleY;
      const aw = aRect.width * scaleX;
      const ah = aRect.height * scaleY;
      const popW = pop.offsetWidth;
      const popH = pop.offsetHeight;

      // Leave the selected card visible and keep the actions within the table.
      const edge = 18;
      let left = ax + aw + 14;
      if (left + popW > stageWidth - edge) left = ax - popW - 14;
      left = Math.max(edge, Math.min(stageWidth - edge - popW, left));
      const hudHeight = document.getElementById('top-hud').offsetHeight;
      const top = Math.max(hudHeight + 8, Math.min(stageHeight - edge - popH, ay + (ah - popH) * 0.5));
      pop.style.left = `${Math.round(left)}px`;
      pop.style.top = `${Math.round(top)}px`;
    }

    closeShopInspector(restoreFocus = false) {
      this.inspectedShopKey = null;
      const pop = document.getElementById('shop-detail-popover');
      if (pop) pop.classList.add('hidden');
      if (this.shopAnchor) {
        this.shopAnchor.classList.remove('is-inspected');
        this.shopAnchor.setAttribute('aria-expanded', 'false');
        if (restoreFocus) this.shopAnchor.focus({ preventScroll: true });
        this.shopAnchor = null;
      }
    }

    showRosterDialog(view) {
      const modal = document.getElementById('roster-modal');
      const opening = modal.classList.contains('hidden');
      if (opening) {
        this.rosterOpener = document.activeElement;
        this.dismissToast();
      }
      modal.dataset.view = view;
      modal.classList.remove('hidden');
      const rosterTabBtn = document.getElementById('rm-tab-roster');
      const handsTabBtn = document.getElementById('rm-tab-hands');
      rosterTabBtn.classList.toggle('hidden', !Array.isArray(this.state?.roster));
      for (const [button, name] of [[rosterTabBtn, 'roster'], [handsTabBtn, 'hands']]) {
        button.classList.toggle('active', name === view);
        button.setAttribute('aria-pressed', String(name === view));
      }
      if (opening) document.getElementById('rm-close-btn').focus({ preventScroll: true });
    }

    closeRosterDialog(restoreFocus = true) {
      document.getElementById('roster-modal').classList.add('hidden');
      if (restoreFocus) this.rosterOpener?.focus({ preventScroll: true });
      this.rosterOpener = null;
    }

    openRosterModal(tab = 'roster') {
      const D = window.MT.V12_DATA;
      const hasRun = Array.isArray(this.state?.roster);
      const activeTab = !hasRun ? 'hands' : tab;
      this.showRosterDialog(activeTab);

      const summaryEl = document.getElementById('rm-summary');
      if (hasRun && activeTab === 'roster') {
        const counts = {};
        for (const h of this.state.roster) counts[h.faction] = (counts[h.faction] || 0) + 1;
        summaryEl.innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1])
          .map(([fid, c]) => `<span class="rm-fac-pill" style="background:${D.FACTIONS[fid].bg};color:${D.FACTIONS[fid].color}">${D.FACTIONS[fid].name} ×${c}</span>`).join('');
      } else {
        summaryEl.innerHTML = '<span class="rm-guide-note">按书页顺序，结算首个符合的牌型</span>';
      }

      const body = document.getElementById('rm-body');
      if (activeTab === 'hands') {
        const levels = (this.state && this.state.handLevels) || {};
        const conditions = {
          royal_triangle: '同阵营，且盾、刃、法各一张', three_kind: '三张同名', flush: '三张同阵营',
          triangle: '盾、刃、法各一张', pair: '两张同名', high_card: '任意三张'
        };
        const entries = D.HAND_TYPES.map((ht) => {
          const lv = levels[ht.id] || 1;
          const mult = +(ht.baseMult + (lv - 1) * ht.multPerLv).toFixed(2);
          const bonus = ht.baseBonus + (lv - 1) * ht.bonusPerLv;
          const icon = window.MT.vfx?.getIconUrl(ht.icon, './assets/gear/eq_storm_staff.png');
          const effect = ht.factionBlast ? '阵营合体技' : ht.fusion ? '融合为三星战神' : ht.twinSlash ? '双子连斩 +15% 伤' : '';
          const perks = [effect, ht.shieldBonus ? `+${ht.shieldBonus} 盾` : ''].filter(Boolean).join(' · ');
          return `<article class="rm-hand-row">
            <span class="rm-hand-icon" style="--hand-color:${ht.color}">${icon ? `<img src="${icon}" alt="" />` : ''}</span>
            <div class="rm-hand-info">
              <div class="rm-hand-name"><b>${ht.name}</b><span class="rm-lv">Lv.${lv}</span></div>
              <p class="rm-condition">${conditions[ht.id]}</p>
              ${perks ? `<p class="rm-perk">${perks}</p>` : ''}
            </div>
            <div class="rm-hand-values"><b class="rm-mult">×${mult}</b><span class="rm-bonus">+${bonus} 伤</span></div>
          </article>`;
        });
        const split = Math.ceil(entries.length / 2);
        body.innerHTML = `<div class="rm-hands-list"><div class="rm-hand-page">${entries.slice(0, split).join('')}</div><div class="rm-hand-page">${entries.slice(split).join('')}</div></div>`;
      } else {
        body.innerHTML = `<div class="rm-roster-grid">` + this.state.roster.map((h) => {
          const fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
          return `<div class="rm-hero-tile" style="--fcol:${fac.color}"><div class="rm-spr" data-unit="${h.unitId}"></div><div class="rm-hname">${h.redSeal ? '◈' : ''}${h.ironPlated ? '🛡' : ''}${h.name}</div><div class="rm-htags"><span style="color:${fac.color}">${fac.name}</span> · <span style="color:${role.color}">${role.name}</span> · 攻${h.atk}</div></div>`;
        }).join('') + `</div>`;
        body.querySelectorAll('.rm-spr').forEach((s) => {
          const sp = window.MT.sprites.createDomSprite(s.dataset.unit, 'idle', 78);
          if (sp) s.appendChild(sp);
        });
      }
    }

    closeAllModals() {
      document.getElementById('deck-select-modal').classList.add('hidden');
      document.getElementById('payout-modal').classList.add('hidden');
      this.closeRosterDialog(false);
      document.getElementById('pack-ceremony-modal').classList.add('hidden');
    }

    toast(msg) {
      const el = document.getElementById('toast-banner');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._toastId);
      this._toastId = setTimeout(() => el.classList.remove('show'), 2300);
    }

    dismissToast() {
      clearTimeout(this._toastId);
      const banner = document.getElementById('toast-banner');
      banner.classList.remove('show');
      banner.textContent = '';
    }

    bindGlobalEvents() {
      // Title Screen & Warband Contracts navigation
      const enterBtn = document.getElementById('btn-title-enter');
      if (enterBtn) enterBtn.onclick = () => this.enterDeckSelectFromTitle();
      const titleHandsBtn = document.getElementById('btn-title-hands');
      if (titleHandsBtn) titleHandsBtn.onclick = () => this.openRosterModal('hands');
      const titleMuteBtn = document.getElementById('btn-title-mute');
      if (titleMuteBtn) titleMuteBtn.onclick = () => this.toggleMute();

      const cBackBtn = document.getElementById('btn-contracts-back');
      if (cBackBtn) cBackBtn.onclick = () => this.showTitleScreen();
      const cHandsBtn = document.getElementById('btn-contracts-hands');
      if (cHandsBtn) cHandsBtn.onclick = () => this.openRosterModal('hands');
      const cMuteBtn = document.getElementById('btn-contracts-mute');
      if (cMuteBtn) cMuteBtn.onclick = () => this.toggleMute();

      document.getElementById('btn-bt-discard').onclick = () => this.discardAndRedrawBattle();
      document.getElementById('btn-bt-strike').onclick = () => this.strikeWithSelectedHand();
      document.getElementById('btn-shadow-box').onclick = () => this.handleShadowBoxClick();
      document.getElementById('btn-draw-pile').onclick = () => this.openPileModal('draw');
      document.getElementById('btn-discard-pile').onclick = () => this.openPileModal('discard');
      document.getElementById('btn-bt-hands').onclick = () => this.openRosterModal('hands');
      document.getElementById('btn-bt-roster').onclick = () => this.openRosterModal('roster');

      document.getElementById('btn-shop-reroll').onclick = () => { this.closeShopInspector(); this.rerollShop(); };
      document.getElementById('btn-shop-next').onclick = () => { this.closeShopInspector(); this.enterBattleWave(); };

      // Dismiss mobile tap-to-inspect popover when tapping anywhere outside cards/popover or pressing Escape
      const tavernView = document.getElementById('tavern-view');
      if (tavernView) {
        tavernView.addEventListener('click', (e) => {
          if (!this.inspectedShopKey) return;
          if (e.target.closest('#shop-detail-popover, .relic-tarot-card, .foil-sachet-card, .grimoire-book-card')) return;
          this.closeShopInspector();
        });
      }
      window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!document.getElementById('roster-modal').classList.contains('hidden')) this.closeRosterDialog();
        else if (this.inspectedShopKey) this.closeShopInspector(true);
      });

      const rosterOpenBtn = document.getElementById('btn-roster-open');
      if (rosterOpenBtn) rosterOpenBtn.onclick = () => this.openRosterModal('roster');
      document.getElementById('btn-hands-open').onclick = () => this.openRosterModal('hands');
      document.getElementById('rm-close-btn').onclick = () => this.closeRosterDialog();
      document.getElementById('rm-tab-roster').onclick = () => this.openRosterModal('roster');
      document.getElementById('rm-tab-hands').onclick = () => this.openRosterModal('hands');
      document.getElementById('roster-modal').addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const targets = [...event.currentTarget.querySelectorAll('button:not(.hidden), [tabindex="0"]')];
        const first = targets[0];
        const last = targets.at(-1);
        if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      });

      document.getElementById('btn-pack-abandon').onclick = () => this.abandonActivePack();
      document.getElementById('btn-pack-target-back').onclick = () => {
        document.getElementById('pack-target-stage').classList.add('hidden');
        document.getElementById('pack-reveal-stage').classList.remove('hidden');
      };

      document.getElementById('btn-restart').onclick = () => this.showStarterDeckSelect();
      document.getElementById('btn-mute').onclick = () => this.toggleMute();

      const spdBtn = document.getElementById('bt-speed-btn');
      spdBtn.onclick = () => {
        const next = this.battle.speed >= 2 ? 1 : 2;
        this.battle.setSpeed(next);
        spdBtn.textContent = `${next}×`;
        spdBtn.setAttribute('aria-label', `战斗速度 ${next} 倍`);
        spdBtn.classList.toggle('fast', next >= 2);
      };
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = new V12Game();
    window.MT.game = game;
    game.init();
  });
})();
