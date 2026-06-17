export interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
}

/**
 * Sends a push notification via the Expo Push API.
 * Handles arrays of tokens and filters out invalid ones.
 */
export async function sendPushNotification(message: PushMessage): Promise<void> {
  const tokens = Array.isArray(message.to) ? message.to : [message.to];
  
  // Filter only valid Expo push tokens
  const validTokens = tokens.filter(
    (token) => typeof token === 'string' && token.startsWith('ExponentPushToken[')
  );
  
  if (validTokens.length === 0) {
    return;
  }

  // If there's only one token, keep it as a string, else use the array
  const toPayload = validTokens.length === 1 ? validTokens[0] : validTokens;

  const payload = {
    to: toPayload,
    title: message.title,
    body: message.body,
    data: message.data || {},
    sound: message.sound !== undefined ? message.sound : 'default',
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send push notification to Expo:', errorText);
    } else {
      const resData = await response.json();
      console.log('Expo Push Notifications response:', JSON.stringify(resData));
    }
  } catch (error) {
    console.error('Error sending push notification via Expo:', error);
  }
}
