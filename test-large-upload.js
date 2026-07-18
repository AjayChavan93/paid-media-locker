async function testUpload() {
  const API_URL = 'https://paid-media-locker-1-4gxu.onrender.com/api';
  
  // Register User
  let res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `LargeUploader_${Date.now()}`, password: 'password123' })
  });
  const token = (await res.json()).token;
  
  const fs = require('fs');
  const fileBuffer = fs.readFileSync('big.jpg');
  const base64String = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
  
  console.log(`Uploading ${base64String.length} bytes as Base64 JSON...`);
  try {
    res = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: "Large Base64 Test",
        price: "50",
        imageBase64: base64String
      })
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch (err) {
    console.log("Error:", err.message);
  }
}
testUpload();
