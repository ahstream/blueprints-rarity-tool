import { Stats } from 'fast-stats';

import { sort } from './myLibOld/myUtils.js';
import { addNoneTraits, TRAIT_COUNT_TYPE } from './trait.js';

export function calcRarity(collection, rules, doCalcOutliers = false) {
  addNoneTraits(collection);
  calcCollection(collection, rules);
  calcTokens(collection, rules);
  calcRanks(collection);
  if (doCalcOutliers) {
    calcOutliers(collection);
  }
}

function calcCollection(collection, rules) {
  const numTokens = collection.tokens.length;

  let numTraits = 0;
  let numValues = 0;

  for (const traitType of Object.keys(collection.traits.items)) {
    const isTraitCount = collection.traits.items[traitType].trait_type === TRAIT_COUNT_TYPE;
    const countNumTotals = isTraitCount ? rules.traitCount : true;

    numTraits = numTraits + (countNumTotals ? 1 : 0);
    let numValuesInTrait = 0;
    for (const traitValue of Object.keys(collection.traits.items[traitType].items)) {
      numValues = numValues + (countNumTotals ? 1 : 0);
      numValuesInTrait++;
      const freq = collection.traits.items[traitType].items[traitValue].count / numTokens;
      const rarity = 1 / freq;
      collection.traits.items[traitType].items[traitValue].freq = freq;
      collection.traits.items[traitType].items[traitValue].rarity = rarity;
      collection.traits.items[traitType].items[traitValue].rarity_additional = calcAdditionalWeight(rarity, traitType, traitValue, rules);
    }
    collection.traits.items[traitType].num_values = numValuesInTrait;
  }

  collection.traits.num_values = numValues;
  collection.traits.num_traits = numTraits;
  collection.traits.avg_num_values_per_trait = numValues / numTraits;

  for (const traitType of Object.keys(collection.traits.items)) {
    for (const traitValue of Object.keys(collection.traits.items[traitType].items)) {
      const isTraitCount = collection.traits.items[traitType].trait_type === TRAIT_COUNT_TYPE;
      const normFactor = (collection.traits.avg_num_values_per_trait / collection.traits.items[traitType].num_values);
      collection.traits.items[traitType].normFactor = normFactor;
      collection.traits.items[traitType].items[traitValue].rarity_norm = collection.traits.items[traitType].items[traitValue].rarity * normFactor;
      collection.traits.items[traitType].items[traitValue].rarity_additional_norm = collection.traits.items[traitType].items[traitValue].rarity_additional * normFactor;

      const score = calcScore(collection.traits.items[traitType].items[traitValue], isTraitCount, rules);
      collection.traits.items[traitType].items[traitValue].score = score;
    }
  }
}

function calcScore(traitValueObj, isTraitCount, rules) {
  if (isTraitCount && !rules.traitCount) {
    return 0;
  }
  if (rules.additionalWeight && rules.normalize) {
    return traitValueObj.rarity_additional_norm;
  }
  if (rules.additionalWeight && !rules.normalize) {
    return traitValueObj.rarity_additional;
  }
  if (!rules.additionalWeight && rules.normalize) {
    return traitValueObj.rarity_norm;
  }
  if (!rules.additionalWeight && !rules.normalize) {
    return traitValueObj.rarity;
  }
}

function calcAdditionalWeight(rarity, traitType, traitValue, rules) {
  if (!rules.weights) {
    return rarity;
  }
  const key1 = traitType;
  const key2 = `${traitType}/${traitValue}`;
  const factor = rules.weights[key1] ?? rules.weights[key2] ?? 1;
  return rarity * factor;
}

function calcTokens(collection, rules) {
  for (const token of collection.tokens) {
    calcTokenRarity(token, collection, rules);
    calcTokenLevels(token, collection, rules);
  }
}

function calcTokenRarity(token, collection, rules) {
  let sumRarity = 0;
  let sumRarityNorm = 0;
  let sumRarityAdditional = 0;
  let sumRarityAdditionalNorm = 0;
  let sumScore = 0;

  for (let trait of token.traits) {
    const traitType = trait.trait_type;
    const traitValue = trait.value;

    const isTraitCount = traitType === TRAIT_COUNT_TYPE;
    const countTotals = isTraitCount ? rules.traitCount : true;

    trait.num_with_this_trait = collection.traits.items[traitType].items[traitValue].count;
    trait.freq = collection.traits.items[traitType].items[traitValue].freq;
    trait.rarity = collection.traits.items[traitType].items[traitValue].rarity;
    trait.rarity_additional = collection.traits.items[traitType].items[traitValue].rarity_additional;
    trait.rarity_norm = collection.traits.items[traitType].items[traitValue].rarity_norm;
    trait.rarity_additional_norm = collection.traits.items[traitType].items[traitValue].rarity_additional_norm;
    trait.score = collection.traits.items[traitType].items[traitValue].score;

    sumRarity = sumRarity + (countTotals ? trait.rarity : 0);
    sumRarityAdditional = sumRarityAdditional + (countTotals ? trait.rarity_additional : 0);
    sumRarityNorm = sumRarityNorm + (countTotals ? trait.rarity_norm : 0);
    sumRarityAdditionalNorm = sumRarityAdditionalNorm + (countTotals ? trait.rarity_additional_norm : 0);
    sumScore = sumScore + trait.score;

    // Need to do this here also to add for NONE values!
    // addToTokenTraitsMap(token, traitType, traitValue);
  }

  token.rarity = sumRarity;
  token.rarity_additional = sumRarityAdditional;
  token.rarity_norm = sumRarityNorm;
  token.rarity_additional_norm = sumRarityAdditionalNorm;
  token.score = sumScore;

  token.has_rarity = token.rarity > 0;
}

function calcTokenLevels(token) {
  let sumLevels = 0;
  for (let level of token.levels) {
    sumLevels += level.value;
  }
  token.level = sumLevels;
}

export function calcRanks(collection) {
  calcRank(collection.tokens, 'score', false);
  calcRank(collection.tokens, 'level', false);
  calcRank(collection.tokens, 'rarity', false);
  calcRank(collection.tokens, 'rarity_additional', false);
  calcRank(collection.tokens, 'rarity_norm', false);
  calcRank(collection.tokens, 'rarity_additional_norm', false);
}

function calcRank(tokens, rankingKey, ascending) {
  const numTokens = tokens.length;
  const sortedTokens = sort(tokens, rankingKey, ascending);

  let rank = 1;
  let lastRank = 1;
  let lastScore = 0;
  for (const token of sortedTokens) {
    const thisScore = token[rankingKey];
    let thisRank = rank;
    if (thisScore === lastScore) {
      thisRank = lastRank;
    }
    lastScore = thisScore;
    lastRank = thisRank;

    token[`${rankingKey}_rank`] = thisRank;

    const thisTop = Math.round((thisRank / numTokens) * 1000) / 1000;
    token[`${rankingKey}_top`] = thisTop;

    rank++;
  }
}

function calcOutliers(collection) {
  collection.calcOutlier = calcOutlier(collection, 'score');
  // calcOutlier(collection, 'rarityCountNorm');
  // calcOutlier(collection, 'rarityCount');
  // calcOutlier(collection, 'rarity_norm');
  // calcOutlier(collection, 'rarity');
}

function calcOutlier(collection, scoreKey) {
  const scores = collection.tokens.map(token => token[scoreKey]).filter(score => typeof score === 'number');
  sort(scores, scoreKey, true);

  const stats = new Stats();
  stats.push(scores);

  const q3 = stats.percentile(75);
  const q1 = stats.percentile(25);
  const iqr = q3 - q1;

  const calcOV = val => (val - q3) / iqr;

  collection.tokens.forEach(token => {
    if (!token.ovs) {
      token.ovs = {};
    }
    const thisOV = calcOV(token[scoreKey]);
    token.ovs[scoreKey] = thisOV;
    if (scoreKey === 'score') {
      token.ov = thisOV;
    }
  });

  return calcOV;
}
