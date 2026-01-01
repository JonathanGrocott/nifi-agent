import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { config } from '../config/environment.js';
import {
    ProcessorEntity,
    ConnectionEntity,
    ControllerServiceEntity,
    ProcessGroupFlowEntity,
    PositionDTO,
    BundleDTO,
} from './types.js';

export class NiFiClient {
    private client: AxiosInstance;
    private token: string | null = null;
    private clientId: string;

    constructor() {
        this.clientId = `nifi-agent-${Date.now()}`;
        this.client = axios.create({
            baseURL: config.nifi.baseUrl,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async authenticate(): Promise<void> {
        try {
            const response = await this.client.post(
                '/access/token',
                `username=${encodeURIComponent(config.nifi.username)}&password=${encodeURIComponent(config.nifi.password)}`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }
            );
            this.token = response.data;
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
            console.log('✓ Authenticated with NiFi');
        } catch (error: any) {
            throw new Error(`Failed to authenticate with NiFi: ${error.message}`);
        }
    }

    async getAbout(): Promise<{ title: string; version: string }> {
        const response = await this.client.get('/flow/about');
        return response.data.about;
    }

    async getRootProcessGroupId(): Promise<string> {
        const response = await this.client.get('/flow/process-groups/root');
        return response.data.processGroupFlow.id;
    }

    async getProcessGroupFlow(groupId: string): Promise<ProcessGroupFlowEntity> {
        const response = await this.client.get(`/flow/process-groups/${groupId}`);
        return response.data;
    }

    async createProcessor(
        groupId: string,
        name: string,
        type: string,
        position: PositionDTO,
        bundle?: BundleDTO
    ): Promise<ProcessorEntity> {
        const payload = {
            revision: { version: 0, clientId: this.clientId },
            component: {
                name,
                type,
                position,
                bundle,
            },
        };

        const response = await this.client.post(
            `/process-groups/${groupId}/processors`,
            payload
        );
        return response.data;
    }

    async updateProcessorProperties(
        processorId: string,
        properties: Record<string, string | null>,
        currentVersion: number
    ): Promise<ProcessorEntity> {
        const response = await this.client.put(`/processors/${processorId}`, {
            revision: { version: currentVersion, clientId: this.clientId },
            component: {
                id: processorId,
                config: { properties },
            },
        });
        return response.data;
    }

    async updateProcessorAutoTerminate(
        processorId: string,
        relationships: string[],
        currentVersion: number
    ): Promise<ProcessorEntity> {
        const response = await this.client.put(`/processors/${processorId}`, {
            revision: { version: currentVersion, clientId: this.clientId },
            component: {
                id: processorId,
                config: { autoTerminatedRelationships: relationships },
            },
        });
        return response.data;
    }

    async createConnection(
        groupId: string,
        sourceId: string,
        destinationId: string,
        relationships: string[]
    ): Promise<ConnectionEntity> {
        const payload = {
            revision: { version: 0, clientId: this.clientId },
            component: {
                source: {
                    id: sourceId,
                    groupId,
                    type: 'PROCESSOR',
                },
                destination: {
                    id: destinationId,
                    groupId,
                    type: 'PROCESSOR',
                },
                selectedRelationships: relationships,
            },
        };

        const response = await this.client.post(
            `/process-groups/${groupId}/connections`,
            payload
        );
        return response.data;
    }

    async createControllerService(
        groupId: string,
        name: string,
        type: string,
        properties?: Record<string, string | null>,
        bundle?: BundleDTO
    ): Promise<ControllerServiceEntity> {
        const payload = {
            revision: { version: 0, clientId: this.clientId },
            component: {
                name,
                type,
                properties,
                bundle,
            },
        };

        const response = await this.client.post(
            `/process-groups/${groupId}/controller-services`,
            payload
        );
        return response.data;
    }

    async updateControllerServiceProperties(
        serviceId: string,
        properties: Record<string, string | null>,
        currentVersion: number
    ): Promise<ControllerServiceEntity> {
        const response = await this.client.put(`/controller-services/${serviceId}`, {
            revision: { version: currentVersion, clientId: this.clientId },
            component: {
                id: serviceId,
                properties,
            },
        });
        return response.data;
    }

    async enableControllerService(
        serviceId: string,
        currentVersion: number
    ): Promise<ControllerServiceEntity> {
        const response = await this.client.put(
            `/controller-services/${serviceId}/run-status`,
            {
                revision: { version: currentVersion, clientId: this.clientId },
                state: 'ENABLED',
            }
        );
        return response.data;
    }

    async disableControllerService(
        serviceId: string,
        currentVersion: number
    ): Promise<ControllerServiceEntity> {
        const response = await this.client.put(
            `/controller-services/${serviceId}/run-status`,
            {
                revision: { version: currentVersion, clientId: this.clientId },
                state: 'DISABLED',
            }
        );
        return response.data;
    }

    async startProcessor(
        processorId: string,
        currentVersion: number
    ): Promise<ProcessorEntity> {
        const response = await this.client.put(`/processors/${processorId}/run-status`, {
            revision: { version: currentVersion, clientId: this.clientId },
            state: 'RUNNING',
        });
        return response.data;
    }

    async stopProcessor(
        processorId: string,
        currentVersion: number
    ): Promise<ProcessorEntity> {
        const response = await this.client.put(`/processors/${processorId}/run-status`, {
            revision: { version: currentVersion, clientId: this.clientId },
            state: 'STOPPED',
        });
        return response.data;
    }

    async getProcessorTypes(): Promise<any[]> {
        const response = await this.client.get('/flow/processor-types');
        return response.data.processorTypes;
    }

    async getControllerServiceTypes(): Promise<any[]> {
        const response = await this.client.get('/flow/controller-service-types');
        return response.data.controllerServiceTypes;
    }
}
