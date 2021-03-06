// @flow
'use strict';

import Op, {UUID, Frame, ron2js} from 'swarm-ron';

/**
 * lwwFrame2js
 * @param rawFrame {String}
 * @returns {Object|Array|null}
 */
export default function lwwFrame2js(rawFrame: string): mixed {
  let rootID = null;
  const refs = {};
  const lww = new Frame(rawFrame);
  let hasValue = false;

  for (const op of lww) {
    hasValue = true;
    const id = op.object.toString();
    rootID = rootID || id;
    if (op.isHeader() || op.isQuery()) continue;
    const ref = refs[id] || (refs[id] = op.location.isHash() ? [] : {});
    let value = ron2js(op.values).pop();
    if (value instanceof UUID) {
      value = {$ref: value.toString()};
    }

    let key = op.location.toString();
    if (op.location.isHash()) {
      if (op.location.value !== '~') {
        throw new Error('only flatten arrays are beign supported');
      }
      key = parseInt(op.location.origin);
      if (isNaN(key)) {
        throw new Error('malformed index value: ' + op.location.origin);
      }
    }

    ref[key] = value;
    // $FlowFixMe
    ref._id = id;
  }

  if (!hasValue) return null;

  Object.keys(refs).forEach(key => {
    const value = refs[key];
    if (Array.isArray(value)) {
      refs[key] = value.map(v => {
        if (isObject(v) && !!v['$ref']) {
          return refs[v['$ref']] || v;
        } else {
          return v;
        }
      });
      refs[key]._id = value._id;
    } else if (isObject(value)) {
      Object.keys(value).forEach(k => {
        if (isObject(value[k]) && !!value[k]['$ref']) {
          refs[key][k] = refs[value[k]['$ref']] || value[k];
        }
      });
    } else {
      throw new Error('unexpected value');
    }
  });

  // $FlowFixMe
  return Object.freeze(refs[rootID] || null);
}

function isObject(o) {
  return !!o && o.constructor === Object;
}
