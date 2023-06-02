const axios = require('axios');
const cheerio = require('cheerio');

const firstPageUrl = '?user=bothadam&n=100&startDate=';
const baseUrl = 'https://data.typeracer.com/pit/race_history';

const scrapePage = async pageUrl => {
  try {
    const res = await axios.get(pageUrl);

    if (res.status === 200) {
      const pageResults = [];
      const html = res.data;
      const $ = cheerio.load(html);

      $('.Scores__Table__Row').each((index, element) => {
        const date = $(element).find('.profileTableHeaderDate').text().trim();
        let [wpm, gap, accuracy] = $(element).find('.profileTableHeaderRaces').text().trim().split('\n');
        accuracy = accuracy.trim();
        pageResults.push({
          date,
          wpm,
          accuracy,
        });
      });
      const olderPageUrl = $('a:contains("load older results")').attr('href');

      if (olderPageUrl) {
        const nextPageResults = await scrapePage(`${baseUrl}${olderPageUrl}`);
        return pageResults.concat(nextPageResults);
      } else {
        return pageResults;
      }
    } else {
      console.log('Failed to retrieve data');
    }
  } catch (e) {
    console.log('error scraping page', pageUrl, '\n', e);
  }
};

const convertDataToCsv = data => {
  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.join(',')); // Add headers as the first row

  data.forEach(obj => {
    const values = headers.map(header => obj[header]);
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
};

const main = async () => {
  let results = await scrapePage(`${baseUrl}${firstPageUrl}`);
  const todaysDate = new Date();
  const todaysDateFormatted = todaysDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  console.log(todaysDateFormatted);
  results = results.map(res => (res.date === 'today' ? { ...res, date: todaysDateFormatted } : res));
  console.log(results);
  console.log('ajb ', convertDataToCsv(results));
};

main();
