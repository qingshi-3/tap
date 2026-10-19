export const JOURNEY_ART = Object.freeze({
  'moss-gate': Object.freeze({
    src:'./assets/ui/scenes/moss-gate.jpg',
    position:'68% center',
    label:'苔门遗境',
  }),
  'ember-trail': Object.freeze({
    src:'./assets/ui/scenes/ember-trail.jpg',
    position:'42% center',
    label:'余烬长路',
  }),
  'blade-trial': Object.freeze({
    src:'./assets/ui/scenes/blade-trial.jpg',
    position:'50% center',
    label:'刃之试炼',
  }),
  'swift-trial': Object.freeze({
    src:'./assets/ui/scenes/swift-trial.jpg',
    position:'55% center',
    label:'迅风试炼',
  }),
  'summoner-trial': Object.freeze({
    src:'./assets/ui/scenes/ember-trail.jpg',
    position:'36% center',
    label:'幽契试炼',
  }),
  'blink-trial': Object.freeze({
    src:'./assets/ui/scenes/blink-trial.jpg',
    position:'50% center',
    label:'瞬印试炼',
  }),
  'mage-trial': Object.freeze({
    src:'./assets/ui/scenes/blade-trial.jpg',
    position:'58% center',
    label:'元素试炼',
  }),
});

export const journeyArtFor = journeyId => JOURNEY_ART[journeyId] || null;
