async function testLogin() {
  const API_URL = 'https://paid-media-locker-1-4gxu.onrender.com/api';
  
  console.log("Attempting to login as seller...");
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'seller', password: 'password123' })
    });
    
    const text = await res.text();
    console.log(`Login Status: ${res.status}`);
    console.log(`Login Response: ${text}`);
    
    // Also try health endpoint
    const health = await fetch(`${API_URL.replace('/api', '')}/health`);
    console.log(`Health Status: ${health.status}`);
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

testLogin();
