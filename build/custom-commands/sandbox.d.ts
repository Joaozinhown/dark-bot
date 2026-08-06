import type { WorkflowStep } from './definition';
export interface SandboxContext {
    readonly user: {
        readonly id: string;
        readonly username: string;
    };
    readonly guild: {
        readonly id: string;
        readonly name: string;
    };
    readonly channel: {
        readonly id: string;
    };
    readonly locale: 'pt-BR' | 'en-US';
    readonly options: Readonly<Record<string, unknown>>;
    readonly variables: Readonly<Record<string, string>>;
}
export interface SandboxResult {
    readonly workflow: WorkflowStep[];
    readonly logs: string[];
}
export declare function runSandboxScript(code: string, sandboxContext: SandboxContext): Promise<SandboxResult>;
//# sourceMappingURL=sandbox.d.ts.map