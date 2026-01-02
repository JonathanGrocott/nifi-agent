import OpenAI from 'openai';
import { config } from '../config/environment.js';
import { nifiFunctions, systemPrompt } from './functions.js';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface ETLAnalysis {
    source_type: string;
    destination_type: string;
    transformations: string[];
    processors_needed: Array<{ name: string; purpose: string }>;
    missing_parameters: Array<{
        param_name: string;
        prompt: string;
        example?: string;
        required: boolean;
    }>;
    flow_name: string;
    flow_description?: string;
}

export interface FlowDefinition {
    flow_name: string;
    processors: Array<{
        name: string;
        type: string;
        properties: Record<string, string>;
        auto_terminate?: string[];
    }>;
    connections: Array<{
        from_index: number;
        to_index: number;
        relationships: string[];
    }>;
    controller_services?: Array<{
        name: string;
        type: string;
        properties: Record<string, string>;
        referenced_by?: Array<{
            processor_index: number;
            property_name: string;
        }>;
    }>;
}

export interface ClarificationRequest {
    question: string;
    options?: string[];
}

export type AgentResponse =
    | { type: 'analysis'; data: ETLAnalysis }
    | { type: 'flow'; data: FlowDefinition }
    | { type: 'clarification'; data: ClarificationRequest }
    | { type: 'message'; data: string };

export class OpenAIService {
    private client: OpenAI;
    private conversationHistory: ChatCompletionMessageParam[] = [];

    constructor() {
        this.client = new OpenAI({
            apiKey: config.openai.apiKey,
        });

        // Initialize with system prompt
        this.conversationHistory.push({
            role: 'system',
            content: systemPrompt,
        });
    }

    async processMessage(userMessage: string, collectedParams?: Record<string, string>): Promise<AgentResponse> {
        // Add context about collected parameters if any
        let messageContent = userMessage;
        if (collectedParams && Object.keys(collectedParams).length > 0) {
            messageContent += `\n\nAlready collected parameters:\n${JSON.stringify(collectedParams, null, 2)}`;
        }

        this.conversationHistory.push({
            role: 'user',
            content: messageContent,
        });

        const response = await this.client.chat.completions.create({
            model: config.openai.model,
            messages: this.conversationHistory,
            tools: nifiFunctions,
            tool_choice: 'auto',
        });

        const message = response.choices[0].message;

        // Add assistant response to history
        this.conversationHistory.push(message);

        // Check if the model wants to call a function
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Add function result to history (simulated)
            this.conversationHistory.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ status: 'acknowledged', function: functionName }),
            });

            switch (functionName) {
                case 'analyze_etl_request':
                    return { type: 'analysis', data: functionArgs as ETLAnalysis };
                case 'create_nifi_flow':
                    return { type: 'flow', data: functionArgs as FlowDefinition };
                case 'request_clarification':
                    return { type: 'clarification', data: functionArgs as ClarificationRequest };
                default:
                    return { type: 'message', data: `Unknown function: ${functionName}` };
            }
        }

        // Regular text response
        return { type: 'message', data: message.content || 'No response generated' };
    }

    async refineWithParameters(
        analysis: ETLAnalysis,
        collectedParams: Record<string, string>
    ): Promise<AgentResponse> {
        const refinementPrompt = `All required parameters have been collected. Create the NiFi flow now.

Original analysis:
${JSON.stringify(analysis, null, 2)}

User-provided parameter values:
${JSON.stringify(collectedParams, null, 2)}

CRITICAL: When calling create_nifi_flow, you MUST:
1. Map parameter values to EXACT NiFi property names in each processor's "properties" object
2. For PublishMQTT, use these exact property names:
   - "Broker URI" (not "broker_uri" or "mqtt_broker")
   - "Topic" (not "topic" or "mqtt_topic")
   - "Quality of Service" (optional, default is "1")
3. For ConsumeMQTT, use:
   - "Broker URI"
   - "Topic Filter"
4. For GenerateFlowFile, use:
   - "Custom Text" for the message content
   - "Data Format" set to "Text"
5. For ExecuteSQL, use:
   - "Database Connection Pooling Service"
   - "SQL select query"

Example of correct processor config:
{
  "name": "Publish to MQTT",
  "type": "PublishMQTT",
  "properties": {
    "Broker URI": "tcp://localhost:1883",
    "Topic": "my/topic",
    "Quality of Service": "1"
  }
}

Now call create_nifi_flow with the full configuration, ensuring ALL collected parameter values are properly mapped to processor properties.`;

        return this.processMessage(refinementPrompt, collectedParams);
    }

    resetConversation(): void {
        this.conversationHistory = [
            {
                role: 'system',
                content: systemPrompt,
            },
        ];
    }
}
