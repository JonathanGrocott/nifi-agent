import readlineSync from 'readline-sync';
import chalk from 'chalk';
import { OpenAIService, ETLAnalysis, AgentResponse } from '../openai/service.js';
import { NiFiClient } from '../nifi/client.js';
import { FlowBuilder } from '../nifi/flow-builder.js';

export class ConversationManager {
    private openai: OpenAIService;
    private nifiClient: NiFiClient;
    private flowBuilder: FlowBuilder;
    private collectedParams: Record<string, string> = {};

    constructor() {
        this.openai = new OpenAIService();
        this.nifiClient = new NiFiClient();
        this.flowBuilder = new FlowBuilder(this.nifiClient);
    }

    async initialize(): Promise<void> {
        console.log(chalk.blue('\n🔌 Connecting to NiFi...'));
        await this.nifiClient.authenticate();

        const about = await this.nifiClient.getAbout();
        console.log(chalk.green(`✓ Connected to ${about.title} v${about.version}\n`));
    }

    async startConversation(): Promise<void> {
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.cyan.bold('  NiFi Agent - Natural Language Flow Builder'));
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.gray('\nDescribe the data flow you want to create.'));
        console.log(chalk.gray('Type "exit" to quit, "reset" to start over.\n'));

        while (true) {
            const userInput = readlineSync.question(chalk.yellow('You: '));

            if (userInput.toLowerCase() === 'exit') {
                console.log(chalk.gray('\nGoodbye!'));
                break;
            }

            if (userInput.toLowerCase() === 'reset') {
                this.openai.resetConversation();
                this.collectedParams = {};
                console.log(chalk.gray('\nConversation reset. Describe your new flow.\n'));
                continue;
            }

            if (!userInput.trim()) {
                continue;
            }

            await this.processUserInput(userInput);
        }
    }

    private async processUserInput(input: string): Promise<void> {
        try {
            console.log(chalk.gray('\nThinking...\n'));
            const response = await this.openai.processMessage(input, this.collectedParams);
            await this.handleResponse(response);
        } catch (error: any) {
            console.log(chalk.red(`\nError: ${error.message}\n`));
        }
    }

    private async handleResponse(response: AgentResponse): Promise<void> {
        switch (response.type) {
            case 'analysis':
                await this.handleAnalysis(response.data);
                break;
            case 'flow':
                await this.handleFlowCreation(response.data);
                break;
            case 'clarification':
                this.handleClarification(response.data);
                break;
            case 'message':
                console.log(chalk.white(`Agent: ${response.data}\n`));
                break;
        }
    }

    private async handleAnalysis(analysis: ETLAnalysis): Promise<void> {
        console.log(chalk.cyan('═'.repeat(50)));
        console.log(chalk.cyan.bold(`  Flow: ${analysis.flow_name}`));
        console.log(chalk.cyan('═'.repeat(50)));

        if (analysis.flow_description) {
            console.log(chalk.gray(`\n${analysis.flow_description}\n`));
        }

        console.log(chalk.white('\nProcessors needed:'));
        for (const proc of analysis.processors_needed) {
            console.log(chalk.gray(`  • ${proc.name}: ${proc.purpose}`));
        }

        // Collect missing parameters
        if (analysis.missing_parameters.length > 0) {
            console.log(chalk.yellow('\n📝 I need some information to configure the flow:\n'));

            for (const param of analysis.missing_parameters) {
                let prompt = `${param.prompt}`;
                if (param.example) {
                    prompt += chalk.gray(` (e.g., ${param.example})`);
                }
                prompt += param.required ? chalk.red(' *') : '';

                const value = readlineSync.question(chalk.yellow(`  ${prompt}: `));

                if (value.trim()) {
                    this.collectedParams[param.param_name] = value.trim();
                } else if (param.required) {
                    console.log(chalk.red('  This field is required. Please provide a value.'));
                    const retry = readlineSync.question(chalk.yellow(`  ${prompt}: `));
                    if (retry.trim()) {
                        this.collectedParams[param.param_name] = retry.trim();
                    }
                }
            }

            console.log(chalk.gray('\n✓ Parameters collected. Generating flow configuration...\n'));

            // Now ask OpenAI to create the flow with collected parameters
            const flowResponse = await this.openai.refineWithParameters(analysis, this.collectedParams);
            await this.handleResponse(flowResponse);
        }
    }

    private async handleFlowCreation(flowDef: import('../openai/service.js').FlowDefinition): Promise<void> {
        console.log(chalk.cyan('\n═'.repeat(50)));
        console.log(chalk.cyan.bold('  Creating NiFi Flow'));
        console.log(chalk.cyan('═'.repeat(50)));
        console.log(chalk.gray(`\nFlow: ${flowDef.flow_name}\n`));

        const confirm = readlineSync.question(
            chalk.yellow('Create this flow in NiFi? (yes/no): ')
        );

        if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
            console.log(chalk.gray('\nFlow creation cancelled.\n'));
            return;
        }

        console.log(chalk.blue('\n🚀 Building flow...\n'));
        const result = await this.flowBuilder.buildFlow(flowDef);

        console.log(chalk.cyan('\n═'.repeat(50)));
        if (result.success) {
            console.log(chalk.green.bold('  ✅ Flow created successfully!'));
            console.log(chalk.cyan('═'.repeat(50)));
            console.log(chalk.gray(`\n  Processors: ${result.processorIds.length}`));
            console.log(chalk.gray(`  Connections: ${result.connectionIds.length}`));
            console.log(chalk.gray(`  Controller Services: ${result.controllerServiceIds.length}`));
            console.log(chalk.blue(`\n  View in NiFi UI: https://localhost:8443/nifi\n`));
        } else {
            console.log(chalk.red.bold('  ⚠️ Flow created with errors'));
            console.log(chalk.cyan('═'.repeat(50)));
            for (const error of result.errors) {
                console.log(chalk.red(`  • ${error}`));
            }
            console.log('');
        }

        // Reset for next flow
        this.collectedParams = {};
    }

    private handleClarification(data: { question: string; options?: string[] }): void {
        console.log(chalk.white(`\nAgent: ${data.question}`));
        if (data.options && data.options.length > 0) {
            console.log(chalk.gray('\nOptions:'));
            data.options.forEach((opt, i) => {
                console.log(chalk.gray(`  ${i + 1}. ${opt}`));
            });
        }
        console.log('');
    }
}
