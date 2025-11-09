const API_BASE = window.location.origin;
let token = null;
let myId = null;

async function api(path, method='GET', body) {
  try {
    const res = await fetch(API_BASE + '/api/' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ? `⚠️ ${data.error}` : 'Unknown error');
      return {};
    }
    return data;
  } catch (err) {
    alert('❌ Could not reach server. Please try again.');
    console.error(err);
    return {};
  }
}

function generateUUID() {
  return 'u' + Math.random().toString(36).slice(2, 10);
}
