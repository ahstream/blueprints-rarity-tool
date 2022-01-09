/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

/* eslint-disable no-extend-native */
/* eslint-disable func-names */

// EXPORTED FUNCTIONS

export function countWord(string, word) {
  return string.split(word).length - 1;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function addSecondsToDate(date, seconds) {
  const newDate = new Date(date);
  newDate.setSeconds(newDate.getSeconds() + seconds);
  return newDate;
}

export function subtractSecondsFromDate(date, seconds) {
  const newDate = new Date(date);
  newDate.setSeconds(newDate.getSeconds() - seconds);
  return newDate;
}

export function range(start, stop, step = 1) {
  return Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + (i * step));
}

export function parseRetryAfterSecs(header, undefinedValue) {
  try {
    const value = Number(header);
    if (!Number.isNaN(value)) {
      return value;
    }
    // Or HTTP date time string
    const dateTime = Date.parse(header);
    if (!Number.isNaN(dateTime)) {
      return Number((dateTime - Date.now()) / 1000);
    }
    return undefinedValue;
  } catch (error) {
    return undefinedValue;
  }
}

export function isValidURL(uri) {
  try {
    if (!uri) {
      return false;
    }
    const url = new URL(uri);
    return true;
  } catch (_error) {
    return false;
  }
}

export function doIfTrue(predicate, func, ...args) {
  if (predicate) {
    func(...args);
  }
}

export function compareOrderedNum(a, b, ascending) {
  if (typeof a !== 'number' && typeof b !== 'number') {
    return 0;
  }
  if (typeof a !== 'number') {
    return 1;
  }
  if (typeof b !== 'number') {
    return -1;
  }
  if (a === b) {
    return 0;
  }
  return ascending ? a - b : b - a;
}

export function compareOrderedString(a, b, ascending) {
  const aUpper = a.toUpperCase();
  const bUpper = b.toUpperCase();
  if (typeof aUpper !== 'string' && typeof bUpper !== 'string') {
    return 0;
  }
  if (typeof aUpper !== 'string') {
    return 1;
  }
  if (typeof bUpper !== 'string') {
    return -1;
  }
  if (aUpper === bUpper) {
    return 0;
  }
  if (ascending) {
    return aUpper > bUpper ? 1 : -1;
  }
  return bUpper > aUpper ? 1 : -1;
}

// HELPER FUNCTIONS

// NOT USED FUNCTIONS

export function shuffle(array) {
  let currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

export function addToListIfNotPresent(item, list) {
  if (!list.includes(item)) {
    list.push(item);
  }
}

export function trimChars(str, chars) {
  return trimCharsLeft(trimCharsRight(str, chars), chars);
}

export function trimCharsLeft(str, chars) {
  return str.replace(new RegExp(`^[${chars}]+`), '');
}

export function trimCharsRight(str, chars) {
  return str.replace(new RegExp(`[${chars}]+$`), '');
}

export function ensureProperties(baseObj, properties) {
  let obj = baseObj;
  if (typeof obj === 'undefined') {
    throw new Error('Base object cannot be undefined!');
  }
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    if (typeof obj[property] === 'undefined') {
      obj[property] = {};
    }
    obj = obj[property];
  }
}

export function propertiesExists(baseObj, properties) {
  let obj = baseObj;
  if (typeof obj === 'undefined') {
    return false;
  }
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    obj = obj[property];
    if (typeof obj === 'undefined') {
      return false;
    }
  }
  return true;
}

export function capitalize(words) {
  return words
    .split(' ')
    .map((w) => w.substring(0, 1).toUpperCase() + w.substring(1))
    .join(' ');
}

export function convertNumberValToLocaleString(val, locale = 'sv_SE') {
  if (typeof val !== 'number') {
    return val;
  }
  if (locale === 'sv_SE') {
    return val.toString().replace(/\./g, ',');
  }
  return val.toString();
}

export function getRandomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function decodeEntitiesInString(encodedString) {
  const translateRegexp = /&(nbsp|amp|quot|lt|gt);/g;
  const translate = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    lt: '<',
    gt: '>'
  };
  return encodedString
    .replace(translateRegexp, (match, entity) => translate[entity])
    .replace(/&#(\d+);/gi, (match, numStr) => {
      const num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
}

export function normalizeText(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
