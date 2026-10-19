const sceneNames = ['frostfire', 'obsidian-woods', 'magaari-ember-highlands', 'shimzar', 'vetruvian', 'load'];

export const HOME_BACKGROUNDS = Object.freeze([
  ...sceneNames.map(name => `./assets/home-backgrounds/scene-${name}.webp`),
  ...Array.from({ length: 24 }, (_, index) => `./assets/home-backgrounds/story-${String(index + 1).padStart(2, '0')}.webp`)
]);

// A page load is one game session. Returning to camp or rebuilding its UI keeps
// this choice; it never becomes player progress or persists into the next launch.
export const SESSION_HOME_BACKGROUND = HOME_BACKGROUNDS[Math.floor(Math.random() * HOME_BACKGROUNDS.length)];
