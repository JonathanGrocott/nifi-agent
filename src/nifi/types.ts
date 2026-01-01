// NiFi API Type Definitions

export interface PositionDTO {
    x: number;
    y: number;
}

export interface RevisionDTO {
    version: number;
    clientId?: string;
}

export interface BundleDTO {
    group: string;
    artifact: string;
    version: string;
}

export interface ProcessorConfigDTO {
    properties: Record<string, string | null>;
    schedulingPeriod?: string;
    schedulingStrategy?: string;
    penaltyDuration?: string;
    yieldDuration?: string;
    bulletinLevel?: string;
    autoTerminatedRelationships?: string[];
    comments?: string;
}

export interface ProcessorDTO {
    id?: string;
    parentGroupId?: string;
    position?: PositionDTO;
    name: string;
    type: string;
    bundle?: BundleDTO;
    state?: string;
    config?: ProcessorConfigDTO;
    relationships?: RelationshipDTO[];
    validationErrors?: string[];
    validationStatus?: string;
}

export interface ProcessorEntity {
    revision: RevisionDTO;
    id?: string;
    uri?: string;
    component: ProcessorDTO;
    status?: ProcessorStatusDTO;
}

export interface ProcessorStatusDTO {
    runStatus: string;
    validationStatus: string;
}

export interface RelationshipDTO {
    name: string;
    description?: string;
    autoTerminate?: boolean;
}

export interface ConnectableDTO {
    id: string;
    type: 'PROCESSOR' | 'INPUT_PORT' | 'OUTPUT_PORT' | 'FUNNEL' | 'REMOTE_INPUT_PORT' | 'REMOTE_OUTPUT_PORT';
    groupId: string;
    name?: string;
}

export interface ConnectionDTO {
    id?: string;
    parentGroupId?: string;
    source: ConnectableDTO;
    destination: ConnectableDTO;
    name?: string;
    selectedRelationships: string[];
    backPressureObjectThreshold?: number;
    backPressureDataSizeThreshold?: string;
    flowFileExpiration?: string;
}

export interface ConnectionEntity {
    revision: RevisionDTO;
    id?: string;
    component: ConnectionDTO;
}

export interface ControllerServiceDTO {
    id?: string;
    parentGroupId?: string;
    name: string;
    type: string;
    bundle?: BundleDTO;
    properties?: Record<string, string | null>;
    state?: string;
    validationErrors?: string[];
    validationStatus?: string;
}

export interface ControllerServiceEntity {
    revision: RevisionDTO;
    id?: string;
    component: ControllerServiceDTO;
}

export interface ProcessGroupFlowDTO {
    id: string;
    uri: string;
    flow: {
        processors: ProcessorEntity[];
        connections: ConnectionEntity[];
        controllerServices?: ControllerServiceEntity[];
    };
}

export interface ProcessGroupFlowEntity {
    processGroupFlow: ProcessGroupFlowDTO;
}

// Processor Types Catalog
export interface ProcessorTypeInfo {
    type: string;
    bundle: BundleDTO;
    requiredProperties: string[];
    optionalProperties: string[];
    defaultProperties?: Record<string, string>;
    relationships: string[];
    description: string;
}
