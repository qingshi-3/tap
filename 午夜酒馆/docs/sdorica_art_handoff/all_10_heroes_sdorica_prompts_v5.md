# 《午夜酒馆》全 10 位英雄 + 6 位备用美少女《万象物语》SSR 级重设提示词总表（V5 · 彻底重设计 + 高密度细节版）

> **V5 核心升级（解决 V4 “风格像但不像同一个游戏、细节单薄”的问题）**
> 1. **彻底抛弃旧版立绘的现代礼服/短裤/夹克包袱**：不再按旧 `hero_01_char.png` 照抄造型，而是仅保留每位英雄的**机制主题 + `uiAccent` 专属配色**，像雷亚主美从零为一个统一奇幻世界观设计的 **SSR 满破立绘**。
> 2. **强制注入《万象物语》SSR 级 6 大细节密度**：
>    - **3~4 层错落服饰结构**：内搭提花束腰 + 雕花立体高领/不对称肩甲 + 金属扣件腰封/裙甲（Tassets）+ 双层异色衬里开叉礼袍/披风，绝不穿单薄一片式裙子；
>    - **高工艺头饰与编发层次**：雕花发冠/发簪/蕾丝头纱/编发麻花辫/垂坠宝石耳链，告别光秃秃直发；
>    - **巨型标志性武装/法器**：每位英雄都有与身体姿态互锁的超大件高精细道具（雕花盾、礼仪大剑、星盘法杖、天平权杖、机械长弓、圣堂提灯等）；
>    - **高密度材质与微件工艺**：做旧古金浮雕、镶嵌宝石胸针、皮质绑带与黄铜搭扣、暗纹锦缎（Damask）、镂空蕾丝边、流苏与铃铛；
>    - **戏剧化构图动态**：采用斜向俯仰透视、半跪/倚坐、侧身回眸拉弓/挥斩等 SSR 剧场姿态，杜绝呆板正面站桩；
>    - **克制种族配比**：主力 10 人保持 **7 位纯人类美少女 + 3 位高颜值轻亚人/羽翼美少女**，另配 **6 位高精细度备用美少女**。
> 3. **使用方式**：唯一画风参考图 `docs/sdorica_art_handoff/sdorica_ref_sione.jpg`（绝不传旧立绘）。每张图拼接 **【V5 通用画风前缀】 + 【角色主体提示词】 + 【V5 通用画风后缀】**，画幅 `3:4`。

---

## V5 通用画风前缀（Global Style Prefix — 每张必加）

```text
Vertical 3:4 high-detail SSR fantasy character illustration painted strictly in the exact Sdorica (Rayark) storybook gouache and matte-oil style of the reference image. Painterly soft-edge plus micro-line hybrid: completely lineless outer silhouettes where hair tips, feathers, fur, and flowing ribbons are sculpted by bold flat-brush gouache strokes dissolving into the dark backdrop; crisp ultra-fine warm-brown micro-lines appear ONLY inside upper eyelids, lips, delicate fingers, engraved armor filigree, and jewelry metalwork. ZERO black anime outlines, ZERO cel-shading, ZERO glossy plastic highlights. Museum-grade JRPG costume craft with rich multi-layered vestments, intricate antique-gold filigree, inlaid gemstones, embossed damask brocade, ornate buckles, layered braids and headpieces, and an iconic oversized fantasy weapon or relic. Exquisite Sdorica bishoujo face with luminous jewel-like eyes, warm ivory-peach matte-satin skin, dramatic directional warm rim-lighting, and subtle archival canvas grain.
```

## V5 通用画风后缀（Global Style Suffix — 每张必加）

```text
Dynamic theatrical SSR framing (three-quarter figure with dramatic diagonal or S-curve composition and generous headroom), set against Sdorica's signature dark muted warm-umber and olive-charcoal archival parchment backdrop with faint weathered geometric fresco patterns so the glowing hair, antique metals, and intricate costume silhouette pop dramatically. STRICT EXCLUSIONS: no chibi or pixel sprite in the corner, no text, no letters, no watermark, no signature, no border, no UI frame.
```

---

## 一、10 位主力英雄（彻底重设 · 7 纯人类 + 3 克制轻亚人）

### NO.01 · `hero_01` · CRIMSON BLADE（标准 · 绯红骑士剑姬）— 纯人类
- **全新人设**：赤蔷薇王国皇家女骑士（不再是无袖紧身衣，升级为完整华丽骑士礼甲）｜主色 `#b8323f`
```text
Subject: a regal aristocratic human female rose-knight caught in a dramatic three-quarter lunge-and-turn pose, bracing an oversized ornate basket-hilted rapier across the foreground while her left hand grips a crested crimson-and-ivory kite shield edge. Sdorica stylized face (Sione archetype): poised noble expression, sharp cerulean-crimson eyes, delicate chin, soft peach blush. Voluminous snow-white hair styled with intricate side-braids, loose wind-swept locks, a sculpted antique-gold rose-thorn circlet, and ruby drop earrings. Multi-layered royal knight armor: engraved matte pearl-white breastplate with an inlaid ruby chest emblem, asymmetrical feathered crimson-and-gold left pauldron, deep wine-red puffed brocade sleeves with laced gold cuffs, layered articulated steel hip tassets belted with dark embossed leather straps and brass buckles, billowing ivory-lined crimson battle mantle, black leather gauntlets, and sweeping pale silk ribbons trailing in the wind.
```

### NO.02 · `hero_02` · AEGIS MAIDEN（护盾 · 霜晶圣盾修女）— 纯人类
- **全新人设**：极北冰晶圣堂的圣盾守护圣女（彻底抛弃单薄蓝裙站桩，升级为多层哥特圣女礼装 + 巨型浮雕水晶盾 + 头纱金冠）｜主色 `#5fb6d6`
```text
Subject: a serene, majestic human frost-cathedral shield maiden in a graceful angled three-quarter kneeling-guardian pose, resting both lace-gloved hands atop a towering, intricately carved antique-silver and translucent frost-crystal kite shield planted diagonally in the foreground. Sdorica stylized face (Angelia and Sione blend): luminous ice-blue eyes, calm compassionate gaze, soft rosy blush, delicate parted lips. Cascading pearl-white hair intricately braided along the temples, crowned with a sculpted filigree silver halo-diadem, inlaid sapphire crest, and a sheer translucent ice-blue cathedral lace veil billowing behind her shoulders. Rich multi-layered ceremonial vestments: sculpted high-collar midnight-navy damask corset bodice embroidered with dense silver snowflake scrollwork, layered white-and-ice-blue petal shoulder capelet fastened by a sapphire reliquary brooch, ornate silver-plated waist belt with hanging chain-rosaries and embossed armored hip tassets, multi-tier split navy velvet skirt revealing ivory pleated underlayers, and pale frost-crystal light motes drifting around the shield.
```

### NO.03 · `hero_03` · PHANTOM DEAL（换牌+1 · 翡翠诡术魔导荷官）— 纯人类
- **全新人设**：午夜剧场的大魔术师/诡术牌姬（彻底抛弃现代运动夹克，改为华丽巴洛克奇幻魔术燕尾礼服 + 悬空魔牌星环）｜主色 `#2f8a64`
```text
Subject: a captivating, mischievous human baroque phantom card-magician girl leaning dynamically in a twisting diagonal pose, tipping her ornate velvet tricorn-beret with one hand while the other sweeps out an arcing fan of seven glowing emerald-cyan tarot cards connected by fine golden threads. Sdorica stylized face (Naya and Beyata charisma): winking luminous emerald-teal eye, playful confident smirk, warm peach cheek blush. Lush wavy mint-turquoise hair with intricate double ribbon-braids, jeweled emerald hairpins, and a tilted matte-black velvet magician hat pinned with antique-silver clockwork gears and turquoise peacock plumes. Rich multi-layered baroque costume: tailored open-shoulder charcoal-and-emerald brocade tailcoat with gold-embroidered lapels, laced ivory-and-black ruffled corset vest, ornate antique-brass pocket-watch chain draped across her waist, asymmetrical layered teal-and-black pleated hip-bustle, fingerless dark leather magician gloves with gold cufflinks, and striped sheer stockings with brass garter buckles.
```

### NO.04 · `hero_05` · LONE ECLIPSE（孤狼 · 熔焰黑豹耳浪人剑客）— 克制轻兽耳（1/3）
- **全新人设**：荒原日蚀猎手 / 黑豹耳重装浪人女剑客（彻底抛弃机车皮衣，升级为层叠战国/荒原奇幻护甲 + 雕花巨刃 + 部落金饰）｜主色 `#d0782a`
```text
Subject: a fierce, charismatic black-panther-eared kemonomimi wandering swordswoman in a dynamic low-angle prowler stance, resting a massive, battle-worn notched eclipse-katana with glowing amber-gold runes across her shoulder while her other gloved hand rests on an ornate dagger at her hip. Exquisite human bishoujo face (Naya archetype): sharp sunlit golden-amber eyes, confident wild smirk, subtle warm cheek markings, and sleek charcoal-black panther ears adorned with dangling antique-gold ear rings and crimson bead tassels (human face, no animal snout). Wild voluminous jet-black hair with braided side-locks and fiery molten-orange painterly under-tips dissolving into embers, plus a sleek dark panther tail. Rich multi-layered hunter gear: asymmetrical weathered dark-iron shoulder pauldron engraved with sun-eclipse motifs, dense plush charcoal fur mantle draped over one shoulder, layered burnt-orange damask wrap-bodice bound with embossed leather cross-straps and brass buckles, heavy crimson silk obi sash with hanging gold talisman plates, layered dark-leather armored hip tassets, and wrapped forearm bracers.
```

### NO.05 · `hero_07` · VENOM ROSE（挂毒 · 荆棘药剂大炼金师）— 纯人类
- **全新人设**：暗夜蔷薇庭院的哥特炼金公爵千金（升级为巴洛克暗黑礼裙 + 荆棘银丝提灯/蒸馏法杖 + 繁复蕾丝与药剂腰带）｜主色 `#7a4fc2`
```text
Subject: an enchanting, dangerous human gothic-alchemy noblewoman seated diagonally on a twisted dark-iron briar-rose railing, leaning slightly forward with a sly half-smile while holding up an ornate wrought-silver thorny apothecary lantern-staff containing a glowing emerald venom crystal. Sdorica stylized face (Fredrica archetype): languid half-lidded bright emerald eyes with plum-rose shadow, delicate features, soft coral blush. Opulent dark royal-purple hair styled in elaborate Victorian twin drill-curls interwoven with black lace ribbons, matte violet velvet roses, and antique silver thorn hairpins. Rich multi-layered gothic couture: sculpted deep-plum and obsidian brocade corset with dense silver filigree boning, dramatic translucent black-lace puffed choker collar, layered tattered smoky-violet tulle and damask bustle skirt with scalloped lace borders, ornate dark-leather apothecary bandolier belt holding five miniature stoppered emerald-and-amethyst glass poison vials with brass chains, and intricate sheer black-lace opera gloves.
```

### NO.06 · `hero_08` · RUNE WEAVER（铭文 · 雪狐耳星穹织梦巫女）— 克制轻兽耳（2/3）
- **全新人设**：极光神殿的白狐耳星象大祭司少女（彻底抛弃廉价偶像裙，升级为东方玄幻多层锦绣巫女礼袍 + 浮空黄金星环纺锤）｜主色 `#9b7fd4`
```text
Subject: an ethereal, lovely white-fox-eared kemonomimi celestial rune-weaver maiden captured in a floating S-curve pose, delicately spinning glowing pale-violet silk rune-threads between her fingers from an ornate antique-gold astrolabe spindle hovering beside her. Exquisite delicate human bishoujo face (Chiyuki and Angelia sweetness): expressive luminous amethyst-violet eyes, soft rosy-peach blush, gentle mysterious smile, and fluffy snow-white fox ears with pale rose inner fur and dangling gold-bell ear ornaments (human face, no animal snout). Elaborate pale-lilac and pearl-white hair styled with high twin braided loops, jeweled star-blossom hairpins, and cascading painterly hair ribbons, framed by an enormous, lush snow-white fox tail curling dramatically around her. Rich multi-layered eastern-fantasy ceremonial robes: ivory-and-lavender brocade kimono-bodice with intricate gold constellation embroidery, oversized sculpted sheer smoky-violet bell-sleeves lined with pale gold trim, ornate braided plum-and-gold obi sash with jade talisman knots and purple silk tassels, and drifting golden starlight calligraphy runes.
```

### NO.07 · `hero_09` · VAULT KEEPER（6秘宝槽 · 黄金星库大司库）— 纯人类
- **全新人设**：帝国星穹秘宝库的女大司库（升级为华丽拜占庭/沙漠星象礼袍 + 巨型星仪钥匙权杖 + 繁复层叠金链珠宝）｜主色 `#2f7fb8`
```text
Subject: a stately, breathtaking human imperial vault keeper seated regally on a carved dark-stone ledger plinth in a dramatic diagonal S-curve pose, resting one hand on a towering ornate antique-gold crescent-astrolabe key-scepter taller than her shoulder while floating sapphire-and-gold relic seals orbit softly nearby. Sdorica stylized face (Diana and Sione elegance): calm, piercing golden-amber eyes, poised knowing smile, warm satin-matte skin. Lush cascading honey-blonde hair intricately braided into a regal half-crown, adorned with a sculpted antique-gold crescent-moon diadem, delicate dangling forehead sapphire chains, and ornate filigree drop earrings. Rich multi-layered imperial vestments: deep sapphire-navy velvet ceremonial robe densely embroidered with antique-gold astrolabe and cloud damask, structured high jeweled collar inlaid with turquoise cabochons, layered golden shoulder-mantle with hanging coin-chain fringes, sculpted embossed gold waist-corset with hanging vault-keys and velvet ribbons, and a grand billowing translucent turquoise-teal silk stole sweeping around her silhouette.
```

### NO.08 · `hero_10` · ABYSS CROWN（开局S秘宝 · 暗翼绯冠深渊女皇）— 克制羽翼美少女（3/3）
- **全新人设**：裂隙王座的乌鸦暗翼女皇（升级为哥特礼甲礼袍 + 浮雕荆棘王冠 + 巨型层叠黑紫鸦羽双翼 + 破碎猩红圣杯/魔剑）｜主色 `#8e2f5a`
```text
Subject: a commanding, darkly alluring raven-winged demihuman abyss queen in a dramatic arched airborne S-curve pose, one gloved hand raising a filigree obsidian-and-ruby thorn scepter while the other gestures downward with regal disdain. Exquisite human bishoujo face (Yamitsuki archetype): sharp aristocratic beauty, half-lidded glowing magenta-crimson eyes with thick dark lashes, pale porcelain skin with subtle mauve shadows and faint pale-white geometric arcane markings along her collarbone. Flowing raven-black hair with luminous magenta-crimson under-layers and braided crown-strands, topped by an elaborate jagged antique-obsidian and ruby-encrusted gothic diadem with dangling dark crystal chains. Magnificent oversized layered raven-black and iridescent royal-violet feathered wings unfurling dramatically behind her shoulders. Rich multi-layered royal dark-fantasy attire: sculpted charcoal-velvet and crimson-brocade armored corset with silver thorn filigree, layered feathery black-violet shoulder mantle, ornate dark-silver chained waist-armor over a sweeping high-slit crimson-lined velvet train, and sheer dark opera gloves with silver claw-rings.
```

### NO.09 · `hero_04` · GILDED QUEEN（经济 · 黄金天平酒馆女伯爵）— 纯人类
- **全新人设**：午夜酒馆背后的黄金商会女伯爵（保留回头媚笑与金发皮草灵魂，但彻底升级为巴洛克华丽贵族丝绒长礼装 + 黄金命运天平权杖 + 繁复头饰珠链，告别单薄露背短裙）｜主色 `#b07a3a`
```text
Subject: an opulent, alluring human aristocratic gilded countess in a theatrical three-quarter back-turned lounging pose glancing gracefully over her shoulder with a poised, captivating smile, balancing an ornate antique-gold filigree balance-scale scepter in one gloved hand while flicking a glowing embossed gold sovereign coin into the air with the other. Sdorica stylized face (Fredrica and Sione archetype): languid half-lidded jewel-like amber-gold eyes, crisp dark upper lashes, soft rosy lower-lid flush, warm knowing smile. Lush wavy champagne-blonde hair sculpted with intricate crown-braids, a matte black velvet bow pinned with an antique-gold cameo brooch, pearl-and-gold hair chains, and warm halo rim-light. Rich multi-layered baroque evening couture: sculpted matte charcoal-black velvet corset gown densely embroidered with antique burnished-gold baroque scrollwork and inlaid amber gems, structured high lace-trimmed collar with hanging gold chains, dramatic oversized creamy-ivory plush fur stole fastened by a jeweled gold clasp, multi-tier gold-embroidered hip drapery with cascading pearl-and-coin chains, long sheer smoky-black opera gloves with gold filigree bracelets, and sweeping translucent pale-gold silk ribbons swirling around her silhouette.
```

### NO.10 · `hero_06` · ECHO DANCER（3号复读 · 绯日金铃乐舞圣姬）— 纯人类
- **全新人设**：赤阳庆典的异域乐舞圣姬（升级为繁复印度/敦煌/波斯奇幻绘本风多层舞裙 + 雕花金铃手鼓/双环刃 + 华丽额饰珠链）｜主色 `#c9577f`
```text
Subject: a radiant, breathtaking human sunlit festival dancer caught mid-twirl in a dynamic S-curve leap, raising an ornate antique-gold tambourine-chakram ribbon-ring high in one hand while glancing back with a dazzling, joyful smile. Sdorica stylized face (Angelia and Beyata radiance): luminous sunlit amber-crimson eyes, warm rosy-peach cheek blush brushwork, lively expressive brows. Voluminous wavy coral-orange hair gathered into an elaborate high braided ponytail adorned with an antique-gold sun-crest hairpiece, crimson flame-feathers, and delicate forehead pearl-and-gold chains. Rich multi-layered exotic fantasy dancer attire: intricately embroidered coral-and-gold velvet bodice fringed with dozens of tiny burnished-gold bells and ruby beads, sculpted open-shoulder gold-filigree armlets and layered bangles, ornate multi-tier crimson-and-saffron silk wrap skirt with dense gold paisley borders and contrasting ivory-gold inner lining billowing mid-spin, delicate gold ankle-and-waist coin chains, and sweeping translucent amber-gold dance ribbons trailing warm ember sparks.
```

---

## 二、6 位高精细度备用美少女池（Backup Pool — 同级 SSR 工艺密度）

### `backup_01` · 圣蔷薇重甲女骑将（纯人类 · 极致 Sione 满破级重甲）
```text
Subject: a majestic human royal paladin maiden standing in a commanding three-quarter pose, planting an intricately engraved antique-gold and ivory claymore vertically before her with both gauntleted hands resting on the jeweled crossguard. Sdorica stylized face (pure Sione archetype): cool noble beauty, piercing cerulean-blue eyes, composed soft lips, luminous matte skin. Thick cascading snow-white hair with delicate side-braids, an ornate silver-and-gold winged hair-clasp, and warm halo rim-light. Exquisite multi-layered plate armor: sculpted pearl-white engraved cuirass with an embossed golden rose-emblem and sapphire centerpiece, layered asymmetrical scalloped steel pauldrons with wine-crimson plume mantles, articulated armored hip-tassets over a pleated crimson-and-gold brocade battle skirt, embossed leather sword-belt with brass buckles, and sweeping ivory-and-crimson banners dissolving into drifting petals.
```

### `backup_02` · 绯红酒馆星象占卜女爵（纯人类 · 极致 Fredrica 满破级华服）
```text
Subject: a sultry, opulent human arcane fortune-teller duchess seated diagonally on an ornate carved velvet divan, lifting a jewel-encrusted golden wine chalice brimming with glowing amber-crimson nectar while cards and starlight dust swirl gently around her fingertips. Sdorica stylized face (Fredrica archetype): tilted head, languid half-lidded periwinkle-blue eyes with rosy lower-lid flush, parted rose-pink lips. Flowing honey-blonde wavy hair with blunt bangs, side braids interwoven with pearl strings, and a delicate antique-gold starlight hairpin. Extravagant multi-layered baroque robe: deep royal-plum and ivory velvet plunging gown covered in dense tone-on-tone antique-gold damask scrollwork, towering sculpted high velvet collar lined with turquoise gems and gold filigree, cascading sheer plum lace bell-sleeves, ornate jeweled waist-cincher with hanging tarot charms, and dark velvet thigh-high boots.
```

### `backup_03` · 晨曦圣歌白纱王女（纯人类 · 极致 Angelia 满破级礼裙）
```text
Subject: a luminous, radiant human dawn-kingdom princess reaching gracefully forward in a wind-swept foreshortened pose, cradling a glowing antique-gold sun-relic staff adorned with ivory ribbons and white lilies. Sdorica stylized face (Angelia archetype): earnest tender beauty, large sunlit olive-emerald eyes with golden lower-iris glow, soft peach blush. Flowing golden-blonde hair styled with delicate crown-braids and a sculpted antique-gold sunburst tiara inlaid with citrine gems. Rich multi-layered storybook royal gown: ivory-and-champagne silk corset heavily embellished with raised gold sunburst filigree, layered translucent petal-shaped detached sleeves with delicate pearl trim, multi-tier scalloped white-and-gold brocade overskirt parting over pleated sunlit chiffon, ornate gold scrollwork hip-armor trim, and floating golden light feathers.
```

### `backup_04` · 烟雨墨莲青纱女谋士（纯人类 · 东方玄幻满破级锦绣）
```text
Subject: a poised, enigmatic eastern-fantasy human strategist noblewoman in a graceful turned three-quarter pose, holding an intricately painted translucent jade-and-gold folding fan with hanging emerald tassels near her cheek while ink-wash lotus petals drift around her. Sdorica stylized face: porcelain-ivory skin, delicate beauty mark near her eye, sharp luminous jade-teal eyes, composed crimson lips. Elaborate long ink-black hair styled in a half-up traditional chignon pinned with sculpted antique-gold magnolia hairpins, pearl combs, and dangling celadon jade beads. Exquisite multi-layered eastern couture: off-shoulder smoky-ink and celadon-jade brocade high-slit gown painted with silver-white ink-lotus motifs, structured embroidered jade-and-gold cloud collar, ornate layered silk waist-sash with carved white-jade pendants and gold filigree clasps, and a vast billowing translucent pale-teal silk shawl trailing like mountain mist.
```

### `backup_05` · 时钟塔星盘炼金少女（纯人类 · 奇幻蒸汽巴洛克小魔女）
```text
Subject: a lively, brilliant human clocktower alchemy-prodigy girl caught in an energetic mid-turn pose, holding up an oversized intricately geared antique-brass celestial astrolabe lantern radiating warm golden starlight rings. Sdorica stylized face: sparkling rose-gold eyes with crisp catchlights, rosy peach blush, cheerful confident smirk. Voluminous strawberry-blonde hair styled in fluffy wavy twin-tails bound with embroidered burgundy velvet bows, tiny brass clockwork hairpins, and a tilted miniature navy-and-gold scholar beret. Rich multi-layered fantasy academy attire: structured deep-navy velvet capelet trimmed with antique-gold embroidery and twin brass leather-strap clasps, ruffled ivory blouse with a jeweled burgundy cravat, laced brown leather alchemist waist-corset with miniature scroll pouches and glass vials, layered pleated burgundy-and-cream tartan skirt, and lace-trimmed stockings with buckled leather boots.
```

### `backup_06` · 极北霜狼耳圣弓猎手（克制轻兽耳 · 彻底重构的高密度雪国猎手）
```text
Subject: a cool, regal silver-wolf-eared kemonomimi frost-kingdom archer maiden in a dramatic twisting mid-draw action pose, pulling back a massive, intricately carved ivory-bone and translucent frost-crystal recurve bow fitted with antique-gold filigree limbs and a glowing pale-cyan energy arrow. Exquisite human bishoujo face (Sione and Naya blend): crisp icy-turquoise eyes, poised focused gaze, soft winter-rose cheek blush, and fluffy silver-white wolf ears adorned with a tiny antique-silver ear-cuff emerging naturally from her hair (human face, no animal snout). Voluminous ash-silver hair styled with intricate side-braids, silver-bead hair cords, and a sweeping wind-blown high ponytail, balanced by a lush silver-white wolf tail. Rich multi-layered northern ranger gear (NO plain flat tunic): asymmetrical engraved frost-silver left shoulder pauldron with wolf-crest relief, dense layered white-and-slate-blue wolf-fur mantle pinned with an ornate sapphire cloak-brooch, intricately stitched slate-blue and ivory quilted brocade hunting corset bound with embossed dark-leather cross-belts, brass buckles, and an ornate fur-trimmed leather quiver full of ice-fletched arrows on her back, layered split fur-hemmed battle skirt with silver-embroidered Nordic scrollwork, embossed leather archery bracers, and a sweeping frost-embroidered silk scarf trailing snow-crystal sparks.
```
