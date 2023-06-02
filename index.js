import axios from 'axios';
import cheerio from 'cheerio';
import clipboardy from 'clipboardy';
import fs from 'fs';
import moment from 'moment';

const firstPageUrl = '?user=bothadam&n=100&startDate=';
const baseUrl = 'https://data.typeracer.com/pit/race_history';

const scrapePage = async pageUrl => {
  try {
    const res = await axios.get(pageUrl);

    if (res.status === 200) {
      const pageResults = [];
      const html = res.data;
      const $ = cheerio.load(html);

      $('.Scores__Table__Row').each((i, element) => {
        let date = $(element).find('.profileTableHeaderDate').text().trim();
        date = (date === 'today' ? moment() : moment(date, 'MMM. D YYYY')).format('YYYY-MM-DD');

        let [wpm, gap, accuracy] = $(element).find('.profileTableHeaderRaces').text().trim().split('\n');
        // We only want the words per minute number, so strip away the " WPM" part.
        wpm = wpm.split(' ')[0];

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

const writeToFile = csvResults => {
  fs.writeFile('typeracer-results.csv', csvResults, err => {
    if (err) {
      console.error('Error writing to file:', err);
      return;
    }

    console.log('File created and data written successfully.');
  });
};

const main = async () => {
  let results = await scrapePage(`${baseUrl}${firstPageUrl}`);
  results = results.reverse().map((res, i) => ({ nr: i + 1, ...res }));
  const csvResults = convertDataToCsv(results);

  // Copy
  clipboardy.writeSync(csvResults);
  console.log('Csv results copied to clipboard ;)');
  writeToFile(csvResults);
};

main();
