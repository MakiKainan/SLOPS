import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the actual phone-page script with canvas/network boundaries stubbed.
const elements = {};
const canvas = () => ({ width: 640, height: 640, getContext: () => ({
  fillRect() {}, drawImage(...args) { thisCanvasDraw = args.slice(1); },
}), toBlob(callback) { callback(new Blob(['cropped'])); } });
let thisCanvasDraw, sent = 0;
const get = (id) => elements[id] ??= { ...canvas(), hidden: true, disabled: false, value: '1',
  focus() {}, events: {}, addEventListener(type, fn) { this.events[type] = fn; },
  getBoundingClientRect: () => ({ width: 320 }), setPointerCapture() {},
};
const context = { document: { getElementById: get, createElement: canvas },
  location: { pathname: '/u/test-token' }, Blob, FormData,
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  Image: class { naturalWidth = 1200; naturalHeight = 800; async decode() {} },
  fetch: async (_, { body }) => { sent++; assert.equal(await body.get('photo').text(), 'cropped'); return { ok: true }; },
};
runInNewContext(readFileSync('upload.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1], context);
get('file').files = [{}];
await get('file').events.change();
assert.equal(sent, 0, 'Choosing a photo must not send it');
assert.deepEqual(thisCanvasDraw.slice(0, 4), [200, 0, 800, 800]);
get('zoom').value = '2';
get('zoom').events.input();
assert.deepEqual(thisCanvasDraw.slice(0, 4), [400, 200, 400, 400]);
get('preview').events.pointerdown({ pointerId: 1, clientX: 0, clientY: 0 });
get('preview').events.pointermove({ pointerId: 1, clientX: 9999, clientY: -9999 });
assert.deepEqual(thisCanvasDraw.slice(0, 4), [0, 400, 400, 400], 'Dragging stays inside the image');
get('preview').events.pointerup();
get('reset').events.click();
assert.deepEqual(thisCanvasDraw.slice(0, 4), [200, 0, 800, 800]);
get('preview').events.keydown({ key: 'ArrowLeft', preventDefault() {} });
assert.equal(thisCanvasDraw[0], 240);
const successfulUpload = context.fetch;
context.fetch = async () => { throw new Error('offline'); };
await get('send').events.click();
assert.equal(get('sending').hidden, true);
assert.equal(get('send').disabled, false, 'Failed uploads can be retried');
assert.equal(get('done').hidden, true);
context.fetch = successfulUpload;
await get('send').events.click();
assert.equal(sent, 1);
assert.equal(get('done').hidden, false);
assert.deepEqual(thisCanvasDraw.slice(0, 4), [240, 0, 800, 800], 'Confirmation shows the sent crop');
assert.equal(get('sending').hidden, true);
console.log('PASS: crop, zoom, pan bounds, reset, keyboard positioning, explicit cropped upload');

context.Image = class { naturalWidth = 600; naturalHeight = 1200; async decode() {} };
await get('file').events.change();
assert.deepEqual(thisCanvasDraw.slice(0, 4), [0, 300, 600, 600], 'Portrait crop stays square');
context.Image = class { async decode() { throw new Error('unsupported'); } };
await get('file').events.change();
assert.equal(get('send').hidden, true, 'Unreadable photos cannot bypass cropping');
assert.equal(get('error').hidden, false);
