async function fullFlow() {
  const API_URL = 'https://paid-media-locker-1-4gxu.onrender.com/api';
  
  // 1. Register User A
  let res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `UserA_${Date.now()}`, password: 'password123' })
  });
  const tokenA = (await res.json()).token;
  
  // 2. Upload Media
  const formData = new FormData();
  formData.append("title", "Test");
  formData.append("price", "50");
  const fs = require('fs');
  const fileBuffer = fs.readFileSync('sample.jpg');
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  formData.append("image", blob, "test.jpg");
  
  res = await fetch(`${API_URL}/media/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` },
    body: formData
  });
  const mediaId = (await res.json()).media.id;
  
  // 3. Register User B
  res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `UserB_${Date.now()}`, password: 'password123' })
  });
  const tokenB = (await res.json()).token;
  
  // 4. Unlock Media
  res = await fetch(`${API_URL}/media/${mediaId}/unlock`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}`, 'Accept': 'application/json' }
  });
  console.log("Unlock status:", res.status);
  
  // 5. Fetch Feed to get URL
  res = await fetch(`${API_URL}/media/feed`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const feed = (await res.json()).feed;
  const item = feed.find(f => f.id === mediaId);
  console.log("Item Status:", item.status);
  console.log("Image URL:", item.imageUrl);
  
  // 6. Fetch the Image URL
  const imgRes = await fetch(item.imageUrl);
  console.log("Image Fetch Status:", imgRes.status);
  const text = await imgRes.text();
  if (!imgRes.ok) console.log("Image error:", text.substring(0, 500));
}
fullFlow();
