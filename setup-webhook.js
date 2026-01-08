require('dotenv').config();
const Asana = require('asana');

async function setupWebhook() {
  const client = Asana.ApiClient.instance;
  client.authentications.token.accessToken = process.env.ASANA_API_TOKEN;

  const webhooksApi = new Asana.WebhooksApi();
  const workspaceId = '1201958741977013'; // From your tenant config
  const callbackUrl = 'https://entangleable-jess-dovetailed.ngrok-free.dev/webhooks/asana';

  console.log('Setting up Asana webhook...');
  console.log('Workspace ID:', workspaceId);
  console.log('Callback URL:', callbackUrl);

  try {
    // First, list existing webhooks
    console.log('\nExisting webhooks:');
    const existing = await webhooksApi.getWebhooks(workspaceId, {});
    if (existing.data && existing.data.length > 0) {
      existing.data.forEach(wh => {
        console.log(`  - ${wh.gid}: ${wh.resource?.name || wh.resource?.gid} -> ${wh.target}`);
      });
    } else {
      console.log('  (none)');
    }

    // Create webhook for the workspace
    console.log('\nCreating new webhook for workspace...');
    const result = await webhooksApi.createWebhook({
      data: {
        resource: workspaceId,
        target: callbackUrl,
        filters: [
          {
            resource_type: 'task',
            action: 'changed',
            fields: ['assignee', 'completed']
          }
        ]
      }
    }, {});

    console.log('Webhook created successfully!');
    console.log('Webhook ID:', result.data.gid);
    console.log('Active:', result.data.active);

  } catch (error) {
    console.error('Error:', error.response?.body || error.message);
  }
}

setupWebhook();
