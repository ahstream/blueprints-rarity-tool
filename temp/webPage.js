import { readFile, toAbsFilepath, writeFile } from "./fileUtils.js";

export function createAlertWebPage(config, alertedAssets) {
  const contentHtml = alertWebPageHtml(config.collection, alertedAssets);
  const pageHtml = buildPage('Alert Page', 'Alert page', contentHtml);
  const path = `${config.projectFolder}alert.html`;
  writeFile(path, pageHtml);
  return path;
}

function alertWebPageHtml(collection, alertedAssets) {
  return importTemplate('alert.html')
    .replace('{SUB_HEADER}', alertSubHeaderHtml(collection))
    .replace('{TABLE_DESCRIPTION}', `<span class="desc-text">DESC</span>`)
    .replace('{TABLE_DATA}', alertTableDataHtml(collection, alertedAssets));
}

function alertSubHeaderHtml(collection) {
  let html = '';

  html = html + `<span>`;
  html = html + `<b>Project:</b> ${collection.projectId}`;
  html = html + `<br>`;
  html = html + `<b>Alert rules:</b> ${JSON.stringify(collection.alert)}`;
  html = html + `<br>`;
  html = html + `<b>Create Date:</b> ${normalizeLongDate(new Date())}`;
  html = html + `<br>`;
  html = html + `</span>`;

  if (collection.assetsInfo) {
    const ref = collection.assetsInfo;
    const priceLevels3 = ref.levels.map(obj => `<span>(${obj.price})</span> <span class="large-count">${obj.count}</span>`).join('');
    html = html + `<span>Buynow:<span class="large-count">${ref.numBuynow}</span> Floor:<span class="large-count">${normalizePrice(ref.floor)}</span> Price levels: ${priceLevels3}`;
  }

  return html;
}

function alertTableDataHtml(collection, alertedAssets, lastUpdate = null) {
  let html = '';

  for (const alert of alertedAssets.sort((a, b) => b.listingDate - a.listingDate)) {
    const asset = alert.asset;
    const titleTxt = 'todo: title';
    const imageHtml = `<a target="_blank" href="${asset.permalink}"><img alt='' title="${titleTxt}" class="alert-thumb" src="${asset.imageThumbnailUrl}"></a>`;
    const scoreHtml = 'todo';
    const rankHtml = 'todo';

    const thisPriceHtml = `
            <span class="alert-sale-price"><a target="_blank" href="${asset.permalink}">${normalizePrice(asset.price)}</a></span>&nbsp;
            <span class="alert-sale-days">(${normalizeDays(asset.listingDays)} d)</span>`;

    const allPricesHtml = alert.traitAssetsByPrice.slice(0, 10)
      .map(obj => {
        return `
            <span class="alert-sale-price"><a target="_blank" href="${obj.permalink}">${normalizePrice(obj.price)}</a></span>&nbsp;
            <span class="alert-sale-days">(${normalizeDays(obj.listingDays)} d)</span>`;
      })
      .join('<br>')
      .replace(thisPriceHtml, `<span class="current-price">${thisPriceHtml}</span>`);

    const lastSalesHtml = alert.traitAssetsByDate.slice(0, 6)
      .map(obj => {
        return `
            <span class="alert-last-sale-price"><a target="_blank" href="${obj.permalink}">${normalizePrice(obj.lastSalePrice)}</a></span>&nbsp;
            <span class="alert-last-sale-days">(${normalizeDays(obj.lastSaleDays)} d)</span>`;
      })
      .join('<br>');

    let className = lastUpdate && lastUpdate < alert.created ? 'new-alert' : '';

    html = html + `
        <tr class="${className}">
            <td>${imageHtml}</td>
            <td>${alert.reasonValue}</td>
            <td>${normalizePrice(alert.priceThreshold)}</td>
            <td>${normalizePrice(alert.asset.price)}</td>
            <td class="price">${allPricesHtml}</td>
            <td>${lastSalesHtml}</td>
            <td>${rankHtml}</td>
            <td class="lolite">${scoreHtml}</td>
            <td>${normalizeNumber(alert.asset.listingHours)} hours ago&nbsp;(${normalizeLongDate(alert.asset.listingDate)})</td>
          </tr>
`;
  }

  return html;
}

// HELPERS

function buildPage(title, headerHtml, contentHtml) {
  return importTemplate('page.html')
    .replace('{PAGE_TITLE}', title)
    .replace('{PAGE_HEADER}', headerHtml)
    .replace('{PAGE_CONTENT}', contentHtml);
}

function importTemplate(name) {
  return readFile(toAbsFilepath(`./templates/${name}`));
}

function normalizePct(val) {
  if (val < 0.1) {
    return val.toFixed(2);
  } else if (val < 10) {
    return val.toFixed(1);
  } else {
    return val.toFixed(0);
  }
}

function normalizePrice(val, defaultDecimals = 3, undefinedResult = '') {
  if (typeof val !== 'number') {
    return undefinedResult;
  }

  if (val >= 1000000000) {
    return `${(val / 1000000000).toFixed(0)}G`;
  }

  if (val >= 1000000) {
    return `${(val / 1000000).toFixed(0)}M`;
  }

  if (val >= 1000) {
    return `${(val / 1000).toFixed(0)}K`;
  }

  if (val < 1) {
    return val.toFixed(defaultDecimals);
  }

  if (val < 10) {
    return val.toFixed(1);
  }

  return val.toFixed(0);
}

function normalizeDays(val, undefinedResult = '') {
  return typeof val === 'number' ? val.toFixed(0) : undefinedResult;
}

function normalizeNumber(val, undefinedResult = '') {
  return typeof val === 'number' ? val.toFixed(0) : undefinedResult;
}

function normalizeLongDate(val, undefinedResult = '') {
  return (val instanceof Date) ? val.toLocaleString() : undefinedResult;
}

function normalizeShortDate(val, undefinedResult = '') {
  return (val instanceof Date) ? val.toLocaleDateString() : undefinedResult;
}
