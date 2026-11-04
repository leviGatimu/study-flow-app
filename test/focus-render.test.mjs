import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('the Focus study panel renders on the server without browser PDF globals',()=>{
  const result=spawnSync(process.execPath,['--import','tsx','-e',`
    const React=require('react');
    global.React=React;
    const {renderToString}=require('react-dom/server');
    const {FlowAIPanel}=require('./components/focus/FlowAIPanel.tsx');
    const html=renderToString(React.createElement(FlowAIPanel,{subject:'Physics',timerLabel:'00:00',onClose:()=>{}}));
    if(!html.includes('Physics'))throw Error('Subject missing from the rendered study panel');
  `],{encoding:'utf8',timeout:60000,env:{...process.env,JWT_SECRET:'focus-render-test-only-secret-not-used-for-live-accounts',DATABASE_URL:'file:./unused-focus-render-test.db'}});
  assert.equal(result.status,0,`${result.stderr}\n${result.stdout}`);
});
