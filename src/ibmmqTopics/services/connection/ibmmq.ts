import { Logger } from "@nestjs/common";
import * as mq from 'ibmmq';
import { MQC, MQQueueManager } from 'ibmmq';
import { IConnection, IConnectionConfig } from './connection.interface';
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
  private async cleanup(hConn: MQQueueManager, hObj: mq.MQObject): Promise<void> {
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
  async connect(): Promise<MQQueueManager> {
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
        const conn = await mq.ConnxPromise(this.qMgr, cno);
        this.connectionHandle = conn;
        return conn;
    } catch (err) {
      this.ok = false;
      this.exitCode = 1;
      return;
    }
  }
  async produce(message: any, conn: MQQueueManager): Promise<string>{
    const od = new mq.MQOD();
    od.ObjectString = this.topic;
    od.ObjectType = MQC.MQOT_TOPIC;
    const openOptions = MQC.MQOO_OUTPUT;
    this.logger.log(`Successfully connected to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
    let ghObj;
    return mq.OpenPromise(conn, od, openOptions).then(hObj => {
      ghObj = hObj;
      this.logger.log(`Successfully opened to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
      const msg = `${message} ${new Date().toString()}`;
      const mqmd = new mq.MQMD();
      const pmo = new mq.MQPMO();
      pmo.Options = MQC.MQPMO_NO_SYNCPOINT | MQC.MQPMO_NEW_MSG_ID | MQC.MQPMO_NEW_CORREL_ID;
      pmo.Options |= MQC.MQPMO_WARN_IF_NO_SUBS_MATCHED;
      return mq.PutPromise(hObj, mqmd, pmo, msg);
    }).then(() => {
      console.log("MQPUT successful");
      return mq.ClosePromise(ghObj, 0);
    }).then(() => {
        console.log("MQCLOSE successful.");
        return "Message published to topic: " + this.topic;
      })
  }
  async disconnect(): Promise<void> {
    if (this.ok) {
      console.log('Disconnecting from queue manager', this.qMgr);
      await this.cleanup(this.connectionHandle, this.topicHandle);
    }
  }
  private getMessage(hObj) {
    const mqmd = new mq.MQMD();
    const gmo = new mq.MQGMO();
    gmo.WaitInterval = MQC.MQWI_UNLIMITED;
    gmo.Options = MQC.MQGMO_NO_SYNCPOINT |
      MQC.MQGMO_WAIT |
      MQC.MQGMO_CONVERT |
      MQC.MQGMO_FAIL_IF_QUIESCING;
    mq.Get(hObj, mqmd, gmo, function (err, hObj, gmo, md, buf, conn) {
      if (err) {
        if (err.mqrc == MQC.MQRC_NO_MSG_AVAILABLE) {
          console.log("no more messages");
        } else {
          console.log("MQGET failed with " + err.mqrc);
        }
        //this.ok = false;
      } else {
        if (md.Format == "MQSTR") {
          console.log("New message received: ", buf.toString('utf8'));
        } else {
          console.log("Bynary message received: " + buf);
        }
      }
    });
  }
  subscribe(conn: MQQueueManager): void {
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
      mq.SubPromise(conn,null, sd).then(({ hObj, hSub }) => {
        this.logger.log(`Successfully opened to queueManager: {${this.qMgr}} | {NodeJS}-{${this.qMgr}}-{${this.topic}}-{Thread-id}`);
        this.getMessage(hObj);
        mq.Ctl(conn, MQC.MQOP_START, function (err) {
          if (!err)
            console.log("Subscription callback initialized");
        });
      }).catch(err=>{
        console.log("MQSUB ended with reason ", err.mqrc);
      })
    } catch (err) {
      this.ok = false;
      this.exitCode = 1;
      return;
    }
  }
}

