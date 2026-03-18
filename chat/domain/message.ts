export type InboundContact = {
  waId?: string;
  name?: string;
};

export type InboundLocation = {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  url?: string;
};

export type InboundInteractive = {
  type?: string;
  button?: { id?: string; title?: string };
  list?: { id?: string; title?: string; description?: string };
};

export type InboundMediaMeta = {
  id?: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  url?: string;
  sample?: string | null;
  error?: string;
};

export type InboundMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: string;
  caption?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaMeta?: InboundMediaMeta | null;
  location?: InboundLocation;
  contacts?: InboundContact[];
  interactive?: InboundInteractive;
  reaction?: string;
  reactedTo?: string;
  timestamp?: number | string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  inReplyTo?: string;       // ID externo da mensagem respondida (context.id)
  profileName?: string;     // Nome do perfil do WhatsApp
  raw?: any;
};

