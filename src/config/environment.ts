import dotenv from 'dotenv';

dotenv.config();

export const config = {
    nifi: {
        baseUrl: process.env.NIFI_BASE_URL || 'https://localhost:8443/nifi-api',
        username: process.env.NIFI_USERNAME || 'Admin',
        password: process.env.NIFI_PASSWORD || '',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4',
    },
};

export function validateConfig(): void {
    if (!config.openai.apiKey || config.openai.apiKey === 'your-openai-api-key-here') {
        console.error('❌ OPENAI_API_KEY is not set in .env file');
        process.exit(1);
    }
    if (!config.nifi.password) {
        console.error('❌ NIFI_PASSWORD is not set in .env file');
        process.exit(1);
    }
}
