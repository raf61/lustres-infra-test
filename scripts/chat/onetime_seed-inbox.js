const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const phoneNumberId = process.env.WA_CLOUD_PHONE_NUMBER_ID;
  const token = process.env.WA_CLOUD_TOKEN;
  const apiVersion = process.env.WA_CLOUD_API_VERSION || 'v22.0';

  if (!phoneNumberId || !token) {
    console.error('ERRO: WA_CLOUD_PHONE_NUMBER_ID ou WA_CLOUD_TOKEN não configurados no .env');
    process.exit(1);
  }

  console.log(`Cadastrando Inbox para o número ID: ${phoneNumberId}...`);

  const inbox = await prisma.chatInbox.upsert({
    where: { phoneNumberId },
    update: {
      name: 'WhatsApp Oficial (Principal)',
      settings: {
        token,
        apiVersion,
      },
    },
    create: {
      name: 'WhatsApp Oficial (Principal)',
      phoneNumberId,
      provider: 'whatsapp_cloud',
      settings: {
        token,
        apiVersion,
      },
    },
  });

  console.log('✅ Inbox configurada com sucesso!');
  console.log(JSON.stringify(inbox, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
