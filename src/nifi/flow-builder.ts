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
            const processorIdMap: Record<number, string> = {};
            const processorVersionMap: Record<number, number> = {};
            const startX = 100;
            const startY = 100;
            const spacingY = 150;

            for (let i = 0; i < definition.processors.length; i++) {
                const procDef = definition.processors[i];
                console.log(chalk.yellow(`Creating processor: ${procDef.name}...`));

                const procInfo = processorCatalog[procDef.type];
                const processorType = procInfo?.type || procDef.type;
                const bundle = procInfo?.bundle;

                // Calculate position
                const position = { x: startX, y: startY + i * spacingY };

                try {
                    const processor = await this.client.createProcessor(
                        rootGroupId,
                        procDef.name,
                        processorType,
                        position,
                        bundle
                    );
                    const processorId = processor.component.id!;
                    processorIdMap[i] = processorId;
                    processorVersionMap[i] = processor.revision.version;
                    result.processorIds.push(processorId);
                    console.log(chalk.green(`  ✓ Created: ${procDef.name}`));

                    // Update processor properties
                    const properties: Record<string, string | null> = { ...procDef.properties };

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
                        const updated = await this.client.updateProcessorProperties(
                            processorId,
                            properties,
                            processorVersionMap[i]
                        );
                        processorVersionMap[i] = updated.revision.version;
                        console.log(chalk.green(`  ✓ Configured properties`));
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
