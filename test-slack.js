require('dotenv').config();
const { WebClient } = require('@slack/web-api');

async function test() {
  const client = new WebClient(process.env.SLACK_BOT_TOKEN);

  // List users to find you
  const users = await client.users.list({});
  const realUsers = users.members.filter(u => !u.is_bot && !u.deleted && u.id !== 'USLACKBOT');

  console.log('Active users in workspace:');
  realUsers.slice(0, 5).forEach(u => {
    console.log('  -', u.real_name || u.name, '(' + u.id + ')');
  });

  // Try to send a test message to the first user
  if (realUsers.length > 0) {
    const testUser = realUsers[0];
    console.log('\nSending test message to:', testUser.real_name || testUser.name);

    try {
      await client.chat.postMessage({
        channel: testUser.id,
        text: 'Test message from Otto - if you see this, the bot can send messages!'
      });
      console.log('Message sent successfully!');
    } catch (err) {
      console.log('Failed to send:', err.message);
    }
  }
}

test().catch(console.error);
