(() => {
  'use strict';
  const authority = 'GENERATED_RENDER_SPRITES_NOT_MEASURED_BAT_GEOMETRY';
  const pixelSize = 3;
  // Manually inspected dominant bat silhouettes, in the original 2172×724 PNG.
  // The distant alpha speckles are excluded. These are art anchors, not metres,
  // a collision silhouette, a measured bat profile, or a hand position source.
  const calibrations = Object.freeze({
    'bat-78cm.png': Object.freeze({ knobX: 94, tipX: 2080, centerY: 356, cropY: 251, cropHeight: 212, maximumDiameterPx: 206 }),
    'bat-84cm.png': Object.freeze({ knobX: 90, tipX: 2085, centerY: 357, cropY: 257, cropHeight: 204, maximumDiameterPx: 200 }),
    'bat-90cm.png': Object.freeze({ knobX: 70, tipX: 2106, centerY: 355, cropY: 248, cropHeight: 215, maximumDiameterPx: 210 }),
  });
  const pack = globalThis.KneekuraBatLengthSpriteData;
  if (pack?.authority !== authority || !Array.isArray(pack.variants) || pack.variants.length !== 3) throw Error('Bat sprite data is invalid');
  const images = pack.variants.map(variant => {
    if (!calibrations[variant.file] || !Number.isFinite(variant.nominalLengthM) || !variant.pngDataUri?.startsWith('data:image/png;base64,')) throw Error('Bat sprite variant is invalid');
    return { ...variant, calibration: calibrations[variant.file], image: new Image(), loaded: false };
  }).sort((a, b) => a.nominalLengthM - b.nominalLengthM);
  let loaded = false, lastDraw = null;
  const ready = Promise.all(images.map(sprite => new Promise((resolve, reject) => {
    sprite.image.onload = () => {
      if (sprite.image.naturalWidth !== 2172 || sprite.image.naturalHeight !== 724) return reject(Error('Bat sprite dimensions differ'));
      // Prefilter the large dotted artwork once, so subpixel transparent gaps
      // do not alias into missing barrel columns. The original PNG is intact;
      // final placement and enlargement still use the nearest pixel camera.
      const cal = sprite.calibration, texture = document.createElement('canvas');
      texture.width = 256; texture.height = 32;
      const filtered = texture.getContext('2d');
      if (!filtered) return reject(Error('Bat sprite texture canvas is unavailable'));
      filtered.imageSmoothingEnabled = true; filtered.imageSmoothingQuality = 'high';
      filtered.drawImage(sprite.image, cal.knobX, cal.cropY, cal.tipX - cal.knobX, cal.cropHeight, 0, 0, texture.width, texture.height);
      sprite.texture = texture;
      sprite.loaded = true; resolve();
    };
    sprite.image.onerror = () => reject(Error('Bat sprite image did not load: ' + sprite.file));
    sprite.image.src = sprite.pngDataUri;
  }))).then(() => { loaded = true; });
  const layers = new WeakMap();
  const finitePoint = point => point && ['x', 'y', 'scale'].every(key => Number.isFinite(point[key])) && point.scale > 0;
  const draw = (ctx, { grip, tip, lengthM, maximumRadiusM } = {}) => {
    if (!loaded || !ctx?.canvas || !finitePoint(grip) || !finitePoint(tip) || !Number.isFinite(lengthM) || lengthM <= 0
      || !Number.isFinite(maximumRadiusM) || maximumRadiusM <= 0) return false;
    const sprite = images.reduce((best, candidate) => Math.abs(candidate.nominalLengthM - lengthM) < Math.abs(best.nominalLengthM - lengthM) ? candidate : best);
    const cal = sprite.calibration, span = cal.tipX - cal.knobX;
    const dx = tip.x - grip.x, dy = tip.y - grip.y, projectedLengthPx = Math.hypot(dx, dy);
    let layer = layers.get(ctx.canvas);
    if (!layer) { const canvas = document.createElement('canvas'); layer = { canvas, ctx: canvas.getContext('2d') }; layers.set(ctx.canvas, layer); }
    const width = Math.ceil(ctx.canvas.width / pixelSize), height = Math.ceil(ctx.canvas.height / pixelSize);
    if (width <= 0 || height <= 0 || !layer.ctx) return false;
    if (layer.canvas.width !== width) layer.canvas.width = width;
    if (layer.canvas.height !== height) layer.canvas.height = height;
    const low = layer.ctx;
    low.clearRect(0, 0, width, height); low.imageSmoothingEnabled = false;
    low.save(); low.translate(grip.x / pixelSize, grip.y / pixelSize); low.rotate(Math.atan2(dy, dx));
    const diameterAt = t => 2 * maximumRadiusM / ((1 - t) / grip.scale + t / tip.scale);
    // Perspective division uses the same endpoint camera scales as the caller.
    // Length affects the chosen artwork only; the projected endpoints and
    // physical radius independently determine the final length and thickness.
    const projectedT = t => t * grip.scale / ((1 - t) * tip.scale + t * grip.scale);
    const foreshortened = projectedLengthPx < pixelSize / 2;
    if (foreshortened) {
      const diameter = diameterAt(.5) / pixelSize;
      low.beginPath(); low.arc(0, 0, diameter / 2, 0, 2 * Math.PI); low.clip();
      low.drawImage(sprite.texture, (.78 - cal.maximumDiameterPx / span / 2) * sprite.texture.width,
        (cal.centerY - cal.maximumDiameterPx / 2 - cal.cropY) / cal.cropHeight * sprite.texture.height,
        cal.maximumDiameterPx / span * sprite.texture.width, cal.maximumDiameterPx / cal.cropHeight * sprite.texture.height,
        -diameter / 2, -diameter / 2, diameter, diameter);
    } else {
      const strips = Math.max(1, Math.min(96, Math.ceil(projectedLengthPx / pixelSize)));
      for (let index = 0; index < strips; index++) {
        const a = index / strips, b = (index + 1) / strips;
        const left = projectedT(a) * projectedLengthPx / pixelSize, right = projectedT(b) * projectedLengthPx / pixelSize;
        const verticalScale = diameterAt((a + b) / 2) / cal.maximumDiameterPx / pixelSize;
        low.drawImage(sprite.texture, a * sprite.texture.width, 0, (b - a) * sprite.texture.width, sprite.texture.height,
          left, (cal.cropY - cal.centerY) * verticalScale, right - left, cal.cropHeight * verticalScale);
      }
    }
    low.restore();
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer.canvas, 0, 0, width * pixelSize, height * pixelSize); ctx.restore();
    lastDraw = { file: sprite.file, nominalLengthM: sprite.nominalLengthM, requestedLengthM: lengthM, maximumRadiusM,
      grip: { x: grip.x, y: grip.y, scale: grip.scale }, tip: { x: tip.x, y: tip.y, scale: tip.scale },
      projectedLengthPx, diameterGripPx: 2 * maximumRadiusM * grip.scale, diameterTipPx: 2 * maximumRadiusM * tip.scale,
      pixelSize, bufferWidth: width, bufferHeight: height, foreshortened };
    return true;
  };
  globalThis.KneekuraBatLengthSprites = Object.freeze({ ready, draw, inspect: () => ({ authority, loaded, pixelSize,
    physicsAuthority: false, calibrationMethod: 'MANUAL_DOMINANT_BAT_SILHOUETTE_V1', textureFilter: 'AREA_PREFILTER_256_BY_32_THEN_NEAREST_PIXEL_CAMERA', manifestSha256: pack.manifestSha256,
    variants: images.map(sprite => ({ file: sprite.file, nominalLengthM: sprite.nominalLengthM, sha256: sprite.sha256,
      loaded: sprite.loaded, calibration: { ...sprite.calibration } })),
    lastDraw: lastDraw ? JSON.parse(JSON.stringify(lastDraw)) : null }) });
})();
