function normalizeAvatarValue(value, options = {}) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const maxBytes = Number(options.maxBytes || 0);
  const isDataUrl = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(trimmed);

  if (isDataUrl) {
    const [, payload] = trimmed.split(',', 2);
    if (!payload) {
      return '';
    }

    const byteLength = Buffer.byteLength(payload, 'base64');
    if (maxBytes > 0 && byteLength > maxBytes) {
      return '';
    }

    return trimmed;
  }

  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    return trimmed;
  }

  return '';
}

module.exports = {
  normalizeAvatarValue,
};
