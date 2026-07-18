const fs = require('fs');

async function runDemo() {
  const API_URL = 'https://paid-media-locker-1-4gxu.onrender.com/api';
  
  console.log("Registering DemoUser...");
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `DemoUser_${Date.now()}`, password: 'password123' })
  });
  
  if (!regRes.ok) {
    console.error("Register failed:", await regRes.text());
    return;
  }
  
  const regData = await regRes.json();
  const token = regData.token;
  console.log("Registered! Token:", token.slice(0, 15) + "...");
  
  console.log("Uploading Sample Image...");
  const formData = new FormData();
  formData.append("title", "Beautiful Abstract Fluid Art");
  formData.append("price", "250");
  
  const fileBuffer = fs.readFileSync('sample.jpg');
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  formData.append("image", blob, "sample.jpg");
  
  const uploadRes = await fetch(`${API_URL}/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  if (!uploadRes.ok) {
    console.error("Upload failed:", await uploadRes.text());
    return;
  }
  
  const uploadData = await uploadRes.json();
  console.log("Upload Success! Media ID:", uploadData.media.id);
  console.log("Demo successfully populated!");
}

runDemo();
