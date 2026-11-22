// Cross-sections are (x, rear shore, front shore, elevation). Stations are
// (x, lane centre). Both are in the same world coordinates as the voxel grid.
type Section = readonly [number, number, number, number];
type Station = readonly [number, number];
interface Landform {
  sections: readonly Section[];
  stations: readonly Station[];
  gate: Station;
  focal: Station;
  crossing: number;
  lanes: number;
  bossHeight: number;
  rockDepth: number;
  viewAngles: readonly [number, number];
}
const landforms: Record<string, Landform> = {
  emerald_day: {
    // A green valley with a fan-shaped river mouth between two grassy headlands.
    sections: [
      [-44, -3, 4, 3], [-37, -11, 13, 3], [-24, -20, 18, 4],
      [-12, -20, 16, 3], [-4, -15, 10, 3], [9, -17, 15, 4],
      [24, -18, 20, 6], [36, -11, 12, 7], [44, -4, 3, 8],
    ],
    stations: [
      [-33, -1], [-22, -2], [-12, 1],
      [0, -1], [12, 0], [22, 1],
      [34, -1],
    ],
    gate: [-40, 1], focal: [-17, -20],
    crossing: 2, lanes: 12.5, bossHeight: 9.12, rockDepth: 7, viewAngles: [-10, 33],
  },
  autumn_sunset: {
    // Broad tilted terraces descend from the eastern shrine ridge to a low western landing.
    sections: [
      [-45, 1, 8, 2], [-37, -8, 18, 3], [-25, -13, 23, 3],
      [-15, -11, 20, 5], [-4, -18, 14, 6], [6, -21, 9, 7],
      [16, -24, 13, 8], [29, -25, 9, 9], [39, -17, 4, 9],
      [44, -11, -5, 9],
    ],
    stations: [
      [-34, 5], [-23, 5], [-12, 4],
      [-1, 1], [10, -3], [22, -5],
      [34, -7],
    ],
    gate: [-40, 7.5], focal: [16, -23.75],
    crossing: 3, lanes: 12.5, bossHeight: 10.56, rockDepth: 5.6, viewAngles: [6, 32],
  },
  moonlit_woods: {
    // The wooded crescent bows inland around an open foreground inlet.
    sections: [
      [-44, 1, 8, 4], [-37, -7, 19, 5], [-28, -15, 22, 6],
      [-17, -21, 13, 5], [-7, -25, 4, 5], [1, -25, 2, 5],
      [11, -22, 8, 5], [24, -16, 19, 6], [35, -8, 23, 6],
      [44, 0, 13, 5],
    ],
    stations: [
      [-34, 5], [-24, 1], [-15, -5],
      [1.5, -9], [12, -5], [23, 1],
      [34, 7],
    ],
    gate: [-40, 7.5], focal: [7.5, -23.75],
    crossing: 2, lanes: 12.5, bossHeight: 8.64, rockDepth: 7.8, viewAngles: [-9, 33],
  },
  golden_oasis: {
    // Three flat-topped mesas surround an elongated oasis below the sandstone road.
    sections: [
      [-45, -6, 2, 5], [-36, -16, 15, 6], [-26, -17, 16, 7],
      [-19, -12, 11, 5], [-13, -11, 13, 3], [-5, -18, 22, 4],
      [5, -19, 21, 4], [13, -11, 15, 6], [21, -17, 16, 8],
      [32, -18, 12, 8], [43, -7, 5, 7],
    ],
    stations: [
      [-35, 0], [-26, 1], [-8, 2],
      [2, 5], [12, 4], [23, -1],
      [34, -3],
    ],
    gate: [-40, -2.5], focal: [27, -18.75],
    crossing: 1, lanes: 12.5, bossHeight: 9.12, rockDepth: 9.8, viewAngles: [2, 32],
  },
  alpine_snow: {
    // A long glacier tongue and two sharp ridges flank a narrow, deep fjord.
    sections: [
      [-45, -13, -4, 7], [-36, -20, 9, 8], [-25, -21, 8, 8],
      [-17, -17, 4, 4], [-9, -23, 15, 7], [3, -26, 24, 9],
      [12, -20, 26, 8], [20, -16, 15, 7], [30, -15, 13, 7],
      [40, -10, 8, 8], [45, -3, 3, 8],
    ],
    stations: [
      [-34, -5], [-23, -6], [-12, -3],
      [0, 2], [12, 6], [23, 2],
      [34, 0],
    ],
    gate: [-40, -8.75], focal: [6, -23.75],
    crossing: 1, lanes: 13.75, bossHeight: 10.08, rockDepth: 8.4, viewAngles: [0, 30],
  },
  ashen_citadel: {
    // Two basalt shelves break along a zigzag lava trench. The rim rises above the caldera floor.
    sections: [
      [-44, -1, 6, 4], [-37, -11, 17, 5], [-27, -21, 17, 6],
      [-17, -22, 10, 6], [-8, -16, 12, 4], [1, -13, 19, 4],
      [9, -11, 21, 5], [17, -18, 20, 7], [27, -23, 13, 9],
      [36, -17, 11, 10], [44, -7, 1, 9],
    ],
    stations: [
      [-34, 3], [-23, -3], [-12, -4],
      [0, 1], [11, 5], [23, 1],
      [34, -4],
    ],
    gate: [-40, 3.75], focal: [-27, -22.5],
    crossing: 3, lanes: 13.75, bossHeight: 11.04, rockDepth: 10.8, viewAngles: [-5, 30],
  },
};

const smooth = (v: number) => v * v * (3 - 2 * v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function expeditionLandform(theme: string) {
  const design = landforms[theme] ?? landforms.emerald_day;
  // Authored sites are sampled along the same spine for older or shorter route layouts.
  function station(fraction: number): Station {
    const t = Math.max(0, Math.min(1, fraction)) * (design.stations.length - 1);
    const i = Math.min(Math.floor(t), design.stations.length - 2);
    return [mix(design.stations[i][0], design.stations[i + 1][0], t - i),
      mix(design.stations[i][1], design.stations[i + 1][1], t - i)];
  }
  function section(x: number) {
    const s = design.sections;
    let i = 1;
    while (i < s.length - 1 && x > s[i][0]) i++;
    const a = s[i - 1], b = s[i];
    const t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
    return { rear: mix(a[1], b[1], t), front: mix(a[2], b[2], t), elevation: mix(a[3], b[3], smooth(t)) };
  }
  return { ...design, station, section };
}
