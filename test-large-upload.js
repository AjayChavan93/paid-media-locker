async function testUpload() {
  const API_URL = 'https://paid-media-locker-1-4gxu.onrender.com/api';
  
  // Register User
  let res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `LargeUploader_${Date.now()}`, password: 'password123' })
  });
  const token = (await res.json()).token;
  
  // Upload Media
  const formData = new FormData();
  formData.append("title", "Large Image Test");
  formData.append("price", "50");
  const fs = require('fs');
  const fileBuffer = fs.readFileSync('big.jpg');
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  formData.append("image", blob, "big.jpg");
  
  console.log(`Uploading ${fileBuffer.length} bytes...`);
  try {
    res = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch (err) {
    console.log("Error:", err.message);
  }
}
testUpload();
