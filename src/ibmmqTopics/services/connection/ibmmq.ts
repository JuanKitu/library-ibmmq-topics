import { Logger } from "@nestjs/common";
import * as mq from 'ibmmq';
import { MQC } from 'ibmmq';
import * as console from 'console';
import { IConnection, IConnectionConfig } from './connection.interface';
import { Observable } from 'rxjs';
import { StringDecoder } from 'string_decoder';
export class Ibmmq implements IConnection {
  private readonly qMgr;
  private topic: string;
  private readonly  userId: string;
  private readonly password: string;
  private readonly connectionName: string;
  private readonly channelName: string;
  private readonly applName: string;
  private readonly logger: Logger;
  private msgId: string | null = null;
  private connectionHandle: mq.MQQueueManager;
  private topicHandle: mq.MQObject;
  private ok = true;
  private exitCode = 0;
  private readonly decoder: StringDecoder = new StringDecoder('utf8');
  constructor(config: IConnectionConfig) {
    this.qMgr = config.qManager;
    this.topic = config.topic;
    this.userId = config.userId;
    this.password = config.password;
    this.connectionName = config.connectionName;
    this.channelName = config.channelName;
    this.applName = config.applName;
    this.logger = new Logger(config.channelName);
  }
  private async cleanup(hConn: mq.MQQueueManager, hObj: mq.MQObject): Promise<void> {
    try {
      await mq.ClosePromise(hObj, 0);
      this.logger.log(`Successfully closed to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
      await mq.DiscPromise(hConn);
      this.logger.log(`Successfully disconnected to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
    } catch (closeErr) {
      this.logger.error(`Failed to disconnect to queueManager: {${this.qMgr}} - Exception: {1} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`)
      console.log('MQ call failed in ' + closeErr);
    }
  }
  async connect(): Promise<void> {
    const myArgs = process.argv.slice(2); // Remove redundant parms
    if (myArgs[0]) {
      this.topic = myArgs[0];
    }
    if (myArgs[1]) {
      this.msgId = myArgs[1];
    }
    const cno = new mq.MQCNO();
    const csp = new mq.MQCSP();
    const cd = new mq.MQCD();
    csp.UserId = this.userId;
    csp.Password = this.password;
    cno.SecurityParms = csp;
    cno.ApplName = this.applName;
    cd.ConnectionName = this.connectionName;
    cd.ChannelName = this.channelName;
    cno.ClientConn = cd;
    cno.Options = MQC.MQCNO_NONE;
    try {
      console.log('dentro del try del connectopic')
      if(!this.connectionHandle){
        console.log('dentro del connect')
        const conn = await mq.ConnxPromise(this.qMgr, cno);
        this.connectionHandle = conn;
      }
      const od = new mq.MQOD();
      console.log('valordel topico', this.topic);
      od.ObjectString = this.topic;
      od.ObjectType = MQC.MQOT_TOPIC;
      const openOptions = MQC.MQOO_OUTPUT;
      this.logger.log(`Successfully connected to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
      const obj = await mq.OpenPromise(this.connectionHandle, od, openOptions);
      this.logger.log(`Successfully opened to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
      this.topicHandle = obj;
      console.log('valor del handle del topico', this.topicHandle)
    } catch (err) {
      this.ok = false;
      this.exitCode = 1;
      return;
    }
  }
  async disconnect(): Promise<void> {
    if (this.ok) {
      console.log('Disconnecting from queue manager', this.qMgr);
      await this.cleanup(this.connectionHandle, this.topicHandle);
    }
  }
  async produce(message: any): Promise<void> {
    const msg = `${message} ${new Date().toString()}`;
    const mqmd = new mq.MQMD();
    const pmo = new mq.MQPMO();
    pmo.Options = MQC.MQPMO_NO_SYNCPOINT | MQC.MQPMO_NEW_MSG_ID | MQC.MQPMO_NEW_CORREL_ID;
    pmo.Options |= MQC.MQPMO_WARN_IF_NO_SUBS_MATCHED;
    return mq.PutPromise(this.topicHandle, mqmd, pmo, msg);
  }
  private getMessageObservable(hObj: mq.MQObject): Observable<void> {
    const buf = Buffer.alloc(1024);

    const mqmd = new mq.MQMD();
    const gmo = new mq.MQGMO();

    gmo.WaitInterval = MQC.MQWI_UNLIMITED;
    gmo.Options = MQC.MQGMO_NO_SYNCPOINT |
      MQC.MQGMO_WAIT |
      MQC.MQGMO_CONVERT |
      MQC.MQGMO_FAIL_IF_QUIESCING;

    return new Observable<void>((observer) => {
      mq.GetSync(hObj, mqmd, gmo, buf, (err, len) => {
        if (err) {
          if (err.mqrc == MQC.MQRC_NO_MSG_AVAILABLE) {
            console.log("no more messages");
          } else {
            console.log("MQGET failed with " + err.mqrc.toString());
          }
          this.ok = false;
          observer.complete();
        } else {
          if (mqmd.Format == "MQSTR") {
            console.log("message <%s>", this.decoder.write(buf.slice(0, len)));
          } else {
            console.log("binary message: " + buf.toString());
          }
          observer.next();
        }
      });
    });
  }
  async subscribe(): Promise<void> {
    const myArgs = process.argv.slice(2); // Remove redundant parms
    if (myArgs[0]) {
      this.topic = myArgs[0];
    }
    if (myArgs[1]) {
      this.msgId = myArgs[1];
    }
    try {
      const sd = new mq.MQSD();
      sd.ObjectString = this.topic;
      sd.Options =   MQC.MQSO_CREATE
        | MQC.MQSO_NON_DURABLE
        | MQC.MQSO_FAIL_IF_QUIESCING
        | MQC.MQSO_MANAGED;
      this.logger.log(`Successfully connected to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
      const { hObj, hSub } = await mq.SubPromise(this.connectionHandle, null, sd);
      this.logger.log(`Successfully opened to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
      console.log('valor del hobj', hObj);
      console.log('valor del hsub', hSub);
      //this.topicHandle = hObj;
      //this.getMessages(hObj);
      this.getMessageObservable(hObj).subscribe();
    } catch (err) {
      this.ok = false;
      this.exitCode = 1;
      return;
    }
  }

}

