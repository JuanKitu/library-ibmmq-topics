import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { IConnectionConfig } from './connection.interface';
import { Ibmmq } from './ibmmq';

@Injectable()
export class ConnectionService implements OnModuleInit, OnApplicationShutdown{
  private readonly connectionData: IConnectionConfig;
  private connection: Ibmmq;
  private readonly logger: Logger;
  constructor(config:IConnectionConfig) {
    this.connectionData = config;
    this.connection = new Ibmmq(this.connectionData);
    this.logger = new Logger(config.channelName);
  }
  async onModuleInit() {
    await this.connection.connect();
    this.connection.subscribe().then();
  }
  async onApplicationShutdown(signal?: string) {
    await this.connection.disconnect();
  }
  async produce(message: any){
    await this.connection.produce(message);
    this.logger.log(`Sending message to queue {0} - Message: {1} | {NodeJS}-{${this.connectionData.qManager}}-{${this.connectionData.topic}}`);
  }
}
