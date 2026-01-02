import { NiFiClient } from './client.js';
import { FlowDefinition } from '../openai/service.js';
import { processorCatalog, controllerServiceCatalog } from '../processors/catalog.js';
import chalk from 'chalk';

export interface FlowBuildResult {
    success: boolean;
    processGroupId: string;
    processorIds: string[];
    connectionIds: string[];
    controllerServiceIds: string[];
    errors: string[];
}

export class FlowBuilder {
    private client: NiFiClient;

    constructor(client: NiFiClient) {
        this.client = client;
    }

    async buildFlow(definition: FlowDefinition): Promise<FlowBuildResult> {
        const result: FlowBuildResult = {
            success: false,
            processGroupId: '',
            processorIds: [],
            connectionIds: [],
            controllerServiceIds: [],
            errors: [],
        };

        try {
            // Get root process group
            const rootGroupId = await this.client.getRootProcessGroupId();
            result.processGroupId = rootGroupId;
            console.log(chalk.blue(`Using process group: ${rootGroupId}`));

            // Step 1: Create controller services first
            const serviceIdMap: Record<number, string> = {};
            if (definition.controller_services) {
                for (let i = 0; i < definition.controller_services.length; i++) {
                    const serviceDef = definition.controller_services[i];
                    console.log(chalk.yellow(`Creating controller service: ${serviceDef.name}...`));

                    const serviceInfo = controllerServiceCatalog[serviceDef.type];
                    const serviceType = serviceInfo?.type || serviceDef.type;
                    const bundle = serviceInfo?.bundle;

                    try {
                        const service = await this.client.createControllerService(
                            rootGroupId,
                            serviceDef.name,
                            serviceType,
                            serviceDef.properties,
                            bundle
                        );
                        const serviceId = service.component.id!;
                        serviceIdMap[i] = serviceId;
                        result.controllerServiceIds.push(serviceId);
                        console.log(chalk.green(`  ✓ Created: ${serviceDef.name}`));

                        // Enable the controller service
                        const version = service.revision.version;
                        await this.client.enableControllerService(serviceId, version);
                        console.log(chalk.green(`  ✓ Enabled: ${serviceDef.name}`));
                    } catch (error: any) {
                        const errorMsg = `Failed to create controller service ${serviceDef.name}: ${error.message}`;
                        console.log(chalk.red(`  ✗ ${errorMsg}`));
                        result.errors.push(errorMsg);
                    }
                }
            }

            // Step 2: Create processors
            // First, find the rightmost position of existing processors to avoid overlap
            const existingFlow = await this.client.getProcessGroupFlow(rootGroupId);
            const existingProcessors = existingFlow.processGroupFlow.flow.processors || [];
            let startX = 100;
            const startY = 100;
            const spacingY = 200;
            const spacingX = 450;

            if (existingProcessors.length > 0) {
                // Find the rightmost X position
                const maxX = Math.max(...existingProcessors.map(p => p.component.position?.x || 0));
                startX = maxX + spacingX;
                console.log(chalk.gray(`  Positioning new flow at x=${startX} (offset from existing processors)`));
            }

            const processorIdMap: Record<number, string> = {};
            const processorVersionMap: Record<number, number> = {};

            for (let i = 0; i < definition.processors.length; i++) {
                const procDef = definition.processors[i];
                console.log(chalk.yellow(`Creating processor: ${procDef.name}...`));

                const procInfo = processorCatalog[procDef.type];
                const processorType = procInfo?.type || procDef.type;
                // Don't pass bundle - let NiFi auto-detect from processor type

                // Calculate position
                const position = { x: startX, y: startY + i * spacingY };

                try {
                    const processor = await this.client.createProcessor(
                        rootGroupId,
                        procDef.name,
                        processorType,
                        position
                        // No bundle - NiFi will find it automatically
                    );
                    const processorId = processor.component.id!;
                    processorIdMap[i] = processorId;
                    processorVersionMap[i] = processor.revision.version;
                    result.processorIds.push(processorId);
                    console.log(chalk.green(`  ✓ Created: ${procDef.name} (id: ${processorId})`));

                    // Merge default properties from catalog with provided properties
                    const defaultProps = procInfo?.defaultProperties || {};
                    const properties: Record<string, string | null> = {
                        ...defaultProps,  // Defaults first
                        ...procDef.properties  // Provided properties override defaults
                    };

                    // Add required properties for specific processors
                    if (processorType.includes('PublishMQTT')) {
                        if (!properties['Retain Message']) properties['Retain Message'] = 'false';
                        if (!properties['Quality of Service']) properties['Quality of Service'] = '1';
                    }
                    if (processorType.includes('ConsumeMQTT')) {
                        if (!properties['Quality of Service']) properties['Quality of Service'] = '1';
                    }
                    if (processorType.includes('GenerateFlowFile')) {
                        // Ensure there's actual content to validate
                        if (!properties['Custom Text']) {
                            // Fix escaping for Expression Language
                            properties['Custom Text'] = `{
  "timestamp": "\${now():format('yyyy-MM-dd HH:mm:ss')}",
  "message": "Test data from NiFi Agent",
  "uuid": "\${UUID()}"
}`;
                        }
                        // Set data format to Text when using Custom Text
                        if (!properties['Data Format']) properties['Data Format'] = 'Text';
                    }

                    // Auto-terminate relationships for leaf processors (like PublishMQTT) if not connected
                    // We'll check this by seeing if this processor is a source in any connection
                    const isSource = definition.connections.some(c => c.from_index === i);

                    if (!isSource && processorType.includes('PublishMQTT')) {
                        // If it's a sink (not a source), auto-terminate success and failure
                        if (!procDef.auto_terminate) procDef.auto_terminate = [];
                        if (!procDef.auto_terminate.includes('success')) procDef.auto_terminate.push('success');
                        if (!procDef.auto_terminate.includes('failure')) procDef.auto_terminate.push('failure');
                    }

                    // Replace controller service references with IDs
                    if (definition.controller_services) {
                        for (const serviceDef of definition.controller_services) {
                            if (serviceDef.referenced_by) {
                                for (const ref of serviceDef.referenced_by) {
                                    if (ref.processor_index === i) {
                                        const serviceIndex = definition.controller_services.indexOf(serviceDef);
                                        properties[ref.property_name] = serviceIdMap[serviceIndex];
                                    }
                                }
                            }
                        }
                    }

                    if (Object.keys(properties).length > 0) {
                        console.log(chalk.gray(`    Properties to set: ${JSON.stringify(properties)}`));
                        try {
                            const updated = await this.client.updateProcessorProperties(
                                processorId,
                                properties,
                                processorVersionMap[i]
                            );
                            processorVersionMap[i] = updated.revision.version;

                            // Check validation status
                            const validationStatus = updated.component.validationStatus;
                            if (validationStatus === 'VALID') {
                                console.log(chalk.green(`  ✓ Configured ${Object.keys(properties).length} properties (Valid)`));
                            } else {
                                const errors = updated.component.validationErrors || [];
                                console.log(chalk.yellow(`  ⚠ Configured ${Object.keys(properties).length} properties (${validationStatus})`));
                                for (const err of errors) {
                                    console.log(chalk.yellow(`      - ${err}`));
                                }
                            }
                        } catch (propError: any) {
                            console.log(chalk.red(`  ✗ Failed to set properties: ${propError.response?.data?.message || propError.message}`));
                            if (propError.response?.data) {
                                console.log(chalk.gray(`    Response: ${JSON.stringify(propError.response.data)}`));
                            }
                            result.errors.push(`Failed to configure ${procDef.name}: ${propError.message}`);
                        }
                    } else {
                        console.log(chalk.yellow(`  ⚠ No properties to set for ${procDef.name}`));
                    }

                    // Auto-terminate relationships if specified
                    if (procDef.auto_terminate && procDef.auto_terminate.length > 0) {
                        const updated = await this.client.updateProcessorAutoTerminate(
                            processorId,
                            procDef.auto_terminate,
                            processorVersionMap[i]
                        );
                        processorVersionMap[i] = updated.revision.version;
                        console.log(chalk.green(`  ✓ Auto-terminated: ${procDef.auto_terminate.join(', ')}`));
                    }
                } catch (error: any) {
                    const errorMsg = `Failed to create processor ${procDef.name}: ${error.message}`;
                    console.log(chalk.red(`  ✗ ${errorMsg}`));
                    result.errors.push(errorMsg);
                }
            }

            // Step 3: Create connections
            for (const connDef of definition.connections) {
                const sourceId = processorIdMap[connDef.from_index];
                const destId = processorIdMap[connDef.to_index];

                if (!sourceId || !destId) {
                    const errorMsg = `Cannot create connection: source or destination processor not found`;
                    console.log(chalk.red(`  ✗ ${errorMsg}`));
                    result.errors.push(errorMsg);
                    continue;
                }

                const sourceName = definition.processors[connDef.from_index].name;
                const destName = definition.processors[connDef.to_index].name;
                console.log(chalk.yellow(`Connecting: ${sourceName} → ${destName}...`));

                try {
                    const connection = await this.client.createConnection(
                        rootGroupId,
                        sourceId,
                        destId,
                        connDef.relationships
                    );
                    result.connectionIds.push(connection.component.id!);
                    console.log(chalk.green(`  ✓ Connected via: ${connDef.relationships.join(', ')}`));
                } catch (error: any) {
                    const errorMsg = `Failed to connect ${sourceName} → ${destName}: ${error.message}`;
                    console.log(chalk.red(`  ✗ ${errorMsg}`));
                    result.errors.push(errorMsg);
                }
            }

            result.success = result.errors.length === 0;
            return result;
        } catch (error: any) {
            result.errors.push(`Flow build failed: ${error.message}`);
            return result;
        }
    }
}
