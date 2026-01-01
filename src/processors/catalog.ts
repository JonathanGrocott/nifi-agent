import { ProcessorTypeInfo, BundleDTO } from '../nifi/types.js';

// Standard NiFi bundle
const standardBundle: BundleDTO = {
    group: 'org.apache.nifi',
    artifact: 'nifi-standard-nar',
    version: '2.0.0',
};

const mqttBundle: BundleDTO = {
    group: 'org.apache.nifi',
    artifact: 'nifi-mqtt-nar',
    version: '2.0.0',
};

// Processor catalog with common ETL processors
export const processorCatalog: Record<string, ProcessorTypeInfo> = {
    // MQTT Processors
    PublishMQTT: {
        type: 'org.apache.nifi.processors.mqtt.PublishMQTT',
        bundle: mqttBundle,
        requiredProperties: ['Broker URI', 'Topic'],
        optionalProperties: ['Client ID', 'Quality of Service', 'Retain Message', 'Username', 'Password'],
        defaultProperties: {
            'Quality of Service': '1',
            'Retain Message': 'false',
        },
        relationships: ['success', 'failure'],
        description: 'Publishes FlowFile content as an MQTT message to a broker',
    },
    ConsumeMQTT: {
        type: 'org.apache.nifi.processors.mqtt.ConsumeMQTT',
        bundle: mqttBundle,
        requiredProperties: ['Broker URI', 'Topic Filter'],
        optionalProperties: ['Client ID', 'Quality of Service', 'Max Queue Size', 'Username', 'Password'],
        defaultProperties: {
            'Quality of Service': '1',
            'Max Queue Size': '1000',
        },
        relationships: ['Message'],
        description: 'Subscribes to MQTT topics and receives messages',
    },

    // Database Processors
    ExecuteSQL: {
        type: 'org.apache.nifi.processors.standard.ExecuteSQL',
        bundle: standardBundle,
        requiredProperties: ['Database Connection Pooling Service', 'SQL select query'],
        optionalProperties: ['Max Rows Per Flow File', 'Output Format'],
        defaultProperties: {},
        relationships: ['success', 'failure'],
        description: 'Executes SQL SELECT queries against a database',
    },
    ExecuteSQLRecord: {
        type: 'org.apache.nifi.processors.standard.ExecuteSQLRecord',
        bundle: standardBundle,
        requiredProperties: ['Database Connection Pooling Service', 'SQL select query', 'Record Writer'],
        optionalProperties: ['Max Rows Per Flow File', 'Normalize Table/Column Names'],
        defaultProperties: {},
        relationships: ['success', 'failure', 'original'],
        description: 'Executes SQL SELECT and writes results using a Record Writer',
    },

    // Transformation Processors
    ConvertRecord: {
        type: 'org.apache.nifi.processors.standard.ConvertRecord',
        bundle: standardBundle,
        requiredProperties: ['Record Reader', 'Record Writer'],
        optionalProperties: ['Include Zero Record FlowFiles'],
        defaultProperties: {},
        relationships: ['success', 'failure'],
        description: 'Converts between record formats (Avro, JSON, CSV, etc.)',
    },
    UpdateAttribute: {
        type: 'org.apache.nifi.processors.attributes.UpdateAttribute',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: [],
        defaultProperties: {},
        relationships: ['success', 'failure'],
        description: 'Adds or modifies FlowFile attributes',
    },
    JoltTransformJSON: {
        type: 'org.apache.nifi.processors.standard.JoltTransformJSON',
        bundle: standardBundle,
        requiredProperties: ['Jolt Specification'],
        optionalProperties: ['Jolt Transform', 'Pretty Print'],
        defaultProperties: {
            'Jolt Transform': 'Chain',
        },
        relationships: ['success', 'failure'],
        description: 'Transforms JSON using JOLT specifications',
    },

    // File/HTTP Processors
    GetFile: {
        type: 'org.apache.nifi.processors.standard.GetFile',
        bundle: standardBundle,
        requiredProperties: ['Input Directory'],
        optionalProperties: ['File Filter', 'Recurse Subdirectories', 'Keep Source File'],
        defaultProperties: {
            'Keep Source File': 'false',
        },
        relationships: ['success'],
        description: 'Reads files from a directory',
    },
    PutFile: {
        type: 'org.apache.nifi.processors.standard.PutFile',
        bundle: standardBundle,
        requiredProperties: ['Directory'],
        optionalProperties: ['Conflict Resolution Strategy', 'Create Missing Directories'],
        defaultProperties: {
            'Create Missing Directories': 'true',
            'Conflict Resolution Strategy': 'fail',
        },
        relationships: ['success', 'failure'],
        description: 'Writes FlowFile content to a file',
    },
    InvokeHTTP: {
        type: 'org.apache.nifi.processors.standard.InvokeHTTP',
        bundle: standardBundle,
        requiredProperties: ['HTTP URL', 'HTTP Method'],
        optionalProperties: ['Content-Type', 'Request Username', 'Request Password'],
        defaultProperties: {
            'HTTP Method': 'GET',
        },
        relationships: ['Response', 'Retry', 'No Retry', 'Failure', 'Original'],
        description: 'Sends HTTP requests',
    },

    // Utility Processors
    GenerateFlowFile: {
        type: 'org.apache.nifi.processors.standard.GenerateFlowFile',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: ['File Size', 'Batch Size', 'Data Format', 'Custom Text'],
        defaultProperties: {
            'Batch Size': '1',
        },
        relationships: ['success'],
        description: 'Generates FlowFiles for testing',
    },
    LogAttribute: {
        type: 'org.apache.nifi.processors.standard.LogAttribute',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: ['Log Level', 'Log Payload'],
        defaultProperties: {
            'Log Level': 'info',
            'Log Payload': 'false',
        },
        relationships: ['success'],
        description: 'Logs FlowFile attributes for debugging',
    },
    LogMessage: {
        type: 'org.apache.nifi.processors.standard.LogMessage',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: ['Log Level', 'Log Message'],
        defaultProperties: {
            'Log Level': 'info',
        },
        relationships: ['success'],
        description: 'Logs a custom message',
    },
};

// Controller Service catalog
export const controllerServiceCatalog: Record<string, {
    type: string;
    bundle: BundleDTO;
    requiredProperties: string[];
    optionalProperties: string[];
    description: string;
}> = {
    DBCPConnectionPool: {
        type: 'org.apache.nifi.dbcp.DBCPConnectionPool',
        bundle: standardBundle,
        requiredProperties: ['Database Connection URL', 'Database Driver Class Name', 'Database User', 'Password'],
        optionalProperties: ['Max Wait Time', 'Max Total Connections'],
        description: 'JDBC Connection Pool for database access',
    },
    JsonTreeReader: {
        type: 'org.apache.nifi.json.JsonTreeReader',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: ['Schema Access Strategy'],
        description: 'Reads JSON records',
    },
    JsonRecordSetWriter: {
        type: 'org.apache.nifi.json.JsonRecordSetWriter',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: ['Schema Access Strategy', 'Pretty Print JSON'],
        description: 'Writes records as JSON',
    },
    AvroReader: {
        type: 'org.apache.nifi.avro.AvroReader',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: [],
        description: 'Reads Avro records',
    },
    AvroRecordSetWriter: {
        type: 'org.apache.nifi.avro.AvroRecordSetWriter',
        bundle: standardBundle,
        requiredProperties: [],
        optionalProperties: ['Schema Access Strategy'],
        description: 'Writes records as Avro',
    },
};

// Helper function to get processor info
export function getProcessorInfo(name: string): ProcessorTypeInfo | undefined {
    return processorCatalog[name];
}

// Helper to find processor by use case keywords
export function findProcessorsByKeywords(keywords: string[]): ProcessorTypeInfo[] {
    const results: ProcessorTypeInfo[] = [];
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    for (const [name, info] of Object.entries(processorCatalog)) {
        const searchText = `${name} ${info.type} ${info.description}`.toLowerCase();
        if (lowerKeywords.some(kw => searchText.includes(kw))) {
            results.push(info);
        }
    }
    return results;
}
