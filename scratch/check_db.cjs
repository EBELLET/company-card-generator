const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.get("SELECT * FROM company_info LIMIT 1", async (err, company) => {
  if (err || !company) {
    console.error("No company found:", err);
    db.close();
    return;
  }
  console.log("Found company:", company.id, company.name);
  db.close();

  // Perform PUT
  const payload = {
    name: company.name,
    domain: company.domain,
    address: company.address,
    zip: company.zip,
    city: company.city,
    country: company.country,
    logo_custom_url: company.logo_custom_url,
    theme: company.theme,
    font: company.font,
    accent_color: '#ff5500', // change accent color to test
    logo_size: company.logo_size,
    button_style: company.button_style,
    avatar_size: company.avatar_size,
    show_name_under_logo: company.show_name_under_logo
  };

  try {
    const response = await fetch(`http://localhost:3000/api/companies/${company.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("PUT response status:", response.status);
    const data = await response.json();
    console.log("PUT response body:", data);
  } catch (e) {
    console.error("Fetch PUT error:", e);
  }
});
