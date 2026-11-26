// Preserve the complete status submessage, including fields unknown to this plugin.
// Schema: discord-userdoccers/discord-protos, PreloadedUserSettings.status (11),
// StatusSettings.show_current_game (3), google.protobuf.BoolValue.value (1).
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64(text) {
  if (typeof text !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) {
    throw new Error('Invalid settings encoding');
  }
  const bytes = [];
  let bits = 0, value = 0;
  for (const char of text.replace(/=+$/, '')) {
    value = (value << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  return bytes;
}

export function encodeBase64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    result += alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63];
    result += i + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '=';
    result += i + 2 < bytes.length ? alphabet[value & 63] : '=';
  }
  return result;
}

function varint(bytes, offset) {
  let value = 0;
  for (let shift = 0; shift < 70; shift += 7) {
    if (offset >= bytes.length) throw new Error('Truncated settings');
    const byte = bytes[offset++];
    value += (byte & 127) * 2 ** shift;
    if (!(byte & 128)) return { value, offset };
  }
  throw new Error('Invalid settings varint');
}

function fields(bytes) {
  const result = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = offset;
    const tag = varint(bytes, offset);
    const number = Math.floor(tag.value / 8), wire = tag.value % 8;
    if (!Number.isSafeInteger(tag.value) || number < 1 || number > 536870911) throw new Error('Invalid settings field');
    offset = tag.offset;
    let dataStart = offset, value;
    if (wire === 0) { const item = varint(bytes, offset); offset = item.offset; value = item.value; }
    else if (wire === 1) offset += 8;
    else if (wire === 5) offset += 4;
    else if (wire === 2) {
      const size = varint(bytes, offset);
      if (!Number.isSafeInteger(size.value)) throw new Error('Invalid settings length');
      dataStart = size.offset;
      offset = dataStart + size.value;
    } else throw new Error('Unsupported settings wire type');
    if (offset > bytes.length) throw new Error('Truncated settings field');
    result.push({ number, wire, value, raw: bytes.slice(start, offset), data: bytes.slice(dataStart, offset) });
  }
  return result;
}

function messageFields(bytes, number) {
  return fields(bytes).filter(field => {
    if (field.number !== number) return false;
    if (field.wire !== 2) throw new Error('Unexpected settings field type');
    return true;
  }).flatMap(field => field.data);
}

function lengthDelimited(number, bytes) {
  const tag = [], length = [];
  let value = number * 8 + 2;
  while (value > 127) { tag.push((value % 128) | 128); value = Math.floor(value / 128); }
  tag.push(value);
  let size = bytes.length;
  while (size > 127) { length.push((size % 128) | 128); size = Math.floor(size / 128); }
  length.push(size);
  return [...tag, ...length, ...bytes];
}

export function readActivity(settings) {
  const bytes = decodeBase64(settings);
  const status = messageFields(bytes, 11);
  const wrapped = fields(status).filter(field => field.number === 3);
  let enabled = true;
  if (wrapped.length) {
    const values = fields(messageFields(status, 3)).filter(field => field.number === 1);
    if (values.some(field => field.wire !== 0)) throw new Error('Unexpected activity value');
    enabled = values.length ? values.at(-1).value !== 0 : false;
  }
  const versions = fields(messageFields(bytes, 1)).filter(field => field.number === 3);
  const version = versions.at(-1);
  if (version && (version.wire !== 0 || !Number.isSafeInteger(version.value))) throw new Error('Invalid settings version');
  return { enabled, dataVersion: version?.value, status };
}

export function activityPatch(snapshot, enabled) {
  const status = fields(snapshot.status).filter(field => field.number !== 3).flatMap(field => field.raw);
  // Send the entire status field, so custom status, expiration and unknown fields survive.
  status.push(...lengthDelimited(3, enabled ? [8, 1] : []));
  const body = { settings: encodeBase64(lengthDelimited(11, status)) };
  if (snapshot.dataVersion !== undefined) body.required_data_version = snapshot.dataVersion;
  return body;
}
