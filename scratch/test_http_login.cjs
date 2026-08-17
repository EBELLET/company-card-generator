async function testHttpLogin() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadm', password: 'AdminPass123!' })
    });
    console.log('HTTP Status:', res.status);
    const data = await res.json();
    console.log('HTTP Response:', data);
  } catch (err) {
    console.log('Fetch error:', err.message);
  }
}

testHttpLogin();
