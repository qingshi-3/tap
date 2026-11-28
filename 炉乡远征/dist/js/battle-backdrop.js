export function composeBattleBackdrop(image, theme, boardWidth, boardHeight, metrics, ratio, border = null) {
  const { width, height, topScale, viewport } = metrics;
  const { left, right, top, bottom } = viewport;
  const viewportCenter = (left + right) / 2;
  const backInset = boardWidth * (1 - topScale) / 2;
  const sideMargin = Math.ceil(12 + Math.max(0, left - backInset, width - right - backInset,
    Math.max(viewportCenter, width - viewportCenter) - boardWidth / 2));
  const topMargin = Math.ceil(12 + (metrics.fixedView ? metrics.top : Math.max(top + 48, bottom - boardHeight)));
  const bottomMargin = Math.ceil(12 + height - (metrics.fixedView ? metrics.bottom : Math.min(bottom, top + 48 + boardHeight)));
  const worldWidth = boardWidth + 2 * sideMargin;
  const worldHeight = boardHeight + topMargin + bottomMargin;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(worldWidth * ratio);
  canvas.height = Math.ceil(worldHeight * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / worldWidth, canvas.height / worldHeight);
  ctx.imageSmoothingEnabled = false;
  if (theme.framePerimeter) {
    drawFramedPerimeter(ctx, image, theme, border, boardWidth, boardHeight,
      worldWidth, sideMargin, topMargin, bottomMargin, backInset);
  } else {
    drawUniformLandscape(ctx, image, theme, boardWidth, boardHeight,
      worldWidth, worldHeight, topMargin, bottomMargin, backInset);
  }
  return { canvas, width: worldWidth, height: worldHeight, topMargin };
}

function drawUniformLandscape(ctx, image, theme, boardWidth, boardHeight,
  worldWidth, worldHeight, topMargin, bottomMargin, backInset) {
  const [floorLeft, floorTop, floorRight, floorBottom] = theme.floorBounds;
  const iw = image.naturalWidth, ih = image.naturalHeight;
  // Include the pan limits and the shake gutter in the crop. A wide board
  // stays registered to the two side walls; a tall one uses the full floor depth.
  const scale = Math.max(
    (boardWidth - backInset) / (floorRight - floorLeft), boardHeight / (floorBottom - floorTop),
    worldWidth / iw, worldHeight / ih,
    (topMargin + boardHeight) / floorBottom, (boardHeight + bottomMargin) / (ih - floorTop)
  );
  const drawWidth = iw * scale, drawHeight = ih * scale;
  const x = Math.max(worldWidth - drawWidth, Math.min(0, worldWidth / 2 - (floorLeft + floorRight) * scale / 2));
  const y = Math.min(0, topMargin - floorTop * scale);

  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawFramedPerimeter(ctx, image, theme, border, boardWidth, boardHeight,
  worldWidth, sideMargin, topMargin, bottomMargin, backInset) {
  const [floorLeft, floorTop, floorRight, floorBottom] = theme.floorBounds;
  const sourceX = [0, floorLeft, floorRight, image.naturalWidth];
  // A painted repair uses the source artwork's coordinates. The unpainted
  // parts of the frame still sample the original decoded texture directly.
  const leftPatch = theme.borderArt?.sourceAligned ? border : null;
  const baseLayer = [image];
  const leftLayers = leftPatch ? [image, leftPatch] : baseLayer;
  function leftEdge(depth) { return sideMargin + backInset * (1 - depth); }

  // Each horizontal strip maps the uninterrupted ground between the two
  // perspective rails. Side and end scenery occupies only the exterior.
  function drawStrip(sourceY, sourceHeight, y, stripHeight, depth) {
    const x = Math.round(leftEdge(depth));
    const destX = [0, x, worldWidth - x, worldWidth];
    for (let col = 0; col < 3; col++) {
      for (const layer of col === 0 ? leftLayers : baseLayer) {
        ctx.drawImage(layer, sourceX[col], sourceY, sourceX[col + 1] - sourceX[col], sourceHeight,
          destX[col], y, destX[col + 1] - destX[col], stripHeight);
      }
    }
  }
  drawStrip(0, floorTop, 0, topMargin, 0);
  const bands = Math.max(1, Math.ceil(backInset));
  for (let i = 0; i < bands; i++) {
    const y = Math.round(boardHeight * i / bands);
    const end = Math.round(boardHeight * (i + 1) / bands);
    const sourceY = floorTop + y / boardHeight * (floorBottom - floorTop);
    drawStrip(sourceY, (end - y) / boardHeight * (floorBottom - floorTop),
      topMargin + y, end - y, (y + end) / (2 * boardHeight));
  }
  drawStrip(floorBottom, image.naturalHeight - floorBottom,
    topMargin + boardHeight, bottomMargin, 1);

  if (border && !leftPatch) {
    const art = theme.borderArt;
    const artHeight = art.continuous ? boardHeight : art.height;
    for (const side of theme.hideLeftBorderArt ? [1] : [-1, 1]) {
      ctx.save();
      const rail = side === -1 ? leftEdge(0) : worldWidth - leftEdge(0);
      // Mirror the same local artwork on the opposite rail. Its right
      // edge always faces the board, with a 2px ground clearance.
      ctx.transform(-side, 0, side * backInset / boardHeight, 1, rail, topMargin);
      const y = art.continuous ? 0 : boardHeight * (art.depth ?? 0.5) - artHeight / 2;
      ctx.drawImage(border, -art.width - 2, y, art.width, artHeight);
      ctx.restore();
    }
  }
}
