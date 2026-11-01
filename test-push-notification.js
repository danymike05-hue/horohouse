/**
 * test-push-notification.js
 *
 * Quick end-to-end test for the HoroHouse push notification pipeline.
 *
 * What it does:
 *  1. Logs in with a phone number + password to get a fresh JWT
 *  2. Checks the current user's stored push tokens (via GET /users/me or similar —
 *     adjust the endpoint below if your route differs)
 *  3. Fires POST /notifications/test to trigger a real notification
 *  4. Prints the full response so you can see exactly what happened
 *
 * Usage:
 *   node test-push-notification.js
 *
 * Requires Node 18+ (uses built-in fetch).
 */

const BASE_URL = 'http://192.168.254.37:4000/api/v1';
const EMAIL = 'admin@horohouse.com';  // <-- your test account email
const PASSWORD = 'HoroHouse2026!';          // <-- your test account password

async function login() {
  const url = `${BASE_URL}/auth/login/email`;
  console.log(`\n🔐 POST ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  console.log(`   Status: ${res.status} ${res.statusText}`);
  const rawText = await res.text();
  console.log(`   Raw body: ${rawText || '(empty)'}`);

  if (!rawText) {
    console.error('\n❌ Server returned an empty body — check the URL/port/path above.');
    console.error('   Common causes: wrong IP/port, wrong route path, or the backend crashed mid-request.');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error('\n❌ Response was not valid JSON. See raw body above.');
    process.exit(1);
  }

  if (!res.ok) {
    console.error('❌ Login failed:', res.status, data);
    process.exit(1);
  }

  const token = data.accessToken ?? data.token ?? data.access_token;
  if (!token) {
    console.error('❌ Login succeeded but no token found in response:', data);
    process.exit(1);
  }

  console.log('✅ Login OK, got JWT.');
  return token;
}

async function checkPushTokens(token) {
  console.log('\n📱 Checking registered push tokens for this user...');
  try {
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('⚠️  Could not fetch /auth/profile:', res.status, data);
      return;
    }
    const tokens = data.user?.pushTokens ?? [];
    if (tokens.length === 0) {
      console.warn('⚠️  No push tokens registered for this user yet.');
      console.warn('    Make sure you opened the app on your phone and granted notification permission first.');
    } else {
      console.log(`✅ Found ${tokens.length} push token(s):`);
      tokens.forEach((t, i) => console.log(`   [${i}] ${t.platform} — ${t.token.slice(0, 30)}...`));
    }
  } catch (err) {
    console.warn('⚠️  Skipping token check:', err.message);
  }
}

async function triggerTestNotification(token) {
  console.log('\n🚀 Triggering POST /notifications/test...');
  const res = await fetch(`${BASE_URL}/notifications/test`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error(`❌ Test notification failed (${res.status}):`, data);
    process.exit(1);
  }

  console.log('✅ Backend accepted the request:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n📲 Now check your PHONE (app should be fully closed, not just backgrounded).');
  console.log('   If nothing arrives within ~15-30 seconds, check the backend logs for errors from PushNotificationsService.');
}

async function main() {
  const token = await login();
  await checkPushTokens(token);
  await triggerTestNotification(token);
}

main().catch((err) => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});