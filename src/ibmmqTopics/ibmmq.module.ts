import { DynamicModule, Module } from '@nestjs/common';
import { ConnectionService } from './services/connection/connection.service';
import { IConnectionConfig } from './services/connection/connection.interface';

@Module({
  providers: [ConnectionService]
})
export class IbmmqTopicsModule {
  static register(config: IConnectionConfig): DynamicModule {
    return {
      module: IbmmqTopicsModule,
      providers: [{
        provide: ConnectionService,
        useFactory: async () => new ConnectionService(config),
      },],
      exports: [ConnectionService],
    };
  }
}
