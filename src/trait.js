export const TRAIT_NONE_VALUE = 'None';
export const TRAIT_COUNT_TYPE = 'Trait Count';

export function addTokenAttributes(token, attributes, collection, rules) {
  const levels = attributes.filter((attr) => typeof attr.value === 'number');
  const traits = attributes.filter((attr) => typeof attr.value === 'string');
  const others = attributes.filter((attr) => !['number', 'string'].includes(typeof attr.value));
  const traitCount = traits.length;

  traits.forEach(trait => {
    trait.is_normal = true;
    trait.value = normalizeTraitValue(trait.value);
  });

  traits.push({
    trait_type: TRAIT_COUNT_TYPE,
    value: traitCount.toString(),
    isTraitCount: true
  });

  addCustomTraits(traits, rules);

  token.levels = levels;
  token.traits = traits;
  token.others = others;
  token.traitCount = traitCount;

  addCollectionTraits(collection, traits);
  // todo addCollectionLevels(collection, levels, rules);
}

function addCustomTraits(traits, rules) {
  if (!rules.customTraits) {
    return;
  }

  traits.forEach(trait => {
    const key = `${trait.trait_type}/${trait.value}`;
    if (rules.customTraits[key]) {
      const newTraitArr = rules.customTraits[key].split('/');
      traits.push({ trait_type: newTraitArr[0], value: newTraitArr[1], isCustom: true });
    }
  });
}

function addCollectionTraits(collection, traits) {
  for (let trait of traits) {
    if (trait.value === '') {
      trait.value = TRAIT_NONE_VALUE;
    }
    const traitType = trait.trait_type;
    const value = trait.value.toString();

    if (!collection.traits.items[traitType]) {
      collection.traits.items[traitType] = {
        count: 0,
        trait_type: traitType,
        display_type: trait.display_type,
        items: {},
      };
      // collection.runtime.newTraitTypes = true;
      // addGlobalTraitMaps(traitType, collection);
    }
    collection.traits.items[traitType].count++;

    if (!collection.traits.items[traitType].items[value]) {
      collection.traits.items[traitType].items[value] = {
        count: 0,
        value: value,
      };
    }
    collection.traits.items[traitType].items[value].count++;
  }
}

function addCollectionTrait(collection, trait) {
  if (trait.value === '') {
    trait.value = TRAIT_NONE_VALUE;
  }
  const traitType = trait.trait_type;
  const value = trait.value.toString();

  if (!collection.traits.items[traitType]) {
    collection.traits.items[traitType] = {
      count: 0,
      trait_type: traitType,
      display_type: trait.display_type,
      items: {},
    };
    // collection.runtime.newTraitTypes = true;
    // addGlobalTraitMaps(traitType, collection);
  }
  collection.traits.items[traitType].count++;

  if (!collection.traits.items[traitType].items[value]) {
    collection.traits.items[traitType].items[value] = {
      count: 0,
      value: value,
    };
  }
  collection.traits.items[traitType].items[value].count++;
}

function normalizeTraitValue(value) {
  let normalizedValue = value.toString();
  if (['none', 'nothing'].includes(normalizedValue.toLowerCase())) {
    normalizedValue = TRAIT_NONE_VALUE;
  }
  return normalizedValue;
}

export function getTraitFrequency(collection, traitType, traitValue) {
  if (!collection.traits.items[traitType]) {
    return null;
  }
  if (!collection.traits.items[traitType].items[traitValue]) {
    return null;
  }
  return collection.traits.items[traitType].items[traitValue].freq;
}

export function addNoneTraits(collection) {
  /*
  TODO:
  if (!collection.runtime.newTraitTypes) {
    log.debug('no newTraitTypes');
    return;
  }
   */

  for (const traitType of Object.keys(collection.traits.items)) {
    if (typeof collection.traits.items[traitType] !== 'object') {
      continue;
    }
    for (const token of collection.tokens) {
      if (typeof token.traits.find !== 'function') {
        continue;
      }
      if (!token.traits.find(o => o.trait_type === traitType)) {
        const noneTrait = { trait_type: traitType, value: TRAIT_NONE_VALUE, is_normal: true };
        token.traits.push(noneTrait);
        addCollectionTrait(collection, noneTrait);
      }
    }
  }

  // todo collection.runtime.newTraitTypes = false;
}

