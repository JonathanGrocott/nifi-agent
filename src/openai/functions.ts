import { ChatCompletionTool } from 'openai/resources/chat/completions';

// OpenAI function definitions for NiFi flow creation

export const nifiFunctions: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'analyze_etl_request',
            description: 'Analyze the user ETL request and identify source/destination types, required processors, and any missing configuration parameters that need to be collected from the user.',
            parameters: {
                type: 'object',
                properties: {
                    source_type: {
                        type: 'string',
                        enum: ['opcua', 'mqtt', 'database', 'file', 'http', 'generate'],
                        description: 'The type of data source',
                    },
                    destination_type: {
                        type: 'string',
                        enum: ['mqtt', 'database', 'file', 'http', 'log'],
                        description: 'The type of data destination',
                    },
                    transformations: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of transformation operations needed (e.g., "convert to json", "filter", "transform attributes")',
                    },
                    processors_needed: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Processor name from catalog (e.g., PublishMQTT, ExecuteSQL)' },
                                purpose: { type: 'string', description: 'Brief description of what this processor does in the flow' },
                            },
                            required: ['name', 'purpose'],
                        },
                        description: 'Ordered list of processors needed for this ETL',
                    },
                    missing_parameters: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                param_name: { type: 'string', description: 'Parameter name (e.g., mqtt_broker_uri)' },
                                prompt: { type: 'string', description: 'Human-friendly question to ask the user' },
                                example: { type: 'string', description: 'Example value to show the user' },
                                required: { type: 'boolean', description: 'Whether this parameter is required' },
                            },
                            required: ['param_name', 'prompt', 'required'],
                        },
                        description: 'Parameters that need to be collected from the user',
                    },
                    flow_name: {
                        type: 'string',
                        description: 'Suggested name for this flow',
                    },
                    flow_description: {
                        type: 'string',
                        description: 'Brief description of what this flow does',
                    },
                },
                required: ['source_type', 'destination_type', 'processors_needed', 'missing_parameters', 'flow_name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_nifi_flow',
            description: 'Create the NiFi flow with all collected parameters. Call this after all required parameters have been gathered.',
            parameters: {
                type: 'object',
                properties: {
                    flow_name: {
                        type: 'string',
                        description: 'Name for the flow/process group',
                    },
                    processors: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Display name for the processor' },
                                type: { type: 'string', description: 'Processor type from catalog (e.g., PublishMQTT)' },
                                properties: {
                                    type: 'object',
                                    additionalProperties: { type: 'string' },
                                    description: 'Processor configuration properties',
                                },
                                auto_terminate: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Relationships to auto-terminate',
                                },
                            },
                            required: ['name', 'type', 'properties'],
                        },
                        description: 'Ordered list of processors with their configurations',
                    },
                    connections: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                from_index: { type: 'number', description: 'Index of source processor in the processors array' },
                                to_index: { type: 'number', description: 'Index of destination processor in the processors array' },
                                relationships: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Relationships to connect (e.g., ["success"])',
                                },
                            },
                            required: ['from_index', 'to_index', 'relationships'],
                        },
                        description: 'Connections between processors',
                    },
                    controller_services: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                type: { type: 'string', description: 'Controller service type from catalog' },
                                properties: {
                                    type: 'object',
                                    additionalProperties: { type: 'string' },
                                },
                                referenced_by: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            processor_index: { type: 'number' },
                                            property_name: { type: 'string' },
                                        },
                                    },
                                    description: 'Which processors reference this service and via which property',
                                },
                            },
                            required: ['name', 'type', 'properties'],
                        },
                        description: 'Controller services needed by the processors',
                    },
                },
                required: ['flow_name', 'processors', 'connections'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'request_clarification',
            description: 'Ask the user for clarification when the request is ambiguous or more information is needed to design the flow.',
            parameters: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'The clarifying question to ask the user',
                    },
                    options: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional list of choices to present to the user',
                    },
                },
                required: ['question'],
            },
        },
    },
];

// System prompt for the NiFi agent
export const systemPrompt = `You are a NiFi flow design expert. Your role is to help users create Apache NiFi data flows from natural language descriptions.

AVAILABLE PROCESSORS:
- PublishMQTT: Publishes data to MQTT broker (requires: Broker URI, Topic)
- ConsumeMQTT: Subscribes to MQTT topics (requires: Broker URI, Topic Filter)
- ExecuteSQL: Executes SQL queries (requires: Database Connection Pooling Service, SQL select query)
- ExecuteSQLRecord: Executes SQL and writes with Record Writer
- ConvertRecord: Converts between formats (requires: Record Reader, Record Writer)
- UpdateAttribute: Adds/modifies FlowFile attributes
- JoltTransformJSON: Transforms JSON using JOLT
- GetFile: Reads files from directory (requires: Input Directory)
- PutFile: Writes to files (requires: Directory)
- InvokeHTTP: Makes HTTP requests (requires: HTTP URL, HTTP Method)
- GenerateFlowFile: Generates test data
- LogAttribute: Logs attributes for debugging
- LogMessage: Logs custom messages

AVAILABLE CONTROLLER SERVICES:
- DBCPConnectionPool: JDBC database connection pool
- JsonTreeReader / JsonRecordSetWriter: JSON record handling
- AvroReader / AvroRecordSetWriter: Avro record handling

WORKFLOW:
1. When user describes an ETL, call analyze_etl_request to identify components and missing parameters
2. The system will collect missing parameters from the user
3. Once all parameters are collected, call create_nifi_flow with the complete configuration

IMPORTANT:
- Always identify ALL required parameters for processors
- Use clear, friendly prompts for parameter collection
- Include helpful examples in parameter prompts
- For MQTT: need Broker URI (e.g., tcp://localhost:1883) and Topic
- For databases: need Connection URL, Driver, Username, Password, and SQL query
- Design efficient flows with minimal processors
- Connect processors in logical order

When the user provides a vague request, use request_clarification to ask for more details.`;
