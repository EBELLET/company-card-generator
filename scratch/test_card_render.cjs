async function testRender() {
  try {
    const res = await fetch('http://localhost:3000/card/collab_1783932377029');
    const html = await res.text();
    const match = html.match(/<h1 class="collab-name">([\s\S]*?)<\/h1>/);
    console.log('RENDERED NAME:', match ? match[1] : 'NOT FOUND');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testRender();
