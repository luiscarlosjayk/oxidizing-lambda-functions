import { Context } from 'aws-lambda';

interface CustomEvent {
  name?: string;
}

const RUSTY_EXTENSION_PORT = process.env.RUSTY_EXTENSION_PORT || '9000';

export async function handler(event: CustomEvent, context: Context) {
  try {
    const queryParam = event?.name || 'LuisK';
    const url = new URL(`http://127.0.0.1:${RUSTY_EXTENSION_PORT}/greeting`);
    url.searchParams.append('name', queryParam);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Request successful',
        data: data,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Request failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
