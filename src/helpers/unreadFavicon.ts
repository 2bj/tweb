import {FontFamily} from '@config/font';

export function formatUnreadFaviconCount(count: number) {
  return count < 100 ? '' + count : '99+';
}

export function buildUnreadFaviconDataUrl(count: number): string {
  if(count <= 0) {
    return '';
  }

  const canvas = document.createElement('canvas');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = 32 * ratio;
  canvas.height = canvas.width;

  const ctx = canvas.getContext('2d');
  if(!ctx) {
    return '';
  }

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 2 * Math.PI, false);
  ctx.fillStyle = '#3390ec';
  ctx.fill();

  const str = formatUnreadFaviconCount(count);
  let fontSize = 24;
  if(count < 10) {
    fontSize = 22;
  } else if(count < 100) {
    fontSize = 20;
  } else {
    fontSize = 16;
  }

  fontSize *= ratio;

  ctx.font = `700 ${fontSize}px ${FontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';
  ctx.fillText(str, canvas.width / 2, canvas.height * .5625);

  return canvas.toDataURL();
}
