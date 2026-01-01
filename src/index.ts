#!/usr/bin/env node

import { validateConfig } from './config/environment.js';
import { ConversationManager } from './conversation/manager.js';
import chalk from 'chalk';

async function main(): Promise<void> {
    console.log(chalk.gray('\n🔧 NiFi Agent starting...\n'));

    // Validate configuration
    validateConfig();

    // Start conversation
    const manager = new ConversationManager();

    try {
        await manager.initialize();
        await manager.startConversation();
    } catch (error: any) {
        console.error(chalk.red(`\n❌ Fatal error: ${error.message}\n`));
        process.exit(1);
    }
}

main();
