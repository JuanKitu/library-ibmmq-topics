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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  produce: (message: any) => Promise<void>;
  subscribe: () => Promise<void>;
}
