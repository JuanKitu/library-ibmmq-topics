import { MQQueueManager } from 'ibmmq';

export interface IConnectionConfig {
  userId?: string;
  password?: string;
  connectionName?: string;
  channelName?: string;
  applName?: string;
  qManager?: string;
  topic?: string;
}

export interface IConnection {
  connect: () => Promise<MQQueueManager>;
  disconnect: () => Promise<void>;
  subscribe: (conn: MQQueueManager) => void;
  produce: (message: any, conn: MQQueueManager) => Promise<string>;
}
