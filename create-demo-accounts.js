async function createDemoAccounts() {
  const API_URL = 'https://paid-media-locker-1-4gxu.onrender.com/api';
  
  const accounts = [
    { username: 'seller', password: 'password123' },
    { username: 'buyer', password: 'password123' }
  ];
  
  for (const acc of accounts) {
    console.log(`Registering ${acc.username}...`);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      const text = await res.text();
      if (res.ok) {
        console.log(`Successfully registered ${acc.username}!`);
      } else {
        console.log(`Failed to register ${acc.username} (maybe already exists?): ${text}`);
      }
    } catch (err) {
      console.error(`Error registering ${acc.username}:`, err.message);
    }
  }
}

createDemoAccounts();
