import type { Environment } from "../types/environment";

export function getStackPrefix(name: string, environment: Environment): string {
    return `${environment.appName}-${name}`.toLowerCase();
}

export function getStackName(environment: Environment): string {
    return getStackPrefix("stack", environment);
}
