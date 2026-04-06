import * as scraper from "../../src/services/scraper.js";
import { writeFile } from "fs/promises"; // 1. Import the file system promise API

try {
  const result = await scraper.search(`cafe in vandavasi`);
  
  // 2. Convert the object to a JSON string
  // The 'null, 2' arguments add 2-space indentation for readability
  const jsonData = JSON.stringify(result, null, 2);

  // 3. Write the data to a file
  await writeFile("results.json", jsonData, "utf8");

  console.log(result.slice(0, 3));
  console.log(`Successfully saved ${result.length} results to results.json`);
} catch (err) {
  console.error("Error during scraping or file writing:", err);
}