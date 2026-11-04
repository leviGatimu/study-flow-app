import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fleet } from './sync/harness.mjs';
import { recordFocus, focusDuration } from '../lib/focus-record.ts';
import { readStudyLog } from '../lib/study-log.ts';
import { keepOwnedRows } from '../lib/sync/ownership.ts';
import { applyRows } from '../lib/sync/merge.ts';
import { focusLogPayload } from '../lib/sync/protocol.ts';

const taskData=(userId,id='block')=>({id,userId,subject:'Physics',date:new Date('2026-11-04'),startTime:'22:30',endTime:'00:00',type:'REVISION',isDone:true,workDescription:'Newton’s laws and free-body diagrams.'});
test('older desktop clients receive only the columns their ledger supports',()=>{
  const data={id:'grant',amount:125,focusSeconds:125,taskId:'block'};
  assert.deepEqual(focusLogPayload('xpEvent',data,false),{id:'grant',amount:125});
  assert.equal(focusLogPayload('xpEvent',data,true),data);
  assert.equal(focusLogPayload('task',{id:'block',taskId:'keep'},false).taskId,'keep');
});
test('block details separate scheduled time from measured sessions, preserving zero-XP measurements and replay safety',async()=>{
  const fleet=await Fleet.create({devices:['A']});
  try {
    const db=fleet.device('A').prisma, user=fleet.userId;
    await db.task.create({data:taskData(user)});
    const measurement={sessionId:'stable-run',taskId:'block',seconds:125};
    assert.equal(await recordFocus(db,user,3,125,measurement),true);
    assert.equal(await recordFocus(db,user,3,125,measurement),false);
    await recordFocus(db,user,0,0,{sessionId:'zero-run',taskId:'block',seconds:0});
    const log=await readStudyLog(db,'block',user);
    assert.equal(log.summary._count,2);
    assert.equal(log.summary._sum.focusSeconds,125);
    assert.equal(log.summary._sum.amount,125);
    assert.equal(log.task.workDescription,taskData(user).workDescription);
    const progress=await db.userProgress.findUnique({where:{userId:user}});
    assert.equal(progress.focusSessions,2);
    assert.equal(progress.totalFocusMinutes,3);
    assert.equal(focusDuration(125),'2m 5s');
    assert.equal(focusDuration(5400),'1h 30m');
  } finally {await fleet.destroy();}
});
test('log reads and focus writes reject foreign, deleted and out-of-scope blocks',async()=>{
  const fleet=await Fleet.create({devices:['A']});
  try {
    const db=fleet.device('A').prisma,user=fleet.userId;
    await db.user.create({data:{id:'other',username:'other',passwordHash:'fixture'}});
    await db.task.create({data:taskData('other','foreign')});
    await db.task.create({data:{...taskData(user,'deleted'),deletedAt:new Date()}});
    await db.task.create({data:taskData(user)});
    for(const id of ['foreign','deleted','missing']) {
      assert.equal(await readStudyLog(db,id,user),null);
      await assert.rejects(()=>recordFocus(db,user,1,10,{sessionId:id,taskId:id,seconds:10}));
    }
    assert.equal(await readStudyLog(db,'block',user,[]),null);
    await assert.rejects(()=>recordFocus(db,user,1,10,{sessionId:'bad-owner',taskId:'block',ownerId:'other',seconds:10}));
    assert.equal(await db.xpEvent.count(),0);
    await assert.rejects(()=>db.xpEvent.create({data:{userId:user,amount:0,source:'FOCUS',sourceKey:'negative',focusSeconds:-1}}));
    const result=await keepOwnedRows(db,[{model:'xpEvent',data:{id:'foreign-link',userId:user,taskId:'foreign'}}],user);
    assert.equal(result.dropped,1);
  } finally {await fleet.destroy();}
});
test('legacy blocks remain unmeasured and free sessions do not attach to a block',async()=>{
  const fleet=await Fleet.create({devices:['A']});
  try {
    const db=fleet.device('A').prisma,user=fleet.userId;
    await db.task.create({data:taskData(user)});
    await db.xpEvent.create({data:{userId:user,amount:500,source:'FOCUS',sourceKey:'focus:legacy'}});
    await recordFocus(db,user,5,300,{sessionId:'free-run',taskId:'free',seconds:300});
    assert.equal((await readStudyLog(db,'block',user)).summary._count,0);
    assert.equal(await db.xpEvent.count({where:{taskId:null}}),2);
    for(const seconds of [-1,NaN,Infinity,86401,0.5])await assert.rejects(()=>recordFocus(db,user,1,1,{sessionId:'bad',seconds}));
  } finally {await fleet.destroy();}
});
test('focus measurements follow a reconciled task across devices and are not counted twice on replay',async()=>{
  const fleet=await Fleet.create({devices:['A']});
  try {
    const local=fleet.device('A').prisma,remote=fleet.server.prisma,user=fleet.userId;
    for(const db of [local,remote])await db.scheduleTemplate.create({data:{id:'routine',userId:user,dayOfWeek:3,subject:'Physics',startTime:'22:30',endTime:'00:00',deadlineDay:'Friday',type:'REVISION'}});
    await local.task.create({data:{...taskData(user,'local-block'),templateId:'routine'}});
    await remote.task.create({data:{...taskData(user,'remote-block'),templateId:'routine'}});
    await recordFocus(local,user,3,125,{sessionId:'synced-run',taskId:'local-block',seconds:125});
    const rows=[{model:'task',data:await local.task.findUnique({where:{id:'local-block'}})},{model:'xpEvent',data:await local.xpEvent.findFirst()}];
    const options={localDevice:'server',incomingDevice:'A',stamp:new Date()};
    assert.deepEqual((await applyRows(remote,rows,options)).errors,[]);
    assert.deepEqual((await applyRows(remote,rows,options)).errors,[]);
    assert.equal((await readStudyLog(remote,'remote-block',user)).summary._sum.focusSeconds,125);
    assert.equal(await remote.xpEvent.count(),1);
  } finally {await fleet.destroy();}
});
