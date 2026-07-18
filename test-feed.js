async function testFeed() {
  const API_URL = 'https://paid-media-locker-1-4gxu.onrender.com/api';
  
  // Register a temporary user to get a token
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `FeedTester_${Date.now()}`, password: 'password123' })
  });
  
  const regData = await regRes.json();
  const token = regData.token;
  
  console.log("Testing Feed Fetch...");
  const feedRes = await fetch(`${API_URL}/media/feed`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (feedRes.ok) {
    const feedData = await feedRes.json();
    console.log(`Feed loaded! Found ${feedData.feed.length} items.`);
    if (feedData.feed.length > 0) {
      console.log("First item:", feedData.feed[0].title);
      console.log("Preview URL:", feedData.feed[0].imageUrl);
    }
  } else {
    console.log("Failed to fetch feed:", await feedRes.text());
  }
}

testFeed();
