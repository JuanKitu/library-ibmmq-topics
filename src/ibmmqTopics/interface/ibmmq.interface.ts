export interface IIbmmqCreate {
  userId?: string;
  password?: string;
  connectionName?: string;
  channelName?: string;
  applName?: string;
}
export interface IProducerConnection {
  userId?: string;
  password?: string;
  connectionName?: string;
  channelName?: string;
  applName?: string;
  qManager?: string;
  qName?: string;
}
