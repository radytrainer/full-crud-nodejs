const { readFileSync, writeFileSync } = require("fs");
/**
 * Get data in a file as JSON format
 * @param {string} filename 
 * @returns As array JSON object
 */
function getData(filename) {
  return JSON.parse(readFileSync(filename, "utf8"));
}

/**
 * Save data from request to file as JSON format
 * @param {string} filename
 * @param {object} data 
 */
function saveData(filename, data) {
  writeFileSync(filename, JSON.stringify(data));
}

module.exports = { getData, saveData };
