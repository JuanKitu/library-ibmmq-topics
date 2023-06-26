export const IBMMQ_MODULE_OPTIONS = 'IBMMQ_MODULE_OPTIONS';
export interface IBMMqModuleOptions {
  host: string;
  port: number;
  queueManager: string;
  channelName: string;
  userName: string;
  password: string;
  ssl?: boolean;
}