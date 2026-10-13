import fs from 'fs';

async function fetchAllBuaflPosts() {
  console.log('Fetching all BUAFL posts from Double Coverage Blogger API...');
  
  const allEntries = [];
  let startIndex = 1;
  const maxResults = 25;
  let totalResults = 129; // default, updated from first response

  while (startIndex <= totalResults) {
    const url = `https://dblcoverage.blogspot.com/feeds/posts/default/-/BUAFL?alt=json&start-index=${startIndex}&max-results=${maxResults}`;
    console.log(`Fetching: start-index=${startIndex}...`);
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`HTTP error: ${res.status} ${res.statusText}`);
        break;
      }
      const data = await res.json();
      
      const total = parseInt(data.feed?.openSearch$totalResults?.$t || '0');
      if (total > 0) totalResults = total;
      
      const entries = data.feed?.entry || [];
      console.log(`  Received ${entries.length} entries (Total available: ${totalResults}).`);
      
      if (entries.length === 0) break;
      
      allEntries.push(...entries);
      startIndex += entries.length;
    } catch (err) {
      console.error('Fetch error:', err);
      break;
    }
  }

  console.log(`\nSuccessfully downloaded ${allEntries.length} total BUAFL posts.`);
  fs.writeFileSync('scratch/dblcoverage_buafl_posts.json', JSON.stringify(allEntries, null, 2));
  console.log('Saved to scratch/dblcoverage_buafl_posts.json');
}

fetchAllBuaflPosts();
